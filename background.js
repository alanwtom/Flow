// Browser compatibility
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

// Background script for handling new tab blocking and site blocking
let newTabBlockerEnabled = false;

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

// Current icon state (avoid unnecessary updates)
let currentIconState = null;

// Granular feature keys for each site (for counting active features)
const SITE_FEATURES = {
  youtube: ['yt_homepage', 'yt_shorts', 'yt_sidebar', 'yt_comments', 'yt_endcards', 'yt_chat', 'yt_notifications', 'yt_create_button', 'yt_autoplay'],
  reddit: ['reddit_feed', 'reddit_recent', 'reddit_comments', 'reddit_right_sidebar', 'reddit_nav']
};

// Initialize settings from storage
browserAPI.storage.sync.get(['newTabBlockerEnabled'], function(result) {
  try {
    newTabBlockerEnabled = result.newTabBlockerEnabled === true;
    updateIcon();
  } catch (error) {
    console.error('[Flow] Error initializing settings:', error);
  }
}).catch(error => {
  console.error('[Flow] Storage read failed during initialization:', error);
});

// Listen for changes to settings
browserAPI.storage.onChanged.addListener(function(changes, namespace) {
  try {
    if (changes.newTabBlockerEnabled) {
      newTabBlockerEnabled = changes.newTabBlockerEnabled.newValue;
    }
    // Update icon when any setting changes
    updateIcon();
  } catch (error) {
    console.error('[Flow] Error handling storage change:', error);
  }
});

// Track the last active tab
let lastActiveTabId = null;

// Update the last active tab when tabs change
browserAPI.tabs.onActivated.addListener(function(activeInfo) {
  try {
    if (activeInfo && activeInfo.tabId) {
      lastActiveTabId = activeInfo.tabId;
    }
  } catch (error) {
    console.error('[Flow] Error tracking active tab:', error);
  }
});

// Handle new tab creation
browserAPI.tabs.onCreated.addListener(async function(tab) {
  // Only block if the feature is enabled
  if (!newTabBlockerEnabled) return;

  // Guard: ensure tab exists and has valid ID
  if (!tab || !tab.id) {
    console.warn('[Flow] Invalid tab object in onCreated');
    return;
  }

  // Check if this is a new tab or about:blank
  const newTabUrls = [
    'chrome://newtab',
    'edge://newtab',
    'brave://newtab',
    'opera://newtab',
    'vivaldi://newtab',
    'arc://newtab',
    'about:blank'
  ];

  // Immediately close the tab if it matches any new tab URL
  const isNewTab = newTabUrls.some((url) =>
    tab.pendingUrl?.startsWith(url) || tab.url?.startsWith(url)
  );
  if (isNewTab) {
    try {
      let targetTabId = lastActiveTabId;

      // If we don't have a last active tab (e.g., on startup), try to find another tab
      if (targetTabId === null) {
        const allTabs = await browserAPI.tabs.query({ currentWindow: true });
        // Filter out the new tab we're about to close
        const otherTabs = allTabs.filter(t => t.id !== tab.id);
        if (otherTabs.length > 0) {
          // Use the most recently active tab
          targetTabId = otherTabs[0].id;
        }
      }

      // Only close the tab if we have a valid tab to switch to
      if (targetTabId !== null) {
        await browserAPI.tabs.update(targetTabId, { active: true });
        await browserAPI.tabs.remove(tab.id);
      }
      // If there's no other tab, keep the new tab open rather than leaving user with no tab
    } catch (error) {
      // Ignore errors if tab was already closed or doesn't exist
      console.error('[Flow] Error handling tab:', error);
    }
  }
});

// ============================================================================
// Icon System
// ============================================================================

function updateIcon() {
  // Get all granular feature keys
  const allFeatureKeys = Object.values(SITE_FEATURES).flat();
  const storageKeys = [...allFeatureKeys, 'newTabBlockerEnabled'];

  browserAPI.storage.sync.get(storageKeys, function(result) {
    try {
      // Count active granular features per site
      let activeFeaturesCount = 0;

      for (const [site, features] of Object.entries(SITE_FEATURES)) {
        const siteActiveFeatures = features.filter(f => result[f] === true);
        if (siteActiveFeatures.length > 0) {
          activeFeaturesCount += siteActiveFeatures.length;
        }
      }

      const newTabActive = result.newTabBlockerEnabled === true;
      const totalActive = activeFeaturesCount + (newTabActive ? 1 : 0);

      // Determine if any features are active
      const isActive = totalActive > 0;
      const newState = isActive ? 'active' : 'inactive';

      // Only update if changed (prevents flicker)
      if (newState !== currentIconState) {
        browserAPI.action.setIcon({ path: ICONS[newState] }).catch(err => {
          console.error('[Flow] Failed to set icon:', err);
        });
        currentIconState = newState;
      }
    } catch (error) {
      console.error('[Flow] Error in updateIcon:', error);
    }
  }).catch(error => {
    console.error('[Flow] Storage read failed in updateIcon:', error);
  });
}

// Initialize icon on startup
updateIcon();
