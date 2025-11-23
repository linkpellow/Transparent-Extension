// TPI Background Service Worker
// Handles sidepanel opening when extension action is clicked
// Based on: https://github.com/GoogleChrome/chrome-extensions-samples/tree/main/functional-samples/cookbook.sidepanel-open

// Open sidepanel when extension action is clicked
chrome.action.onClicked.addListener((tab) => {
  // Open the sidepanel for the current tab
  chrome.sidePanel.open({ tabId: tab.id });
});

// Optional: Open sidepanel automatically when navigating to Google Calendar
// Uncomment the following if you want the sidepanel to open automatically
/*
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status === 'complete' && tab.url && tab.url.includes('calendar.google.com')) {
    chrome.sidePanel.open({ tabId: tabId });
  }
});
*/

