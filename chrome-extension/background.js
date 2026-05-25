let lastUrl = "";
let lastTitle = "";
let lastSentTime = 0;

async function sendActiveTab() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs && tabs[0]) {
      const tab = tabs[0];
      if (!tab.url) return;

      // Skip internal browser URLs
      if (tab.url.startsWith('chrome://') || 
          tab.url.startsWith('chrome-extension://') || 
          tab.url.startsWith('edge://') || 
          tab.url.startsWith('about:')) {
        return;
      }

      const now = Date.now();
      // Only skip sending if it's the same tab and sent within last 3 seconds
      if (tab.url === lastUrl && tab.title === lastTitle && (now - lastSentTime < 3000)) {
        return;
      }

      lastUrl = tab.url;
      lastTitle = tab.title || "";
      lastSentTime = now;

      await fetch('http://localhost:5012/activity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: tab.url,
          title: tab.title || ""
        })
      });
    }
  } catch (error) {
    // FocusTrack application might not be running, ignore gracefully
  }
}

// Listen for tab focus changes
chrome.tabs.onActivated.addListener(sendActiveTab);

// Listen for URL or Title changes within the tab
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.active && (changeInfo.url || changeInfo.title)) {
    sendActiveTab();
  }
});

// Listen for browser window focus changes
chrome.windows.onFocusChanged.addListener(sendActiveTab);

// Periodic updates
setInterval(sendActiveTab, 5000);
