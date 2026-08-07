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
    loadSettings(function(result) {
      if (site === 'global') {
        globalBlockerCheckbox.checked = areAllBlockersEnabled(result);
      }
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
    browserAPI.storage.sync.get(allKeys, (result) => {
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

  // Load all settings
  function loadSettings(callback) {
    // Get all granular feature keys for checking if features are enabled
    const allFeatureKeys = Object.values(SUB_OPTIONS)
      .flatMap(siteOptions => Object.values(siteOptions).flat())
      .map(opt => opt.key);
    browserAPI.storage.sync.get([...allFeatureKeys, 'selectedSite', 'newTabBlockerEnabled'], function(result) {
      callback(result);
    });
  }

  // Check if all site blockers are enabled
  // Returns true if the main/default feature for each site is enabled
  function areAllBlockersEnabled(result) {
    // For each site, check if its main/default feature (first in Feeds category) is enabled
    for (const site of allSites) {
      const categories = SUB_OPTIONS[site];
      if (categories && categories['Feeds'] && categories['Feeds'].length > 0) {
        const mainFeature = categories['Feeds'][0]; // First feature is the main one (feed/FYP)
        if (result[mainFeature.key] !== true) {
          return false;
        }
      }
    }
    return true;
  }

  // Load saved settings and initialize UI
  loadSettings(function(result) {
    // First, detect if we're on a supported site
    browserAPI.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      let selectedSite = result.selectedSite || 'global';

      // Check for errors and fall back to stored site
      if (browserAPI.runtime.lastError) {
        console.warn('[Flow] Could not access active tab:', browserAPI.runtime.lastError.message);
      } else if (tabs[0]) {
        // Auto-detect site and switch to it
        const detectedSite = detectSiteFromUrl(tabs[0].url);
        if (detectedSite) {
          selectedSite = detectedSite;
        }
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
    });
  });

  // Global blocker: enables/disables all site blockers, their sub-options, and new tab blocker
  globalBlockerCheckbox.addEventListener('change', function() {
    const enabled = this.checked;
    allSites.forEach(site => {
      // Enable/disable all sub-options for this site
      const categories = SUB_OPTIONS[site] || {};
      Object.values(categories).flat().forEach(opt => {
        debouncedStorageWrite(opt.key, enabled);
      });
    });
    // Also enable/disable the new tab blocker
    newTabBlockerCheckbox.checked = enabled;
    debouncedStorageWrite('newTabBlockerEnabled', enabled);
  });

  // New tab blocker
  newTabBlockerCheckbox.addEventListener('change', function() {
    debouncedStorageWrite('newTabBlockerEnabled', this.checked);
  });

  // Flush pending writes when popup closes
  window.addEventListener('beforeunload', function() {
    flushPendingWrites();
  });
});
