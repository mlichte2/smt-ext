document.addEventListener("DOMContentLoaded", function () {
  // Tab Navigation
  const tabs = document.querySelectorAll(".tab");
  const tabContents = document.querySelectorAll(".tab-content");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      tabContents.forEach((c) => c.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById(`${tab.dataset.tab}-tab`).classList.add("active");
    });
  });

  // Elements
  const allowlistTextarea = document.getElementById("allowlist");
  const blocklistTextarea = document.getElementById("blocklist");
  const saveAllowlistButton = document.getElementById("save-allowlist");
  const saveBlocklistButton = document.getElementById("save-blocklist");
  const saveOptionsButton = document.getElementById("save-options");
  const filterEnabledCheckbox = document.getElementById("filterEnabled");
  const showThreadsCheckbox = document.getElementById("showThreads");
  const hideBlockedThreadsCheckbox =
    document.getElementById("hideBlockedThreads");
  const emptyAllowlistShowsAllCheckbox = document.getElementById(
    "emptyAllowlistShowsAll"
  );
  const statusDiv = document.getElementById("status");

  // Load saved settings
  chrome.storage.sync.get(null, function (data) {
    if (data.allowlist) {
      allowlistTextarea.value = data.allowlist.join("\n");
    }
    if (data.blocklist) {
      blocklistTextarea.value = data.blocklist.join("\n");
    }
    filterEnabledCheckbox.checked =
      data.filterEnabled !== undefined ? data.filterEnabled : true;
    showThreadsCheckbox.checked =
      data.showThreads !== undefined ? data.showThreads : true;
    hideBlockedThreadsCheckbox.checked =
      data.hideBlockedThreads !== undefined ? data.hideBlockedThreads : false;
    emptyAllowlistShowsAllCheckbox.checked =
      data.emptyAllowlistShowsAll !== undefined
        ? data.emptyAllowlistShowsAll
        : true;
  });

  // ---- Helpers -------------------------------------------------------------

  // Parse a textarea into a deduped list (case-insensitive).
  // Preserves the first-seen casing the user typed.
  function parseList(text) {
    const seen = new Set();
    const out = [];
    for (const raw of text.split("\n")) {
      const u = raw.trim();
      if (!u) continue;
      const key = u.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(u);
    }
    return out;
  }

  // Find usernames present in both lists (case-insensitive).
  function findCrossListConflicts(allow, block) {
    const blockKeys = new Set(block.map((u) => u.toLowerCase()));
    return allow.filter((u) => blockKeys.has(u.toLowerCase()));
  }

  // Reflect the deduped list back into the textarea so the user sees the
  // canonical state.
  function writeBack(textarea, list) {
    textarea.value = list.join("\n");
  }

  // Disable button + swap label while a save is in flight, restore on done.
  function setSaving(button, saving) {
    if (saving) {
      if (!button.dataset.originalLabel) {
        button.dataset.originalLabel = button.textContent;
      }
      button.disabled = true;
      button.textContent = "Saving…";
    } else {
      button.disabled = false;
      if (button.dataset.originalLabel) {
        button.textContent = button.dataset.originalLabel;
      }
    }
  }

  // Show status message
  function showStatus(message) {
    statusDiv.textContent = message;
    setTimeout(() => {
      statusDiv.textContent = "";
    }, 2000);
  }

  // ---- Save handlers -------------------------------------------------------
  // Each handler:
  //   1. Parses + dedupes the textarea
  //   2. Writes back the canonical list
  //   3. Reads the OTHER list from storage (so the conflict warning reflects
  //      the persisted state, not unsaved textarea edits)
  //   4. Persists via chrome.storage.sync.set; the content script picks it up
  //      via chrome.storage.onChanged (no tabs.sendMessage needed)
  //   5. Disables/restores the button across the round-trip

  saveAllowlistButton.addEventListener("click", function () {
    const allowlist = parseList(allowlistTextarea.value);
    writeBack(allowlistTextarea, allowlist);
    setSaving(saveAllowlistButton, true);

    chrome.storage.sync.get("blocklist", function (data) {
      if (chrome.runtime.lastError) {
        setSaving(saveAllowlistButton, false);
        showStatus("Read failed: " + chrome.runtime.lastError.message);
        return;
      }
      const persistedBlock = data.blocklist || [];

      chrome.storage.sync.set({ allowlist: allowlist }, function () {
        setSaving(saveAllowlistButton, false);
        if (chrome.runtime.lastError) {
          showStatus("Save failed: " + chrome.runtime.lastError.message);
          return;
        }
        const conflicts = findCrossListConflicts(allowlist, persistedBlock);
        if (conflicts.length) {
          showStatus(
            "Allowlist saved. Note: " +
              conflicts.join(", ") +
              " also in blocklist (blocklist wins)."
          );
        } else {
          showStatus("Allowlist saved!");
        }
      });
    });
  });

  saveBlocklistButton.addEventListener("click", function () {
    const blocklist = parseList(blocklistTextarea.value);
    writeBack(blocklistTextarea, blocklist);
    setSaving(saveBlocklistButton, true);

    chrome.storage.sync.get("allowlist", function (data) {
      if (chrome.runtime.lastError) {
        setSaving(saveBlocklistButton, false);
        showStatus("Read failed: " + chrome.runtime.lastError.message);
        return;
      }
      const persistedAllow = data.allowlist || [];

      chrome.storage.sync.set({ blocklist: blocklist }, function () {
        setSaving(saveBlocklistButton, false);
        if (chrome.runtime.lastError) {
          showStatus("Save failed: " + chrome.runtime.lastError.message);
          return;
        }
        const conflicts = findCrossListConflicts(persistedAllow, blocklist);
        if (conflicts.length) {
          showStatus(
            "Blocklist saved. Note: " +
              conflicts.join(", ") +
              " also in allowlist (blocklist wins)."
          );
        } else {
          showStatus("Blocklist saved!");
        }
      });
    });
  });

  saveOptionsButton.addEventListener("click", function () {
    setSaving(saveOptionsButton, true);
    chrome.storage.sync.set(
      {
        filterEnabled: filterEnabledCheckbox.checked,
        showThreads: showThreadsCheckbox.checked,
        hideBlockedThreads: hideBlockedThreadsCheckbox.checked,
        emptyAllowlistShowsAll: emptyAllowlistShowsAllCheckbox.checked,
      },
      function () {
        setSaving(saveOptionsButton, false);
        if (chrome.runtime.lastError) {
          showStatus("Save failed: " + chrome.runtime.lastError.message);
          return;
        }
        showStatus("Options saved!");
      }
    );
  });
});
