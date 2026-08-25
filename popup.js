// Browser compatibility
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

// Pending storage writes map (must be declared before functions that use it)
let pendingStorageWrites = new Map();

// Debounce utility - delays function execution until after wait milliseconds
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Write to storage with debouncing to coalesce rapid changes (150ms)
function debouncedStorageWrite(key, value) {
  if (pendingStorageWrites.has(key)) {
    clearTimeout(pendingStorageWrites.get(key).timeoutId);
  }

  const timeoutId = setTimeout(() => {
    browserAPI.storage.sync.set({ [key]: value }).catch(error => {
      console.error('[Flow] Failed to save setting:', key, error);
    });
    pendingStorageWrites.delete(key);
  }, 150);

  pendingStorageWrites.set(key, { value, timeoutId });
}

// Drop queued debounced writes without committing them. Used ahead of a bulk
// write that supersedes them, so a toggle made moments earlier cannot land
// after the bulk value and undo it.
function clearPendingWrites() {
  pendingStorageWrites.forEach(data => clearTimeout(data.timeoutId));
  pendingStorageWrites.clear();
}

// Flush any pending storage writes (called on popup close)
function flushPendingWrites() {
  pendingStorageWrites.forEach((data, key) => {
    clearTimeout(data.timeoutId);
    browserAPI.storage.sync.set({ [key]: data.value }).catch(error => {
      console.error('[Flow] Failed to flush setting:', key, error);
    });
  });
  pendingStorageWrites.clear();
}

// Granular blocking options configuration - organized by category
const SUB_OPTIONS = {
  youtube: {
    'Feeds': [
      { key: 'yt_homepage', label: 'Hide Homepage Feed', default: true },
      { key: 'yt_shorts', label: 'Hide Shorts', default: true },
      { key: 'yt_posts', label: 'Hide Community Posts', default: true },
      { key: 'yt_playables', label: 'Hide Playables (Mini-Games)', default: false }
    ],
    'Watch Page': [
      { key: 'yt_sidebar', label: 'Hide Sidebar (Up Next)', default: true },
      { key: 'yt_comments', label: 'Hide Comments', default: false },
      { key: 'yt_endcards', label: 'Hide End Cards', default: false },
      { key: 'yt_chat', label: 'Hide Live Chat', default: false }
    ],
    'Other': [
      { key: 'yt_notifications', label: 'Hide Notifications', default: false },
      { key: 'yt_create_button', label: 'Hide Create Button', default: false },
      { key: 'yt_autoplay', label: 'Hide Autoplay Toggle', default: false }
    ]
  },
  reddit: {
    'Feeds': [
      { key: 'reddit_feed', label: 'Hide Home Feed', default: true },
      { key: 'reddit_recent', label: 'Hide Recent Posts', default: false }
    ],
    'Post View': [
      { key: 'reddit_comments', label: 'Hide Comments', default: false },
      { key: 'reddit_right_sidebar', label: 'Hide Right Sidebar', default: false }
    ],
    'Navigation': [
      { key: 'reddit_nav', label: 'Hide Nav Bar (except search)', default: false }
    ]
  },
  x: {
    'Feeds': [
      { key: 'x_feed', label: 'Hide Home Feed', default: true }
    ],
    'Sidebar Widgets': [
      { key: 'x_trends', label: 'Hide Trends (What\'s happening)', default: true },
      { key: 'x_follow', label: 'Hide Who to Follow', default: true }
    ],
    'Navigation': [
      { key: 'x_nav', label: 'Hide Navigation Tabs', default: false },
      { key: 'x_account_card', label: 'Hide Account Card (PFP & Handle)', default: false }
    ]
  }
};

// Display names for dropdown
const siteDisplayNames = {
  global: 'Global Settings',
  youtube: 'YouTube',
  reddit: 'Reddit',
  x: 'X / Twitter'
};

// All site keys
const allSites = ['youtube', 'reddit', 'x'];

