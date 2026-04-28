// background.js — Service Worker
// Handles extension lifecycle only. All UI logic lives in popup.js.

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') {
    chrome.storage.sync.set({
      language: 'English',
      protectedDomains: []
    });
  }
});
