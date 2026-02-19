# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Flow is a browser extension for Chromium-based browsers (Chrome, Edge, Brave, Arc, Vivaldi, Opera) that provides two main features:
1. **YouTube FYP Blocker** - Hides recommendations, channels, and notifications on YouTube while preserving search
2. **New Tab Blocker** - Automatically closes new tabs (except links opened in new tabs)

## Architecture

### Extension Structure

- **manifest.json** - Manifest V3 configuration defining permissions, content scripts, and background service worker
- **background.js** - Service worker that handles new tab blocking logic
- **youtube-blocker.js** - Content script injected into YouTube pages, toggles CSS blocking via `ytd-fyp-blocker-enabled` class
- **youtube-blocker.css** - CSS rules that hide YouTube UI elements when the blocker class is present
- **popup.html/popup.js** - Extension popup UI for toggling features on/off

### State Management

Settings are stored in `chrome.storage.sync` with two keys:
- `youtubeBlockerEnabled` - Boolean for YouTube FYP blocking
- `newTabBlockerEnabled` - Boolean for new tab blocking

All three components (background.js, youtube-blocker.js, popup.js) listen for storage changes to react to setting updates.

### Browser Compatibility

The extension uses a compatibility layer at the top of each JS file:
```javascript
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;
```

This allows it to work on both Chrome and Firefox (though Firefox is not explicitly supported in the README).

### YouTube Blocking Strategy

YouTube blocking uses a two-pronged approach:
1. **CSS-based** - `youtube-blocker.css` hides elements when `.ytd-fyp-blocker-enabled` class is on `<html>`
2. **JavaScript-based** - `content.js` (legacy) runs a MutationObserver to dynamically hide elements and expand the video player

Note: There appears to be duplicate/overlapping code between `youtube-blocker.js` (which just toggles the class) and `content.js` (which directly manipulates styles via JS). The class-based approach in `youtube-blocker.js` + CSS is the cleaner implementation.

### New Tab Blocking Logic

The background service worker:
1. Tracks `lastActiveTabId` via `chrome.tabs.onActivated`
2. On `chrome.tabs.onCreated`, checks if the new tab URL matches browser-specific new tab pages
3. If match: switches back to `lastActiveTabId`, then closes the new tab

Supported new tab URLs: `chrome://newtab`, `edge://newtab`, `brave://newtab`, `opera://newtab`, `vivaldi://newtab`, `arc://newtab`, `about:blank`

## Development

### Loading the Extension

1. Navigate to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select this repository's root directory

### Testing Changes

- For content script changes (YouTube blocker): Refresh any open YouTube tabs
- For background script changes: Go to `chrome://extensions/` and click the reload icon on the Flow extension card
- For popup changes: Close and reopen the extension popup

### File Checklist for Changes

| Change Type | Files to Update |
|-------------|-----------------|
| Add new storage setting | `popup.js`, `background.js` or `youtube-blocker.js`, `popup.html` |
| Modify YouTube CSS hiding | `youtube-blocker.css` |
| Modify new tab behavior | `background.js` |
| UI changes | `popup.html`, `popup.js` |