// Every blockable feature key, flattened out of SUB_OPTIONS.
const ALL_FEATURE_KEYS = Object.values(SUB_OPTIONS)
  .flatMap(siteOptions => Object.values(siteOptions).flat())
  .map(opt => opt.key);

// The effective value of a feature key that storage has no entry for yet.
const FEATURE_DEFAULTS = Object.fromEntries(
  Object.values(SUB_OPTIONS)
    .flatMap(siteOptions => Object.values(siteOptions).flat())
    .map(opt => [opt.key, opt.default])
);

// Where the pre-"Enable All Blockers" state is parked so that toggle stays
// reversible. See the change handler at the bottom of this file.
const SNAPSHOT_KEY = 'preEnableAllSnapshot';

// Current selected site
let currentSelectedSite = 'global';

// Operation tracking for preventing race conditions
let pendingRenderId = 0;

// Site detection configuration
const SITE_HOSTS = {
  youtube: ['youtube.com', 'www.youtube.com', 'm.youtube.com'],
  reddit: ['reddit.com', 'www.reddit.com', 'old.reddit.com'],
  x: ['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com']
};

// Detect site from URL
function detectSiteFromUrl(url) {
  if (!url) return null;
  try {
    const hostname = new URL(url).hostname;
    for (const [site, hosts] of Object.entries(SITE_HOSTS)) {
      if (hosts.some(host => hostname === host || hostname.endsWith('.' + host))) {
        return site;
      }
    }
  } catch (e) {}
  return null;
}

