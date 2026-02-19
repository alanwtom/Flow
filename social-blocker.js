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
    hosts: ['twitter.com', 'x.com', 'mobile.twitter.com', 'help.twitter.com'],
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

// Indicator element
let indicatorElement = null;

function showIndicator(siteName) {
  if (indicatorElement) {
    indicatorElement.remove();
  }

  indicatorElement = document.createElement('div');
  indicatorElement.id = 'flow-indicator';
  indicatorElement.innerHTML = '<span class="flow-icon">🐦</span> Flow active';
  indicatorElement.setAttribute('data-site', siteName);
  indicatorElement.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
    color: white;
    padding: 10px 16px;
    border-radius: 24px;
    font-size: 13px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-weight: 500;
    z-index: 2147483647;
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
    pointer-events: none;
    opacity: 0;
    transform: translateY(10px);
    transition: opacity 0.3s ease, transform 0.3s ease;
    display: flex;
    align-items: center;
    gap: 6px;
  `;

  document.body.appendChild(indicatorElement);

  // Animate in
  requestAnimationFrame(() => {
    indicatorElement.style.opacity = '0.8';
    indicatorElement.style.transform = 'translateY(0)';
  });
}

function hideIndicator() {
  if (indicatorElement) {
    indicatorElement.style.opacity = '0';
    indicatorElement.style.transform = 'translateY(10px)';
    setTimeout(() => {
      if (indicatorElement && indicatorElement.parentNode) {
        indicatorElement.remove();
      }
      indicatorElement = null;
    }, 300);
  }
}

// Initialize
const currentSite = detectSite();

if (currentSite) {
  const siteConfig = SITE_FEATURES[currentSite];
  const { features, classPrefix } = siteConfig;

  // Map feature keys to class names
  function getClassName(featureKey) {
    const suffix = featureKey.replace(/^.*_/, '');
    return `${classPrefix}-${suffix}`;
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
      if (anythingBlocked) {
        showIndicator(currentSite);
      } else {
        hideIndicator();
      }
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

  // Handle dynamic page changes (SPA navigation)
  const observer = new MutationObserver(() => {
    // Re-apply indicator if any blocking class is present
    const hasAnyBlockingClass = features.some(key => {
      const className = getClassName(key);
      return document.documentElement.classList.contains(className);
    });
    if (hasAnyBlockingClass && !indicatorElement) {
      showIndicator(currentSite);
    }
  });

  // Start observing when document is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      observer.observe(document.documentElement, { childList: true, subtree: true });
    });
  } else {
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
}
