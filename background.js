// Browser compatibility
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

// Background script for handling new tab blocking and site blocking
let newTabBlockerEnabled = false;

// Badge configuration
const BADGE_COLORS = {
  green: '#34A853',   // Active/enabled
  red: '#EA4335',     // Blocking occurred
  blue: '#4285F4',    // Multiple features active
  gray: '#808080'     // Disabled
};

// Current badge state (avoid unnecessary updates)
let currentBadgeText = '';
let currentBadgeColor = '';

// Granular feature keys for each site (for badge counting)
const SITE_FEATURES = {
  youtube: ['yt_homepage', 'yt_shorts', 'yt_sidebar', 'yt_comments', 'yt_endcards', 'yt_chat', 'yt_notifications', 'yt_create_button', 'yt_autoplay'],
  reddit: ['reddit_feed', 'reddit_trending', 'reddit_awards', 'reddit_chat', 'reddit_sidebar'],
  twitter: ['twitter_foryou', 'twitter_following', 'twitter_trends', 'twitter_suggestions', 'twitter_communities', 'twitter_topics']
};

// Initialize settings from storage
browserAPI.storage.sync.get(['newTabBlockerEnabled'], function(result) {
  newTabBlockerEnabled = result.newTabBlockerEnabled === true;
  updateBadge();
});

// Listen for changes to settings
browserAPI.storage.onChanged.addListener(function(changes, namespace) {
  if (changes.newTabBlockerEnabled) {
    newTabBlockerEnabled = changes.newTabBlockerEnabled.newValue;
  }
  // Update badge when any setting changes
  updateBadge();
});

// Track the last active tab
let lastActiveTabId = null;

// Update the last active tab when tabs change
browserAPI.tabs.onActivated.addListener(function(activeInfo) {
  lastActiveTabId = activeInfo.tabId;
});

// Handle new tab creation
browserAPI.tabs.onCreated.addListener(async function(tab) {
  // Only block if the feature is enabled
  if (!newTabBlockerEnabled) return;

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
      // First switch back to the last active tab
      if (lastActiveTabId !== null) {
        await browserAPI.tabs.update(lastActiveTabId, { active: true });
      }

      // Then close the new tab
      await browserAPI.tabs.remove(tab.id);
    } catch (error) {
      // Ignore errors if tab was already closed
      console.error('Error handling tab:', error);
    }
  }
});

// ============================================================================
// Badge System
// ============================================================================

function updateBadge() {
  // Get all granular feature keys
  const allFeatureKeys = Object.values(SITE_FEATURES).flat();
  const storageKeys = [...allFeatureKeys, 'newTabBlockerEnabled'];

  browserAPI.storage.sync.get(storageKeys, function(result) {
    // Count active granular features per site
    let activeFeaturesCount = 0;
    let activeSites = [];

    for (const [site, features] of Object.entries(SITE_FEATURES)) {
      const siteActiveFeatures = features.filter(f => result[f] === true);
      if (siteActiveFeatures.length > 0) {
        activeFeaturesCount += siteActiveFeatures.length;
        activeSites.push(site);
      }
    }

    const newTabActive = result.newTabBlockerEnabled === true;
    const totalActive = activeFeaturesCount + (newTabActive ? 1 : 0);

    let newText = '';
    let newColor = BADGE_COLORS.gray;

    if (totalActive === 0) {
      // All disabled - show nothing
      newText = '';
      newColor = BADGE_COLORS.gray;
    } else if (activeSites.length === 0 && newTabActive) {
      // Only new tab blocker active
      newText = 'NT';
      newColor = BADGE_COLORS.green;
    } else if (activeSites.length === 1 && !newTabActive) {
      // Single site with features - show site code
      const site = activeSites[0];
      newText = site === 'youtube' ? 'YT' : site.substring(0, 2).toUpperCase();
      newColor = BADGE_COLORS.green;
    } else {
      // Multiple sites/features or new tab + site - show count
      newText = totalActive <= 9 ? String(totalActive) : '+';
      newColor = totalActive >= 4 ? BADGE_COLORS.blue : BADGE_COLORS.green;
    }

    // Only update if changed (prevents flicker)
    if (newText !== currentBadgeText || newColor !== currentBadgeColor) {
      browserAPI.action.setBadgeText({ text: newText });
      browserAPI.action.setBadgeBackgroundColor({ color: newColor });
      currentBadgeText = newText;
      currentBadgeColor = newColor;
    }
  });
}

// ============================================================================
// Command Handlers
// ============================================================================

browserAPI.commands.onCommand.addListener(function(command) {
  switch (command) {
    case 'toggle-all':
      toggleAllBlockers();
      break;
    case 'pause-30min':
      pauseBlocking(30);
      break;
    case 'toggle-current-site':
      // Get active tab and toggle its site blocker
      browserAPI.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (tabs[0]) {
          const site = detectSiteFromUrl(tabs[0].url);
          if (site) {
            toggleSiteBlocker(site);
          }
        }
      });
      break;
  }
});

// Detect site from URL
function detectSiteFromUrl(url) {
  if (!url) return null;
  try {
    const hostname = new URL(url).hostname;
    if (hostname.includes('youtube.com')) return 'youtube';
    if (hostname.includes('reddit.com')) return 'reddit';
    if (hostname.includes('twitter.com') || hostname.includes('x.com')) return 'twitter';
  } catch (e) {}
  return null;
}

// Toggle all blockers (enables/disables default features for each site)
function toggleAllBlockers() {
  // Get current state of all features
  const allFeatureKeys = Object.values(SITE_FEATURES).flat();
  browserAPI.storage.sync.get(allFeatureKeys, function(result) {
    // Check if all default features are enabled
    let allDefaultsEnabled = true;
    let anyFeatureEnabled = false;

    for (const features of Object.values(SITE_FEATURES)) {
      // Check first feature (typically the main one like feed/FYP)
      const mainFeature = features[0];
      if (result[mainFeature] !== true) {
        allDefaultsEnabled = false;
      }
      if (features.some(f => result[f] === true)) {
        anyFeatureEnabled = true;
      }
    }

    const newState = !allDefaultsEnabled;
    const updates = {};

    // Set default features (first feature of each site) to the new state
    for (const features of Object.values(SITE_FEATURES)) {
      updates[features[0]] = newState;
    }

    browserAPI.storage.sync.set(updates);

  });
}

// Toggle single site blocker (toggles the main/default feature for that site)
function toggleSiteBlocker(site) {
  const features = SITE_FEATURES[site];
  if (!features) return;

  const mainFeature = features[0]; // First feature is the main one (feed/FYP)
  browserAPI.storage.sync.get([mainFeature], function(result) {
    const newState = !result[mainFeature];
    browserAPI.storage.sync.set({ [mainFeature]: newState });

  });
}

// Pause blocking
function pauseBlocking(minutes) {
  const pausedUntil = Date.now() + (minutes * 60 * 1000);
  browserAPI.storage.sync.set({ pausedUntil: pausedUntil });
}

// Initialize badge on startup
updateBadge();
