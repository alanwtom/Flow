// Browser compatibility
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

// Site configuration
const siteLabels = {
  youtube: 'Block FYP',
  reddit: 'Block Recommendations',
  twitter: 'Block For You',
  instagram: 'Block Explore',
  tiktok: 'Block For You',
  facebook: 'Block Feed'
};

// Display names for dropdown
const siteDisplayNames = {
  global: 'Global Settings',
  youtube: 'YouTube',
  reddit: 'Reddit',
  twitter: 'Twitter',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  facebook: 'Facebook'
};

// All site keys
const allSites = Object.keys(siteLabels);

// Current selected site
let currentSelectedSite = 'global';

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
    // Set selected site from storage, default to global
    const selectedSite = result.selectedSite || 'global';
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
