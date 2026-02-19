// Browser compatibility
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

// Granular blocking options configuration - organized by category
const SUB_OPTIONS = {
  youtube: {
    'Feeds': [
      { key: 'yt_homepage', label: 'Homepage Feed', default: true },
      { key: 'yt_shorts', label: 'Shorts', default: true }
    ],
    'Watch Page': [
      { key: 'yt_sidebar', label: 'Sidebar (Up Next)', default: true },
      { key: 'yt_comments', label: 'Comments', default: false },
      { key: 'yt_endcards', label: 'End Cards', default: false },
      { key: 'yt_chat', label: 'Live Chat', default: false }
    ],
    'Other': [
      { key: 'yt_notifications', label: 'Notifications', default: false },
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

// Site configuration
const siteLabels = {
  youtube: 'Block FYP',
  reddit: 'Block Recommendations',
  twitter: 'Block For You'
};

// Display names for dropdown
const siteDisplayNames = {
  global: 'Global Settings',
  youtube: 'YouTube',
  reddit: 'Reddit',
  twitter: 'Twitter'
};

// All site keys
const allSites = Object.keys(siteLabels);

// Current selected site
let currentSelectedSite = 'global';

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
  const siteBlockerCheckbox = document.getElementById('site-blocker');
  const globalBlockerCheckbox = document.getElementById('global-blocker');
  const newTabBlockerCheckbox = document.getElementById('new-tab-blocker');
  const dropdownTrigger = document.getElementById('dropdown-trigger');
  const dropdownMenu = document.getElementById('dropdown-menu');
  const dropdownSelected = document.getElementById('dropdown-selected');
  const dropdownItems = document.querySelectorAll('.dropdown-item');
  const blockLabel = document.getElementById('block-label');
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
    currentSelectedSite = site;

    // Update display
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

    // Render sub-options for individual sites
    if (site !== 'global') {
      renderSubOptions(site);
    }

    // Load appropriate state
    loadSettings(function(result) {
      if (site === 'global') {
        globalBlockerCheckbox.checked = areAllBlockersEnabled(result);
      } else {
        const siteKey = getSiteBlockerKey(site);
        siteBlockerCheckbox.checked = result[siteKey] === true;
      }
    });
  }

  // Render sub-options for a site with categories
  function renderSubOptions(site) {
    subOptionsContainer.innerHTML = '';

    const categories = SUB_OPTIONS[site] || {};
    const categoryEntries = Object.entries(categories);

    if (categoryEntries.length === 0) return;

    // Flatten options to get all keys for loading
    const allOptions = categoryEntries.flatMap(([_, options]) => options);
    const allKeys = allOptions.map(opt => opt.key);

    // Load all settings at once
    browserAPI.storage.sync.get(allKeys, (result) => {
      categoryEntries.forEach(([categoryName, options]) => {
        // Add category header
        if (categoryEntries.length > 1) {
          const categoryHeader = document.createElement('div');
          categoryHeader.className = 'sub-category-title';
          categoryHeader.textContent = categoryName;
          subOptionsContainer.appendChild(categoryHeader);
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

          // Add change listener
          checkbox.addEventListener('change', () => {
            browserAPI.storage.sync.set({ [opt.key]: checkbox.checked });
          });

          subOptionsContainer.appendChild(div);
        });
      });
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
      // Update label for individual site
      blockLabel.textContent = siteLabels[site];
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
        renderSubOptions(selectedSite);
      }

      // Load new tab blocker state
      newTabBlockerCheckbox.checked = result.newTabBlockerEnabled === true;

      // For global mode, set the global blocker checkbox
      if (selectedSite === 'global') {
        globalBlockerCheckbox.checked = areAllBlockersEnabled(result);
      } else {
        // Load the toggle state for the selected site
        const siteKey = getSiteBlockerKey(selectedSite);
        siteBlockerCheckbox.checked = result[siteKey] === true;
      }
    });
  });

  // Global blocker: enables/disables all site blockers
  globalBlockerCheckbox.addEventListener('change', function() {
    const state = {};
    allSites.forEach(site => {
      state[getSiteBlockerKey(site)] = this.checked;
    });
    browserAPI.storage.sync.set(state);
  });

  // Individual site blocker
  siteBlockerCheckbox.addEventListener('change', function() {
    const siteKey = getSiteBlockerKey(currentSelectedSite);
    const state = {};
    state[siteKey] = this.checked;
    browserAPI.storage.sync.set(state);
  });

  // New tab blocker
  newTabBlockerCheckbox.addEventListener('change', function() {
    browserAPI.storage.sync.set({ newTabBlockerEnabled: this.checked });
  });
});
