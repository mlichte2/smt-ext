// Global variables
let settings = {
  allowlist: [],
  blocklist: [],
  filterEnabled: true,
  showThreads: true,
  hideBlockedThreads: false,
  emptyAllowlistShowsAll: true,
};

// Style constant for blocklisted users
const addStyles = () => {
  const styleId = "comment-filter-styles";
  if (!document.getElementById(styleId)) {
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
        .blocklisted-user-comment {
          opacity: 0.4;
          transition: opacity 0.3s ease;
        }
      `;
    document.head.appendChild(style);
  }
};

// Get username from comment
const getUsernameFromComment = (commentLi) => {
  const usernameElement = commentLi.querySelector(".fn");
  if (!usernameElement) return null;
  return usernameElement.textContent.trim();
};

// Check if a comment is from an allowlisted user
const isAllowlistedComment = (commentLi) => {
  const username = getUsernameFromComment(commentLi);
  return username && settings.allowlist.includes(username);
};

// Check if a comment is from a blocklisted user
const isBlocklistedComment = (commentLi) => {
  const username = getUsernameFromComment(commentLi);
  return username && settings.blocklist.includes(username);
};

// Check if comment is part of a thread containing an allowlisted user
const isPartOfAllowlistedThread = (commentLi) => {
  if (!settings.showThreads) return false;

  // Check if this comment is from an allowlisted user
  if (isAllowlistedComment(commentLi)) return true;

  // Check if any parent comment is from an allowlisted user
  let parent = commentLi.parentElement;
  while (parent) {
    if (parent.tagName === "UL" && parent.classList.contains("children")) {
      const parentLi = parent.parentElement;
      if (
        parentLi &&
        parentLi.classList.contains("comment") &&
        isAllowlistedComment(parentLi)
      ) {
        return true;
      }
      parent = parentLi;
    } else {
      parent = parent.parentElement;
    }
  }

  // Check if any child comment is from an allowlisted user
  const childrenUl = commentLi.querySelector("ul.children");
  if (childrenUl) {
    const childrenLis = childrenUl.querySelectorAll("li.comment");
    for (const childLi of childrenLis) {
      if (isAllowlistedComment(childLi)) {
        return true;
      }
    }
  }

  return false;
};

// Check if comment is part of a thread containing a blocklisted user
const isPartOfBlocklistedThread = (commentLi) => {
  if (!settings.hideBlockedThreads) return false;

  // Check if this comment is from a blocklisted user
  if (isBlocklistedComment(commentLi)) return true;

  // Check if any parent comment is from a blocklisted user
  let parent = commentLi.parentElement;
  while (parent) {
    if (parent.tagName === "UL" && parent.classList.contains("children")) {
      const parentLi = parent.parentElement;
      if (
        parentLi &&
        parentLi.classList.contains("comment") &&
        isBlocklistedComment(parentLi)
      ) {
        return true;
      }
      parent = parentLi;
    } else {
      parent = parent.parentElement;
    }
  }

  // Check if any child comment is from a blocklisted user
  const childrenUl = commentLi.querySelector("ul.children");
  if (childrenUl) {
    const childrenLis = childrenUl.querySelectorAll("li.comment");
    for (const childLi of childrenLis) {
      if (isBlocklistedComment(childLi)) {
        return true;
      }
    }
  }

  return false;
};

// Apply styles to a comment
const applyCommentStyles = (commentLi) => {
  const commentDiv = commentLi.querySelector('div[id^="comment-"]');
  if (!commentDiv) return;

  // Reset styles
  commentDiv.classList.remove("blocklisted-user-comment");

  // Apply blocklisted style only
  if (isBlocklistedComment(commentLi)) {
    commentDiv.classList.add("blocklisted-user-comment");
  }
};

// Determine if a comment should be shown or hidden
const shouldShowComment = (commentLi) => {
  // If filtering is disabled, show everything
  if (!settings.filterEnabled) return true;

  // Always hide blocklisted users or their threads if that option is enabled
  if (isBlocklistedComment(commentLi) || isPartOfBlocklistedThread(commentLi)) {
    return false;
  }

  // If allowlist is empty and the option is enabled, show all non-blocked comments
  if (settings.allowlist.length === 0 && settings.emptyAllowlistShowsAll) {
    return true;
  }

  // Show allowlisted users and (optionally) their threads
  return (
    isAllowlistedComment(commentLi) || isPartOfAllowlistedThread(commentLi)
  );
};

// Apply filtering to all comments
const applyFilter = () => {
  // Add styles to the document
  addStyles();

  // Process all comment elements
  document.querySelectorAll("li.comment").forEach((commentLi) => {
    // Determine visibility
    commentLi.style.display = shouldShowComment(commentLi) ? "" : "none";

    // Apply styling
    applyCommentStyles(commentLi);
  });
};

// Load settings from storage and apply filter
const loadSettingsAndApply = () => {
  chrome.storage.sync.get(null, function (data) {
    // Update settings with stored values or defaults
    settings = {
      allowlist: data.allowlist || [],
      blocklist: data.blocklist || [],
      filterEnabled:
        data.filterEnabled !== undefined ? data.filterEnabled : true,
      showThreads: data.showThreads !== undefined ? data.showThreads : true,
      hideBlockedThreads:
        data.hideBlockedThreads !== undefined ? data.hideBlockedThreads : false,
      emptyAllowlistShowsAll:
        data.emptyAllowlistShowsAll !== undefined
          ? data.emptyAllowlistShowsAll
          : true,
    };

    // Apply filtering
    applyFilter();
  });
};

// Check if we're on the right domain before initializing
const currentUrl = window.location.href;
if (currentUrl.includes("smartmoneytrackerpremium.com")) {
  // Initialize
  loadSettingsAndApply();

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener(function (
    message,
    sender,
    sendResponse
  ) {
    if (message.action === "updateSettings") {
      // Update settings with new values
      settings = { ...settings, ...message.settings };

      // Apply filtering with new settings
      applyFilter();
    }
  });

  // MutationObserver to detect dynamically loaded comments
  const observer = new MutationObserver(function (mutations) {
    let hasCommentChanges = false;
    mutations.forEach(function (mutation) {
      if (mutation.addedNodes.length > 0) {
        for (const node of mutation.addedNodes) {
          if (
            node.nodeType === Node.ELEMENT_NODE &&
            (node.classList.contains("comment") ||
              node.querySelector(".comment"))
          ) {
            hasCommentChanges = true;
            break;
          }
        }
      }
    });

    if (hasCommentChanges) {
      applyFilter();
    }
  });

  // Start observing DOM changes
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}
