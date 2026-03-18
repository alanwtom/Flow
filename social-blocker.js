// Browser compatibility
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

// Default values for each feature (must match popup.js)
const FEATURE_DEFAULTS = {
  reddit_feed: true,
  reddit_recent: false,
  reddit_comments: false,
  reddit_right_sidebar: false,
  reddit_nav: false,
};

// Granular feature configuration per site
const SITE_FEATURES = {
  reddit: {
    hosts: ['reddit.com', 'www.reddit.com', 'old.reddit.com'],
    features: ['reddit_feed', 'reddit_recent', 'reddit_comments', 'reddit_right_sidebar', 'reddit_nav'],
    classPrefix: 'reddit-block'
  }
};

// Store enabled features for JS-based blocking
let enabledFeatures = new Set();

// Detect current site from URL
function detectSite() {
  const hostname = window.location.hostname;
  for (const [site, config] of Object.entries(SITE_FEATURES)) {
    if (config.hosts.some(host => hostname === host || hostname.endsWith('.' + host))) {
      return site;
    }
  }
  return null;
}

// ============================================================================
// Reddit JavaScript-based blocking (more reliable than CSS alone)
// ============================================================================

function blockRedditFeed() {
  if (!enabledFeatures.has('reddit_feed')) return;

  // New Reddit selectors
  const feedSelectors = [
    'shreddit-feed',
    'shreddit-post',
    '[data-testid="post"]',
    '[data-testid="post-container"]',
    'faceplate-tracker[slot="feed"]',
    '.rpBJOHq2PR60pnwJlUyP0',
  ];

  feedSelectors.forEach(selector => {
    try {
      document.querySelectorAll(selector).forEach(el => {
        // Don't hide if we're on a post detail page
        const isPostPage = document.querySelector('.PostPage') ||
                          document.location.pathname.match(/\/comments\//);
        if (isPostPage && el.tagName === 'SHREDDIT-POST') return;

        el.style.display = 'none';
        el.setAttribute('data-flow-blocked', 'feed');
      });
    } catch (e) {}
  });

  // Old Reddit
  const oldRedditSelectors = [
    '#siteTable',
    '.content .linklisting',
    '.thing',
  ];

  oldRedditSelectors.forEach(selector => {
    try {
      document.querySelectorAll(selector).forEach(el => {
        el.style.display = 'none';
        el.setAttribute('data-flow-blocked', 'feed');
      });
    } catch (e) {}
  });
}

function blockRedditRecent() {
  if (!enabledFeatures.has('reddit_recent')) return;

  // PRIMARY: Hide all recent posts by the unique "noun" attribute
  const recentPosts = document.querySelectorAll('faceplate-tracker[noun="recent_post"]');
  recentPosts.forEach(el => {
    el.style.display = 'none';
    el.setAttribute('data-flow-blocked', 'recent');
  });

  // Hide the container with slot="posts" (the recent posts feed container)
  const postsContainer = document.querySelector('div[slot="posts"]');
  if (postsContainer) {
    postsContainer.style.display = 'none';
    postsContainer.setAttribute('data-flow-blocked', 'recent-container');
  }

  // Hide "RECENT POSTS" header text
  const allElements = document.querySelectorAll('*');
  allElements.forEach(el => {
    const text = el.textContent?.trim() || '';
    if (text.match(/^recent\s+posts$/i) && el.children.length === 0) {
      el.style.display = 'none';
      el.setAttribute('data-flow-blocked', 'recent-header');
      // Also hide parent containers
      let parent = el.parentElement;
      for (let i = 0; i < 3 && parent; i++) {
        parent.style.display = 'none';
        parent.setAttribute('data-flow-blocked', 'recent-parent');
        parent = parent.parentElement;
      }
    }
  });

  // Hide navigation tabs with "Recent" text
  const navItems = document.querySelectorAll('[role="tab"], nav a, button, .tab-item');
  navItems.forEach(el => {
    const text = el.textContent?.trim().toLowerCase() || '';
    if (text === 'recent' || text === 'recent posts') {
      el.style.display = 'none';
      el.setAttribute('data-flow-blocked', 'recent-tab');
    }
  });
}

function blockRedditComments() {
  if (!enabledFeatures.has('reddit_comments')) return;

  // Hide only actual comment elements, NOT sidebar content
  const selectors = [
    'shreddit-comment',
    'shreddit-comment-tree',
    '[data-testid="comment"]',
    '[data-testid="comment-tree"]',
    '#comments',
    '.commentarea',
    'comments-page-divider',
    // Comment container by id pattern
    'div[id^="Comment"]',
    '[slot="comment-body"]',
  ];

  selectors.forEach(selector => {
    try {
      document.querySelectorAll(selector).forEach(el => {
        // Make sure it's not in the sidebar
        const isInSidebar = el.closest('shreddit-subreddit-header') ||
                            el.closest('[id-card-widget-id]') ||
                            el.closest('.py-md.xs:block:has(shreddit-subreddit-header)') ||
                            el.closest('.side');
        if (!isInSidebar) {
          el.style.display = 'none';
          el.setAttribute('data-flow-blocked', 'comments');
        }
      });
    } catch (e) {}
  });

  // Also target comment containers by looking for common comment patterns
  const commentContainers = document.querySelectorAll('[data-testid="post"], shreddit-post');
  commentContainers.forEach(post => {
    // Find comments after this post (they're usually siblings or in a nearby container)
    let parent = post.parentElement;
    while (parent && parent !== document.body) {
      const comments = parent.querySelectorAll('shreddit-comment, [data-testid="comment"]');
      if (comments.length > 0) {
        comments.forEach(c => {
          const isInSidebar = c.closest('shreddit-subreddit-header') ||
                              c.closest('.side');
          if (!isInSidebar) {
            c.style.display = 'none';
            c.setAttribute('data-flow-blocked', 'comments');
          }
        });
        break;
      }
      parent = parent.parentElement;
    }
  });
}

function blockRedditRightSidebar() {
  if (!enabledFeatures.has('reddit_right_sidebar')) return;

  // Target the sidebar container and its content
  const selectors = [
    'shreddit-subreddit-header',
    '[id-card-widget-id]', // Community info widget
    'faceplate-partial', // Related communities, etc.
    // Also target parent container
    '.py-md.xs:block:has(shreddit-subreddit-header)',
  ];

  selectors.forEach(selector => {
    try {
      document.querySelectorAll(selector).forEach(el => {
        el.style.display = 'none';
        el.setAttribute('data-flow-blocked', 'right-sidebar');
      });
    } catch (e) {}
  });

  // Walk up from shreddit-subreddit-header to find the sidebar container
  const subredditHeader = document.querySelector('shreddit-subreddit-header');
  if (subredditHeader) {
    let parent = subredditHeader.parentElement;
    while (parent && parent !== document.body) {
      // Check if this looks like the sidebar container
      const hasMultipleWidgets = parent.querySelectorAll('shreddit-subreddit-header, faceplate-partial, hr').length >= 2;
      const isNotMain = !parent.querySelector('[data-testid="post"], shreddit-post');
      if (hasMultipleWidgets && isNotMain) {
        parent.style.display = 'none';
        parent.setAttribute('data-flow-blocked', 'right-sidebar');
        break;
      }
      parent = parent.parentElement;
    }
  }

  // Old Reddit sidebar
  const oldRedditSidebar = document.querySelector('.side');
  if (oldRedditSidebar && !document.querySelector('.listing-page')) {
    oldRedditSidebar.style.display = 'none';
    oldRedditSidebar.setAttribute('data-flow-blocked', 'right-sidebar');
  }
}

function blockRedditNav() {
  if (!enabledFeatures.has('reddit_nav')) return;

  // Hide nav elements EXCEPT search
  const navSelectors = [
    // Header/nav elements
    'header a:not([href*="/search"]):not([data-testid="search"])',
    'header button:not([aria-label*="search"]):not([aria-label*="Search"])',
    'shreddit-nav-bar',
    '#header',
    // Nav icons and buttons that aren't search
    '[data-testid="nav-home"]',
    '[data-testid="nav-popular"]',
    '[data-testid="nav-all"]',
    // Notifications
    '[data-testid="notifications-button"]',
    '[data-testid="nav-notifications"]',
    // Reddit logo, create post button, notifications, etc.
    'header [data-click-id]', // Anything with click-id in header
  ];

  navSelectors.forEach(selector => {
    try {
      document.querySelectorAll(selector).forEach(el => {
        // Skip if it's search-related
        const isSearch = el.getAttribute('aria-label')?.toLowerCase().includes('search') ||
                        el.getAttribute('data-testid')?.toLowerCase().includes('search') ||
                        el.querySelector('input[type="search"], [role="search"]');
        if (!isSearch) {
          el.style.display = 'none';
          el.setAttribute('data-flow-blocked', 'nav');
        }
      });
    } catch (e) {}
  });

  // Also hide specific nav elements by text content
  const allNavItems = document.querySelectorAll('header nav *, [role="navigation"] *, nav *');
  allNavItems.forEach(el => {
    const text = el.textContent?.trim().toLowerCase() || '';
    const isSearch = el.getAttribute('aria-label')?.toLowerCase().includes('search') ||
                    el.getAttribute('data-testid')?.toLowerCase().includes('search');
    // Hide nav items like "Home", "Popular", etc. but not search
    if ((text === 'home' || text === 'popular' || text === 'all' || text === 'create post') && !isSearch) {
      el.style.display = 'none';
      el.setAttribute('data-flow-blocked', 'nav');
    }
  });

  // Also hide notification badges specifically
  const notificationBadges = document.querySelectorAll('[data-testid="notifications-button"], button[aria-label*="notification"], button[aria-label*="Notification"]');
  notificationBadges.forEach(el => {
    el.style.display = 'none';
    el.setAttribute('data-flow-blocked', 'nav');
  });
}

function applyRedditBlocking() {
  if (enabledFeatures.has('reddit_feed')) blockRedditFeed();
  if (enabledFeatures.has('reddit_recent')) blockRedditRecent();
  if (enabledFeatures.has('reddit_comments')) blockRedditComments();
  if (enabledFeatures.has('reddit_right_sidebar')) blockRedditRightSidebar();
  if (enabledFeatures.has('reddit_nav')) blockRedditNav();
}

// Apply all blocking based on current site
function applyAllBlocking() {
  if (currentSite === 'reddit') {
    applyRedditBlocking();
  }
}

// Initialize
const currentSite = detectSite();

if (currentSite) {
  const siteConfig = SITE_FEATURES[currentSite];
  const { features, classPrefix } = siteConfig;

  // Map feature keys to class names
  function getClassName(featureKey) {
    const parts = featureKey.split('_').slice(1);
    return `${classPrefix}-${parts.join('-')}`;
  }

  // Toggle blocking classes on html element and apply JS blocking
  function updateBlocking() {
    browserAPI.storage.sync.get(features, function(result) {
      // Update enabled features set
      enabledFeatures.clear();
      features.forEach(featureKey => {
        const className = getClassName(featureKey);
        // Use default value if storage is undefined, otherwise use stored value
        const storedValue = result[featureKey];
        const defaultValue = FEATURE_DEFAULTS[featureKey];
        const isEnabled = storedValue !== undefined ? storedValue : defaultValue;

        document.documentElement.classList.toggle(className, isEnabled);
        if (isEnabled) {
          enabledFeatures.add(featureKey);
        }
      });

      // Apply JavaScript-based blocking immediately
      applyAllBlocking();
    }).catch(error => {
      // Handle storage errors (quota exceeded, sync in progress, etc.)
      console.error('[Flow] Storage read failed, using defaults:', error);
      // Fall back to defaults
      enabledFeatures.clear();
      features.forEach(featureKey => {
        const className = getClassName(featureKey);
        const defaultValue = FEATURE_DEFAULTS[featureKey];
        if (defaultValue) {
          document.documentElement.classList.add(className);
          enabledFeatures.add(featureKey);
        }
      });
      applyAllBlocking();
    });
  }

  // Listen for storage changes
  browserAPI.storage.onChanged.addListener(function(changes, namespace) {
    const hasRelevantChange = features.some(key => changes[key]);
    if (hasRelevantChange) {
      updateBlocking();
    }
  });

  // Wait for DOM to be ready before showing indicator
  function initWhenReady() {
    if (document.body) {
      updateBlocking();
      startBlockingObserver();
    } else {
      // If body isn't ready yet, wait for it
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          updateBlocking();
          startBlockingObserver();
        });
      } else {
        // DOM is loaded but body might not be ready
        setTimeout(() => {
          updateBlocking();
          startBlockingObserver();
        }, 100);
      }
    }
  }

  // MutationObserver to continuously block dynamically loaded content
  let observer = null;
  let debounceTimer = null;

  function startBlockingObserver() {
    if (observer) return;

    // Guard: ensure body exists before observing
    if (!document.body) {
      console.warn('[Flow] Document body not ready, skipping observer setup');
      return;
    }

    observer = new MutationObserver((mutations) => {
      // Only run if we have features enabled
      if (enabledFeatures.size === 0) return;

      let hasNewNodes = false;
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === 1) { // Element node
            hasNewNodes = true;
          }
        });
      });

      if (hasNewNodes) {
        if (debounceTimer) return;
        debounceTimer = setTimeout(() => {
          applyAllBlocking();
          debounceTimer = null;
        }, 50);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Clean up observer on page unload to prevent memory leaks
    window.addEventListener('beforeunload', () => {
      if (observer) {
        observer.disconnect();
        observer = null;
      }
    });
  }

  initWhenReady();

}
