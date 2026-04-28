# Sleep Tab

A Brave/Chromium extension to manually discard tabs and free up memory on demand.

Brave's built-in Memory Saver will eventually sleep inactive tabs on its own, BUT YOU CAN'T TRIGGER IT YOURSELF. This extension adds that. Open the popup, pick the tabs you want gone, and put them to sleep. They stay in the tab strip and reload normally when you come back to them.

---

## Features

- Discard any tab instantly from the popup
- Sleep an entire tab group at once (skips your current tab automatically)
- Protect specific tabs so Brave's auto-sleep never touches them
- Unprotect tabs with one click on the badge
- Bulk select / deselect with a Gmail-style toggle
- Search tabs by name (hover the magnifying glass to expand)
- Collapse and expand tab groups in the popup
- Settings panel with language support: English, Spanish, French, German, Portuguese

---

## How tab discarding works

`chrome.tabs.discard()` kills the tab's renderer process. The page is gone from memory. What survives: the URL, title, favicon, scroll position, localStorage, sessionStorage, cookies, and navigation history. What doesn't: any in-memory JS state, open WebSockets, pending requests.

When you click a sleeping tab it reloads from cache or network, same as any normal page load. Brave shows its native grey dashed circle on discarded tabs — the extension doesn't need to add any visual indicator.

The Protect feature sets `autoDiscardable: false` on a tab, which tells Brave's Memory Saver to leave it alone. This means that manually putting the protected tab to sleep still works. To unprotect a tab, just click on the "protected" badge.

---

## Installation

Not on the Chrome Web Store yet. Load it manually:

1. Clone the repo
   ```bash
   git clone https://github.com/BeyremHF/sleep-tab.git
   ```
2. Go to `brave://extensions`
3. Turn on **Developer mode** (top right)
4. Click **Load unpacked** and select the folder

---

## Usage

| What you want to do | How |
|---|---|
| Sleep specific tabs | Open popup → select tabs → **Put to sleep** |
| Sleep a whole group | Hover the group name → **select group** → **Put to sleep** |
| Protect a tab from auto-sleep | Select it → **Protect** |
| Unprotect a tab | Click its green **protected** badge |
| Sleep all tabs at once | Click the checkbox in the footer → **Put to sleep** |

One thing worth knowing: you can't discard the tab you're currently on. If you try to sleep a group that includes your active tab, everything else in that group sleeps and your current tab is skipped — no error, no interruption.

---

## Browser support

Works on any Chromium-based browser: Brave, Chrome, Edge. The extension uses standard MV3 APIs with no browser-specific code.

Does not work on Firefox. Firefox supports `contexts: ["tab"]` in its menus API (which would allow a proper right-click menu on the tab strip), but Chromium does not expose this. The popup is the workaround.

---

## Project structure

```
sleep-tab/
├── manifest.json       — extension config and permissions
├── background.js       — service worker, keyboard shortcut handler
├── popup.html          — popup UI
├── popup.js            — tab fetching, selection logic, discard/protect calls
├── popup.css           — styles
└── icons/
    ├── 16.png
    ├── 48.png
    └── 128.png
```

---
