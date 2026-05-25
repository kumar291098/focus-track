document.addEventListener('DOMContentLoaded', async () => {
  const statusIndicator = document.getElementById('status-indicator');
  const statusText = document.getElementById('status-text');
  const currentTab = document.getElementById('current-tab');

  // Query current tab
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs && tabs[0]) {
      currentTab.textContent = tabs[0].title || tabs[0].url || "No active tab";
    } else {
      currentTab.textContent = "No active tab";
    }
  } catch (e) {
    currentTab.textContent = "Error querying tab";
  }

  // Ping desktop app server
  try {
    const response = await fetch('http://localhost:5012/activity', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url: 'http://localhost/ping', title: 'ping' })
    });
    
    if (response.ok) {
      statusIndicator.className = 'indicator connected';
      statusText.textContent = 'Desktop App Connected';
    } else {
      statusIndicator.className = 'indicator';
      statusText.textContent = 'Disconnected';
    }
  } catch (e) {
    statusIndicator.className = 'indicator';
    statusText.textContent = 'Disconnected';
  }
});
