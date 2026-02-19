// Browser compatibility
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

// Granular feature configuration per site
const SITE_FEATURES = {
  reddit: {
    hosts: ['reddit.com', 'www.reddit.com', 'old.reddit.com'],
    features: ['reddit_feed', 'reddit_trending', 'reddit_awards', 'reddit_chat', 'reddit_sidebar'],
    classPrefix: 'reddit-block'
  },
  twitter: {
    hosts: ['twitter.com', 'x.com', 'mobile.twitter.com'],
    features: ['twitter_foryou', 'twitter_following', 'twitter_trends', 'twitter_suggestions', 'twitter_communities', 'twitter_topics'],
    classPrefix: 'twitter-block'
  }
};

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

function showIndicator() {
  // Badge removed - no-op
}

function hideIndicator() {
  // Badge removed - no-op
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

  // Toggle blocking classes on html element
  function updateBlocking() {
    browserAPI.storage.sync.get([...features, 'pausedUntil'], function(result) {
      const isPaused = result.pausedUntil && Date.now() < result.pausedUntil;

      // Apply classes for each enabled feature
      features.forEach(featureKey => {
        const className = getClassName(featureKey);
        const isEnabled = result[featureKey] === true && !isPaused;
        document.documentElement.classList.toggle(className, isEnabled);
      });

      // Show indicator if anything is blocked
      const anythingBlocked = features.some(key =>
        result[key] === true && !isPaused
      );
      if (anythingBlocked) showIndicator();
      else hideIndicator();
    });
  }

  // Listen for storage changes
  browserAPI.storage.onChanged.addListener(function(changes, namespace) {
    const hasRelevantChange = features.some(key => changes[key]) || changes.pausedUntil;
    if (hasRelevantChange) {
      updateBlocking();
    }
  });

  // Wait for DOM to be ready before showing indicator
  function initWhenReady() {
    if (document.body) {
      updateBlocking();
    } else {
      // If body isn't ready yet, wait for it
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', updateBlocking);
      } else {
        // DOM is loaded but body might not be ready
        setTimeout(updateBlocking, 100);
      }
    }
  }

  initWhenReady();

}
