// Browser compatibility
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

(function() {
  const FEATURE_DEFAULTS = {
    x_feed: true,
    x_trends: true,
    x_follow: true,
    x_nav: false,
    x_account_card: false,
  };

  const X_FEATURES = ['x_feed', 'x_trends', 'x_follow', 'x_nav', 'x_account_card'];
  let enabledFeatures = new Set();

  function applyXBlocking() {
    const isHome = window.location.pathname === '/home' || window.location.pathname === '/';

    // 1. Home Feed
    if (enabledFeatures.has('x_feed') && isHome) {
      document.documentElement.classList.add('x-block-feed');
      // Hide using JS as well
      document.querySelectorAll('[aria-label="Timeline: Your Home Timeline"], [data-testid="primaryColumn"] section').forEach(el => {
        el.style.display = 'none';
        el.setAttribute('data-flow-blocked', 'feed');
      });
    } else {
      document.documentElement.classList.remove('x-block-feed');
      document.querySelectorAll('[data-flow-blocked="feed"]').forEach(el => {
        el.style.display = '';
        el.removeAttribute('data-flow-blocked');
      });
    }

    // 2. Trends
    if (enabledFeatures.has('x_trends')) {
      document.documentElement.classList.add('x-block-trends');
      document.querySelectorAll('[aria-label="Timeline: Trending now"], [data-testid="sidebarColumn"] [data-testid="trend"]').forEach(el => {
        el.style.display = 'none';
        el.setAttribute('data-flow-blocked', 'trends');
      });
      // Also hide parent section containing trends
      document.querySelectorAll('[data-testid="sidebarColumn"] section').forEach(el => {
        if (el.querySelector('[href*="/trends"]') || el.querySelector('[data-testid="trend"]')) {
          el.style.display = 'none';
          el.setAttribute('data-flow-blocked', 'trends-section');
        }
      });
    } else {
      document.documentElement.classList.remove('x-block-trends');
      document.querySelectorAll('[data-flow-blocked="trends"], [data-flow-blocked="trends-section"]').forEach(el => {
        el.style.display = '';
        el.removeAttribute('data-flow-blocked');
      });
    }

    // 3. Who to Follow
    if (enabledFeatures.has('x_follow')) {
      document.documentElement.classList.add('x-block-follow');
      document.querySelectorAll('[aria-label="Who to follow"], [data-testid="sidebarColumn"] aside').forEach(el => {
        el.style.display = 'none';
        el.setAttribute('data-flow-blocked', 'follow');
      });
    } else {
      document.documentElement.classList.remove('x-block-follow');
      document.querySelectorAll('[data-flow-blocked="follow"]').forEach(el => {
        el.style.display = '';
        el.removeAttribute('data-flow-blocked');
      });
    }

    // 4. Navigation Links (Hides everything except Home, Explore, Messages, Profile, and compose button)
    if (enabledFeatures.has('x_nav')) {
      document.documentElement.classList.add('x-block-nav');
      document.querySelectorAll('header[role="banner"] nav a').forEach(el => {
        const testId = el.getAttribute('data-testid');
        const keepIds = [
          'AppTabBar_Home_Link',
          'AppTabBar_Explore_Link',
          'AppTabBar_DirectMessage_Link',
          'AppTabBar_Profile_Link',
          'SideNav_NewTweet_Button'
        ];
        if (!keepIds.includes(testId)) {
          el.style.display = 'none';
          el.setAttribute('data-flow-blocked', 'nav-item');
        }
      });
    } else {
      document.documentElement.classList.remove('x-block-nav');
      document.querySelectorAll('[data-flow-blocked="nav-item"]').forEach(el => {
        el.style.display = '';
        el.removeAttribute('data-flow-blocked');
      });
    }

    // 5. Account Card (PFP & Handle Switcher)
    if (enabledFeatures.has('x_account_card')) {
      document.documentElement.classList.add('x-block-account-card');
      document.querySelectorAll('[data-testid="SideNav_AccountSwitcher_Button"]').forEach(el => {
        el.style.display = 'none';
        el.setAttribute('data-flow-blocked', 'account-card');
      });
    } else {
      document.documentElement.classList.remove('x-block-account-card');
      document.querySelectorAll('[data-flow-blocked="account-card"]').forEach(el => {
        el.style.display = '';
        el.removeAttribute('data-flow-blocked');
      });
    }
  }

  function updateBlocking() {
    browserAPI.storage.sync.get(X_FEATURES, function(result) {
      enabledFeatures.clear();
      X_FEATURES.forEach(featureKey => {
        const storedValue = result[featureKey];
        const defaultValue = FEATURE_DEFAULTS[featureKey];
        const isEnabled = storedValue !== undefined ? storedValue : defaultValue;

        if (isEnabled) {
          enabledFeatures.add(featureKey);
        }
      });
      applyXBlocking();
    }).catch(error => {
      console.error('[Flow] Storage read failed, using defaults:', error);
      enabledFeatures.clear();
      X_FEATURES.forEach(featureKey => {
        if (FEATURE_DEFAULTS[featureKey]) {
          enabledFeatures.add(featureKey);
        }
      });
      applyXBlocking();
    });
  }

  // Listen for storage changes
  browserAPI.storage.onChanged.addListener(function(changes, namespace) {
    const hasRelevantChange = X_FEATURES.some(key => changes[key]);
    if (hasRelevantChange) {
      updateBlocking();
    }
  });

  // MutationObserver to continuously handle SPA updates and dynamic routing
  let observer = null;
  let debounceTimer = null;

  function startBlockingObserver() {
    if (observer) return;

    if (!document.body) {
      return;
    }

    let lastPathname = window.location.pathname;
    
    function checkPathnameChange() {
      if (window.location.pathname !== lastPathname) {
        lastPathname = window.location.pathname;
        applyXBlocking();
      }
    }

    observer = new MutationObserver((mutations) => {
      checkPathnameChange();
      
      if (enabledFeatures.size === 0) return;

      let hasNewNodes = false;
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === 1) {
            hasNewNodes = true;
          }
        });
      });

      if (hasNewNodes) {
        if (debounceTimer) return;
        debounceTimer = setTimeout(() => {
          applyXBlocking();
          debounceTimer = null;
        }, 50);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    window.addEventListener('beforeunload', () => {
      if (observer) {
        observer.disconnect();
        observer = null;
      }
    });
  }

  function initWhenReady() {
    if (document.body) {
      updateBlocking();
      startBlockingObserver();
    } else {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          updateBlocking();
          startBlockingObserver();
        });
      } else {
        setTimeout(() => {
          updateBlocking();
          startBlockingObserver();
        }, 100);
      }
    }
  }

  initWhenReady();
})();