// Popup script to handle UI interactions and settings
document.addEventListener('DOMContentLoaded', function() {
  const globalBlockerCheckbox = document.getElementById('global-blocker');
  const newTabBlockerCheckbox = document.getElementById('new-tab-blocker');
  const dropdownTrigger = document.getElementById('dropdown-trigger');
  const dropdownMenu = document.getElementById('dropdown-menu');
  const dropdownSelected = document.getElementById('dropdown-selected');
  const dropdownItems = document.querySelectorAll('.dropdown-item');
  const globalSettings = document.getElementById('global-settings');
  const individualSetting = document.getElementById('individual-setting');
  const subOptionsContainer = document.getElementById('sub-options');

  // Toggle dropdown
  dropdownTrigger.addEventListener('click', function(e) {
    e.stopPropagation();
    const isOpen = dropdownTrigger.classList.contains('open');
    if (isOpen) {
      closeDropdown();
    } else {
      openDropdown();
    }
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', function(e) {
    if (!e.target.closest('#site-dropdown')) {
      closeDropdown();
    }
  });

  // Handle dropdown item selection
  dropdownItems.forEach(item => {
    item.addEventListener('click', function() {
      const value = this.getAttribute('data-value');
      selectSite(value);
      closeDropdown();
    });
  });

  function openDropdown() {
    dropdownTrigger.classList.add('open');
    dropdownMenu.classList.add('open');
  }

  function closeDropdown() {
    dropdownTrigger.classList.remove('open');
    dropdownMenu.classList.remove('open');
  }

  function selectSite(site) {
    // Prevent redundant re-renders
    if (site === currentSelectedSite) {
      return;
    }

    // Cancel any pending render operation
    pendingRenderId++;
    currentSelectedSite = site;

    // Update display immediately
    dropdownSelected.textContent = siteDisplayNames[site];

    // Update selected item in dropdown
    dropdownItems.forEach(item => {
      if (item.getAttribute('data-value') === site) {
        item.classList.add('selected');
      } else {
        item.classList.remove('selected');
      }
    });

    // Save to storage
    browserAPI.storage.sync.set({ selectedSite: site });

    // Update view
    updateView(site);

    // Render sub-options with cancellation support
    if (site !== 'global') {
      renderSubOptions(site, pendingRenderId);
    }

    // Load appropriate state
    loadSettings().then(result => {
      if (site === 'global') {
        globalBlockerCheckbox.checked = areAllBlockersEnabled(result);
      }
    }).catch(error => {
      console.error('[Flow] Failed to load settings:', error);
    });
  }

  // Render sub-options for a site with categories
  function renderSubOptions(site, renderId) {
    const currentRenderId = renderId;

    const categories = SUB_OPTIONS[site] || {};
    const categoryEntries = Object.entries(categories);

    if (categoryEntries.length === 0) return;

    // Flatten options to get all keys for loading
    const allOptions = categoryEntries.flatMap(([_, options]) => options);
    const allKeys = allOptions.map(opt => opt.key);

    // Load all settings at once
    browserAPI.storage.sync.get(allKeys).then((result) => {
      // Check if this render is still valid
      if (renderId !== pendingRenderId) return;

      subOptionsContainer.innerHTML = '';

      const fragment = document.createDocumentFragment();

      categoryEntries.forEach(([categoryName, options]) => {
        // Add category header
        if (categoryEntries.length > 1) {
          const categoryHeader = document.createElement('div');
          categoryHeader.className = 'sub-category-title';
          categoryHeader.textContent = categoryName;
          fragment.appendChild(categoryHeader);
        }

        options.forEach(opt => {
          const div = document.createElement('div');
          div.className = 'sub-option';
          div.innerHTML = `
            <label>
              <span class="checkbox-container">
                <input type="checkbox" data-key="${opt.key}">
                <span class="checkmark"></span>
              </span>
              <span class="sub-option-label">${opt.label}</span>
            </label>
          `;

          const checkbox = div.querySelector(`input[data-key="${opt.key}"]`);
          // Use default if not set
          checkbox.checked = result[opt.key] !== undefined ? result[opt.key] === true : opt.default;

          // Add change listener with debounced storage write
          checkbox.addEventListener('change', () => {
            debouncedStorageWrite(opt.key, checkbox.checked);
          });

          fragment.appendChild(div);
        });
      });

      // One final check before appending
      if (renderId === pendingRenderId) {
        subOptionsContainer.appendChild(fragment);
      }
    }).catch(error => {
      console.error('[Flow] Failed to render options for', site, error);
    });
  }

  // Show/hide appropriate sections based on selection
  function updateView(site) {
    if (site === 'global') {
      globalSettings.classList.add('active');
      individualSetting.classList.remove('active');
    } else {
      globalSettings.classList.remove('active');
      individualSetting.classList.add('active');
    }
  }

  // Load all settings. Promise-based rather than callback-based: Firefox's
  // `browser.*` namespace is promise-only and silently ignores a callback.
  function loadSettings() {
    return browserAPI.storage.sync.get([
      ...ALL_FEATURE_KEYS,
      'selectedSite',
      'newTabBlockerEnabled'
    ]);
  }

  // Check if all site blockers are enabled.
  // Mirrors exactly what the "Enable All Blockers" toggle writes: every
  // sub-option on every site, plus the new tab blocker. This previously only
  // read the first "Feeds" option per site while the toggle wrote all of them,
  // so unchecking any other option left the box still showing as checked.
  function areAllBlockersEnabled(result) {
    return ALL_FEATURE_KEYS.every(key => result[key] === true)
      && result.newTabBlockerEnabled === true;
  }

  // Load saved settings and initialize UI
  (async function initialize() {
    let result;
    try {
      result = await loadSettings();
    } catch (error) {
      console.error('[Flow] Could not load settings:', error);
      return;
    }

    let selectedSite = result.selectedSite || 'global';

    // Auto-detect the site from the active tab, falling back to the stored
    // selection if the tab is not readable.
    try {
      const tabs = await browserAPI.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]) {
        const detectedSite = detectSiteFromUrl(tabs[0].url);
        if (detectedSite) {
          selectedSite = detectedSite;
        }
      }
    } catch (error) {
      console.warn('[Flow] Could not access active tab:', error);
    }

    currentSelectedSite = selectedSite;

    // Update dropdown display
    dropdownSelected.textContent = siteDisplayNames[selectedSite];

    // Update selected item in dropdown
    dropdownItems.forEach(item => {
      if (item.getAttribute('data-value') === selectedSite) {
        item.classList.add('selected');
      } else {
        item.classList.remove('selected');
      }
    });

    // Update view
    updateView(selectedSite);

    // Render sub-options for individual sites
    if (selectedSite !== 'global') {
      renderSubOptions(selectedSite, pendingRenderId);
    }

    // Load new tab blocker state
    newTabBlockerCheckbox.checked = result.newTabBlockerEnabled === true;

    // For global mode, set the global blocker checkbox
    if (selectedSite === 'global') {
      globalBlockerCheckbox.checked = areAllBlockersEnabled(result);
    }
  })();

  // Global blocker: turns on every site blocker plus the new tab blocker, and
  // remembers the state it replaced so that unchecking *restores* that state
  // rather than wiping everything to false. Without the snapshot this toggle is
  // destructive and unrecoverable — one click overwrites every per-site
  // preference across all three sites with no undo.
  globalBlockerCheckbox.addEventListener('change', async function() {
    const enabled = this.checked;
    const trackedKeys = [...ALL_FEATURE_KEYS, 'newTabBlockerEnabled'];

    // One bulk set instead of ~20 debounced writes: it supersedes anything
    // already queued, and costs a single storage.sync write against quota.
    clearPendingWrites();

    try {
      if (enabled) {
        const current = await browserAPI.storage.sync.get(trackedKeys);

        // Record the *effective* value of each key. A key with no stored entry
        // is sitting at its default, and snapshotting it as false would
        // silently flip its behaviour when restored.
        const snapshot = {};
        ALL_FEATURE_KEYS.forEach(key => {
          snapshot[key] = current[key] !== undefined
            ? current[key] === true
            : FEATURE_DEFAULTS[key] === true;
        });
        snapshot.newTabBlockerEnabled = current.newTabBlockerEnabled === true;

        const allOn = {};
        trackedKeys.forEach(key => { allOn[key] = true; });

        await browserAPI.storage.sync.set({ ...allOn, [SNAPSHOT_KEY]: snapshot });
        newTabBlockerCheckbox.checked = true;
      } else {
        const stored = await browserAPI.storage.sync.get(SNAPSHOT_KEY);
        const snapshot = stored?.[SNAPSHOT_KEY];
        const restored = {};

        trackedKeys.forEach(key => {
          if (snapshot && snapshot[key] !== undefined) {
            restored[key] = snapshot[key] === true;
          } else {
            // No snapshot at all (fresh profile, or already consumed), or a
            // feature added by an update after the snapshot was taken. Fall
            // back to that key's default, which for newTabBlockerEnabled and
            // any unknown key is false — the original behaviour.
            restored[key] = FEATURE_DEFAULTS[key] === true;
          }
        });

        await browserAPI.storage.sync.set(restored);
        if (snapshot) {
          // Consumed; the next enable takes a fresh one.
          await browserAPI.storage.sync.remove(SNAPSHOT_KEY);
        }
        newTabBlockerCheckbox.checked = restored.newTabBlockerEnabled;
      }
    } catch (error) {
      console.error('[Flow] Failed to apply "Enable All Blockers":', error);
    }
  });

  // New tab blocker
  newTabBlockerCheckbox.addEventListener('change', function() {
    debouncedStorageWrite('newTabBlockerEnabled', this.checked);
  });

  // Flush pending writes when the popup goes away. `beforeunload` is not
  // reliably dispatched for extension popups, so a toggle followed by an
  // immediate dismissal could be lost inside the 150ms debounce window.
  // `pagehide` fires on teardown and `visibilitychange` covers dismissal paths
  // that skip it; flushPendingWrites clears the queue, so a double call is a
  // no-op.
  window.addEventListener('pagehide', flushPendingWrites);
  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'hidden') {
      flushPendingWrites();
    }
  });
});
