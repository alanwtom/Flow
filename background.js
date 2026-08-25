// Browser compatibility
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

// Background script for handling new tab blocking and the toolbar icon state.
//
// MV3 note: this context (service worker on Chromium, event page on Gecko) is
// torn down when idle and restarted on the next event. Nothing here may rely on
// module-level state surviving between events — anything that must persist is
// read back from storage. `storage.sync` holds user settings; `storage.session`
// holds the ephemeral tab history, which should not sync across devices.

// Icon paths
const ICONS = {
  inactive: {
    '16': 'images/bird.png',
    '48': 'images/bird.png',
    '128': 'images/bird.png'
  },
  active: {
    '16': 'images/bird-active-16.png',
    '48': 'images/bird-active-48.png',
    '128': 'images/bird-active-128.png'
  }
};

// Keys in storage.sync that are NOT blockable features. Everything else that is
// `true` counts as an enabled feature for the purpose of the icon state. Reading
// storage generically like this means the icon can never fall out of sync with
// the feature list in popup.js the way a hardcoded copy of it did.
// `preEnableAllSnapshot` holds an object rather than a boolean so it could never
// match `=== true` below, but it is listed here so the intent is explicit.
const NON_FEATURE_KEYS = new Set(['selectedSite', 'preEnableAllSnapshot']);

// New tab pages, by browser family. Gecko browsers (Firefox, Zen, LibreWolf,
// Waterfox) use about:newtab / about:home — without those the new tab blocker
// silently does nothing outside Chromium.
const NEW_TAB_URLS = [
  // Chromium family
  'chrome://newtab',
  'edge://newtab',
  'brave://newtab',
  'opera://newtab',
  'vivaldi://newtab',
  'arc://newtab',
  // Gecko family
  'about:newtab',
  'about:home',
  // Both
  'about:blank'
];

// Most-recently-active tabs, newest first. Two entries is enough: the tab the
// user was on, plus a spare in case the newest entry turns out to be the very
// tab we are about to close.
const ACTIVE_TAB_HISTORY_KEY = 'activeTabHistory';
const ACTIVE_TAB_HISTORY_LIMIT = 2;

async function readActiveTabHistory() {
  try {
    const stored = await browserAPI.storage.session.get(ACTIVE_TAB_HISTORY_KEY);
    const history = stored?.[ACTIVE_TAB_HISTORY_KEY];
    return Array.isArray(history) ? history : [];
  } catch (error) {
    // storage.session is unavailable on some builds; fall through to the
    // lastAccessed-based lookup below rather than failing the whole handler.
    console.warn('[Flow] Could not read tab history:', error);
    return [];
  }
}

async function recordActiveTab(tabId) {
  const history = await readActiveTabHistory();
  const next = [tabId, ...history.filter((id) => id !== tabId)]
    .slice(0, ACTIVE_TAB_HISTORY_LIMIT);
  try {
    await browserAPI.storage.session.set({ [ACTIVE_TAB_HISTORY_KEY]: next });
  } catch (error) {
    console.warn('[Flow] Could not persist tab history:', error);
  }
}

// Pick the tab to fall back to when closing a new tab.
async function resolveTargetTab(excludeTabId) {
  const history = await readActiveTabHistory();

  for (const tabId of history) {
    if (tabId === excludeTabId) continue;
    try {
      // Confirm it still exists — a remembered tab may have been closed.
      await browserAPI.tabs.get(tabId);
      return tabId;
    } catch (error) {
      // Stale entry; try the next one.
    }
  }

  // No usable history (typically because the background was restarted). Fall
  // back to the most recently *accessed* tab. tabs.query returns tab-strip
  // order, not recency, so sort explicitly instead of taking the first result.
  const tabs = await browserAPI.tabs.query({ currentWindow: true });
  const candidates = tabs
    .filter((t) => t.id !== excludeTabId)
    .sort((a, b) => (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0));

  return candidates.length > 0 ? candidates[0].id : null;
}

// Track the last active tab
browserAPI.tabs.onActivated.addListener(async function (activeInfo) {
  try {
    if (activeInfo && typeof activeInfo.tabId === 'number') {
      await recordActiveTab(activeInfo.tabId);
    }
  } catch (error) {
    console.error('[Flow] Error tracking active tab:', error);
  }
});

// Handle new tab creation
browserAPI.tabs.onCreated.addListener(async function (tab) {
  // Guard: ensure tab exists and has valid ID
  if (!tab || typeof tab.id !== 'number') {
    console.warn('[Flow] Invalid tab object in onCreated');
    return;
  }

  try {
    // Read the setting per-event rather than from a module-level cache. The
    // background may have just been restarted *by* this event, in which case a
    // cached value would still be at its default and the tab would slip through.
    const { newTabBlockerEnabled } = await browserAPI.storage.sync.get('newTabBlockerEnabled');
    if (newTabBlockerEnabled !== true) return;

    const isNewTab = NEW_TAB_URLS.some((url) =>
      tab.pendingUrl?.startsWith(url) || tab.url?.startsWith(url)
    );
    if (!isNewTab) return;

    const targetTabId = await resolveTargetTab(tab.id);

    // If there's no other tab, keep the new tab open rather than leaving the
    // user with no tab at all.
    if (targetTabId === null) return;

    await browserAPI.tabs.update(targetTabId, { active: true });
    await browserAPI.tabs.remove(tab.id);
  } catch (error) {
    // Ignore errors if tab was already closed or doesn't exist
    console.error('[Flow] Error handling tab:', error);
  }
});

// ============================================================================
// Icon System
// ============================================================================

// Last icon state we set, used to avoid redundant setIcon calls within a single
// background lifetime. Losing this on restart is harmless — worst case we set
// the same icon again.
let currentIconState = null;

async function updateIcon() {
  try {
    // `null` returns the entire storage area, so no feature list is needed here.
    const settings = await browserAPI.storage.sync.get(null);

    const isActive = Object.entries(settings).some(
      ([key, value]) => value === true && !NON_FEATURE_KEYS.has(key)
    );
    const newState = isActive ? 'active' : 'inactive';

    if (newState === currentIconState) return;

    await browserAPI.action.setIcon({ path: ICONS[newState] });
    currentIconState = newState;
  } catch (error) {
    console.error('[Flow] Error in updateIcon:', error);
  }
}

// Listen for changes to settings
browserAPI.storage.onChanged.addListener(function (changes, areaName) {
  // Tab history lives in storage.session and has no bearing on the icon.
  if (areaName === 'session') return;
  updateIcon();
});

// Initialize icon on startup
updateIcon();
