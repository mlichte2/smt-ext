// Global settings (defaults; replaced once storage loads)
let settings = {
  allowlist: [],
  blocklist: [],
  filterEnabled: true,
  showThreads: true,
  hideBlockedThreads: false,
  emptyAllowlistShowsAll: true,
};

// Inject style sheet once on init.
const addStyles = () => {
  const styleId = "comment-filter-styles";
  if (document.getElementById(styleId)) return;
  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = `
    .blocklisted-user-comment {
      opacity: 0.4;
      transition: opacity 0.3s ease;
    }
  `;
  document.head.appendChild(style);
};

// Normalize a username for comparison: trim, lowercase, NBSP -> space, strip
// trailing " says"/" says:" suffix (legacy markup) so old saved lists keep
// working after the site moved <span class="says"> outside of .fn.
const normalizeUsername = (raw) => {
  if (!raw) return "";
  return raw
    .replace(/\u00a0/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\s+says:?\s*$/i, "")
    .trim();
};

// Pull username text from a comment <li>, normalized.
const getUsernameFromComment = (commentLi) => {
  const el = commentLi.querySelector(".fn");
  if (!el) return "";
  return normalizeUsername(el.textContent || "");
};

// Single O(N) filtering pass.
//
// Builds a per-comment map with {username, isAllow, isBlock, parent, children}
// then runs two DFS passes (subtree flags via post-order, ancestor flags via
// pre-order). Visibility decision per comment is then O(1).
const applyFilter = () => {
  const list = document.querySelectorAll("li.comment");
  if (list.length === 0) return;

  const allowSet = new Set(
    settings.allowlist.map(normalizeUsername).filter(Boolean)
  );
  const blockSet = new Set(
    settings.blocklist.map(normalizeUsername).filter(Boolean)
  );

  // Build per-comment nodes
  const nodes = new Map();
  for (const li of list) {
    const username = getUsernameFromComment(li);
    nodes.set(li, {
      li,
      username,
      isAllow: !!username && allowSet.has(username),
      isBlock: !!username && blockSet.has(username),
      parent: null,
      children: [],
      subtreeHasAllow: false,
      subtreeHasBlock: false,
      ancestorHasAllow: false,
      ancestorHasBlock: false,
    });
  }

  // Build parent / children edges using closest("li.comment") on the parent
  // chain. Works regardless of whether replies are wrapped in <ul class=children>
  // or some other container.
  for (const node of nodes.values()) {
    const parentEl = node.li.parentElement;
    const parentLi = parentEl ? parentEl.closest("li.comment") : null;
    if (parentLi && nodes.has(parentLi)) {
      const parent = nodes.get(parentLi);
      node.parent = parent;
      parent.children.push(node);
    }
  }

  const roots = [];
  for (const node of nodes.values()) {
    if (!node.parent) roots.push(node);
  }

  // Iterative post-order DFS to compute subtree flags
  const postOrder = (root, fn) => {
    const stack = [{ node: root, processed: false }];
    while (stack.length) {
      const frame = stack[stack.length - 1];
      if (!frame.processed) {
        frame.processed = true;
        for (const c of frame.node.children) {
          stack.push({ node: c, processed: false });
        }
      } else {
        stack.pop();
        fn(frame.node);
      }
    }
  };

  for (const root of roots) {
    postOrder(root, (n) => {
      n.subtreeHasAllow = n.isAllow;
      n.subtreeHasBlock = n.isBlock;
      for (const c of n.children) {
        if (c.subtreeHasAllow || c.isAllow) n.subtreeHasAllow = true;
        if (c.subtreeHasBlock || c.isBlock) n.subtreeHasBlock = true;
      }
    });
  }

  // Iterative pre-order DFS to compute ancestor flags
  const preOrder = (root, fn) => {
    const stack = [root];
    while (stack.length) {
      const n = stack.pop();
      fn(n);
      for (const c of n.children) stack.push(c);
    }
  };

  for (const root of roots) {
    preOrder(root, (n) => {
      if (n.parent) {
        n.ancestorHasAllow =
          n.parent.ancestorHasAllow || n.parent.isAllow;
        n.ancestorHasBlock =
          n.parent.ancestorHasBlock || n.parent.isBlock;
      }
    });
  }

  // Decide visibility + styling per comment in O(1) each.
  for (const n of nodes.values()) {
    let show;
    if (!settings.filterEnabled) {
      show = true;
    } else if (n.isBlock) {
      show = false;
    } else if (
      settings.hideBlockedThreads &&
      (n.ancestorHasBlock || n.subtreeHasBlock)
    ) {
      show = false;
    } else if (allowSet.size === 0 && settings.emptyAllowlistShowsAll) {
      show = true;
    } else if (n.isAllow) {
      show = true;
    } else if (
      settings.showThreads &&
      (n.ancestorHasAllow || n.subtreeHasAllow)
    ) {
      show = true;
    } else {
      show = false;
    }

    n.li.style.display = show ? "" : "none";

    const commentDiv = n.li.querySelector('div[id^="comment-"]');
    if (commentDiv) {
      commentDiv.classList.toggle("blocklisted-user-comment", n.isBlock);
    }
  }
};

// Apply filter, debounced, on the next animation frame to coalesce bursts of
// mutations (likes counter, time-ago tickers, dynamically loaded replies).
let scheduled = false;
const scheduleFilter = () => {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    applyFilter();
  });
};

// Read settings from storage and apply.
const loadSettings = (cb) => {
  chrome.storage.sync.get(null, function (data) {
    settings = {
      allowlist: data.allowlist || [],
      blocklist: data.blocklist || [],
      filterEnabled:
        data.filterEnabled !== undefined ? data.filterEnabled : true,
      showThreads: data.showThreads !== undefined ? data.showThreads : true,
      hideBlockedThreads:
        data.hideBlockedThreads !== undefined
          ? data.hideBlockedThreads
          : false,
      emptyAllowlistShowsAll:
        data.emptyAllowlistShowsAll !== undefined
          ? data.emptyAllowlistShowsAll
          : true,
    };
    if (cb) cb();
  });
};

// Pick the smallest plausible subtree to observe so we don't react to every
// unrelated DOM change (likes widgets, sidebars, ads).
const pickObserverTarget = () =>
  document.getElementById("comments") ||
  document.querySelector("ol.comment-list, ul.comment-list, .comments-area") ||
  document.body;

// Init: load settings first, THEN start observer. This avoids the race where
// the observer fires applyFilter() with default settings before storage
// resolves.
addStyles();
loadSettings(() => {
  applyFilter();

  const target = pickObserverTarget();

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      // Only react when comment-related nodes are added or removed.
      if (m.addedNodes.length === 0 && m.removedNodes.length === 0) continue;
      const all = [...m.addedNodes, ...m.removedNodes];
      for (const node of all) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        if (
          node.matches?.("li.comment, .comment") ||
          node.querySelector?.("li.comment, .comment")
        ) {
          scheduleFilter();
          return;
        }
      }
    }
  });

  observer.observe(target, { childList: true, subtree: true });
});

// React to storage writes (popup save, another tab's popup, future code paths).
// This is the single source of truth for setting changes — no tabs.sendMessage
// hop required, so it works across all open SMT tabs simultaneously.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync") return;
  loadSettings(scheduleFilter);
});
