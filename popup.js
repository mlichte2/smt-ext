document.addEventListener("DOMContentLoaded", function () {
  // Tab Navigation
  const tabs = document.querySelectorAll(".tab");
  const tabContents = document.querySelectorAll(".tab-content");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      // Remove active class from all tabs and contents
      tabs.forEach((t) => t.classList.remove("active"));
      tabContents.forEach((c) => c.classList.remove("active"));

      // Add active class to current tab and content
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
    // Load lists
    if (data.allowlist) {
      allowlistTextarea.value = data.allowlist.join("\n");
    }

    if (data.blocklist) {
      blocklistTextarea.value = data.blocklist.join("\n");
    }

    // Load options
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

  // Save allowlist
  saveAllowlistButton.addEventListener("click", function () {
    const allowlist = allowlistTextarea.value
      .split("\n")
      .map((username) => username.trim())
      .filter((username) => username !== "");

    chrome.storage.sync.set({ allowlist: allowlist }, function () {
      showStatus("Allowlist saved!");
      updateContentScript();
    });
  });

  // Save blocklist
  saveBlocklistButton.addEventListener("click", function () {
    const blocklist = blocklistTextarea.value
      .split("\n")
      .map((username) => username.trim())
      .filter((username) => username !== "");

    chrome.storage.sync.set({ blocklist: blocklist }, function () {
      showStatus("Blocklist saved!");
      updateContentScript();
    });
  });

  // Save options
  saveOptionsButton.addEventListener("click", function () {
    chrome.storage.sync.set(
      {
        filterEnabled: filterEnabledCheckbox.checked,
        showThreads: showThreadsCheckbox.checked,
        hideBlockedThreads: hideBlockedThreadsCheckbox.checked,
        emptyAllowlistShowsAll: emptyAllowlistShowsAllCheckbox.checked,
      },
      function () {
        showStatus("Options saved!");
        updateContentScript();
      }
    );
  });

  // Update content script with all settings
  function updateContentScript() {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (!tabs[0].url.includes("smartmoneytrackerpremium.com")) {
        showStatus("Extension only works on smartmoneytrackerpremium.com");
        return;
      }

      chrome.tabs.sendMessage(tabs[0].id, {
        action: "updateSettings",
        settings: {
          allowlist: allowlistTextarea.value
            .split("\n")
            .map((u) => u.trim())
            .filter((u) => u !== ""),
          blocklist: blocklistTextarea.value
            .split("\n")
            .map((u) => u.trim())
            .filter((u) => u !== ""),
          filterEnabled: filterEnabledCheckbox.checked,
          showThreads: showThreadsCheckbox.checked,
          hideBlockedThreads: hideBlockedThreadsCheckbox.checked,
          emptyAllowlistShowsAll: emptyAllowlistShowsAllCheckbox.checked,
        },
      });
    });
  }

  // Show status message
  function showStatus(message) {
    statusDiv.textContent = message;
    setTimeout(() => {
      statusDiv.textContent = "";
    }, 2000);
  }
});
