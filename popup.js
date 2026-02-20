// Browser compatibility
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

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
    browserAPI.storage.sync.set({ [key]: value });
    pendingStorageWrites.delete(key);
  }, 150);

  pendingStorageWrites.set(key, { value, timeoutId });
}

// Flush any pending storage writes (called on popup close)
function flushPendingWrites() {
  pendingStorageWrites.forEach((data, key) => {
    clearTimeout(data.timeoutId);
    browserAPI.storage.sync.set({ [key]: data.value });
  });
  pendingStorageWrites.clear();
}

// Granular blocking options configuration - organized by category
const SUB_OPTIONS = {
  youtube: {
    'Feeds': [
      { key: 'yt_homepage', label: 'Homepage Feed', default: true },
      { key: 'yt_shorts', label: 'Shorts', default: true },
      { key: 'yt_posts', label: 'Posts', default: true }
    ],
    'Watch Page': [
      { key: 'yt_sidebar', label: 'Sidebar (Up Next)', default: true },
      { key: 'yt_comments', label: 'Comments', default: false },
      { key: 'yt_endcards', label: 'End Cards', default: false },
      { key: 'yt_chat', label: 'Live Chat', default: false }
    ],
    'Other': [
      { key: 'yt_notifications', label: 'Notifications', default: false },
      { key: 'yt_create_button', label: 'Create Button', default: false },
      { key: 'yt_autoplay', label: 'Autoplay', default: false }
    ]
  },
  reddit: {
    'Feeds': [
      { key: 'reddit_feed', label: 'Home Feed', default: true },
      { key: 'reddit_trending', label: 'Trending/Popular', default: false }
    ],
    'Sidebar': [
      { key: 'reddit_sidebar', label: 'Community Suggestions', default: false },
      { key: 'reddit_awards', label: 'Awards', default: false },
      { key: 'reddit_chat', label: 'Chat Widget', default: false }
    ]
  },
  twitter: {
    'Feeds': [
      { key: 'twitter_foryou', label: 'For You Timeline', default: true },
      { key: 'twitter_following', label: 'Following Timeline', default: false }
    ],
    'Sidebar': [
      { key: 'twitter_trends', label: 'Trends', default: false },
      { key: 'twitter_suggestions', label: 'Who to Follow', default: false },
      { key: 'twitter_communities', label: 'Communities', default: false },
      { key: 'twitter_topics', label: 'Topics', default: false }
    ]
  }
};

// Display names for dropdown
const siteDisplayNames = {
  global: 'Global Settings',
  youtube: 'YouTube',
  reddit: 'Reddit',
  twitter: 'Twitter'
};

// All site keys
const allSites = ['youtube', 'reddit', 'twitter'];

// Current selected site
let currentSelectedSite = 'global';

// Operation tracking for preventing race conditions
let pendingRenderId = 0;
let pendingStorageWrites = new Map();

// Site detection configuration
const SITE_HOSTS = {
  youtube: ['youtube.com', 'www.youtube.com', 'm.youtube.com'],
  reddit: ['reddit.com', 'www.reddit.com', 'old.reddit.com'],
  twitter: ['twitter.com', 'x.com', 'mobile.twitter.com']
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

        // Add options for this category
        options.forEach(opt => {
          const div = document.createElement('div');
          div.className = 'option sub-option';
          div.innerHTML = `
            <label class="checkbox-container">
              <input type="checkbox" data-key="${opt.key}">
              <span class="checkmark"></span>
            </label>
            <span class="option-label sub-option-label">${opt.label}</span>
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

  // Get storage key for site blocker
  function getSiteBlockerKey(site) {
    return site + 'BlockerEnabled';
  }

  // Load all settings
  function loadSettings(callback) {
    const keys = allSites.map(site => getSiteBlockerKey(site));
    keys.push('selectedSite', 'newTabBlockerEnabled');
    browserAPI.storage.sync.get(keys, function(result) {
      callback(result);
    });
  }

  // Check if all site blockers are enabled
  function areAllBlockersEnabled(result) {
    return allSites.every(site => result[getSiteBlockerKey(site)] === true);
  }

  // Load saved settings and initialize UI
  loadSettings(function(result) {
    // First, detect if we're on a supported site
    browserAPI.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      let selectedSite = result.selectedSite || 'global';

      // Auto-detect site and switch to it
      if (tabs[0]) {
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

  // Global blocker: enables/disables all site blockers
  globalBlockerCheckbox.addEventListener('change', function() {
    const enabled = this.checked;
    allSites.forEach(site => {
      debouncedStorageWrite(getSiteBlockerKey(site), enabled);
    });
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
