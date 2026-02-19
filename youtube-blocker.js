// Browser compatibility
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

// YouTube FYP Blocker Content Script
(function() {
  let indicatorElement = null;

  // Granular feature storage keys
  const YOUTUBE_FEATURES = [
    'yt_homepage', 'yt_shorts', 'yt_sidebar', 'yt_comments',
    'yt_endcards', 'yt_chat', 'yt_notifications', 'yt_autoplay'
  ];

  // Indicator functions
  function showIndicator() {
    if (indicatorElement) {
      indicatorElement.remove();
    }

    indicatorElement = document.createElement('div');
    indicatorElement.id = 'flow-indicator';
    indicatorElement.innerHTML = '<span class="flow-icon">🐦</span> Flow active';
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

  // Apply blocking based on individual settings
  function updateYouTubeBlocking() {
    browserAPI.storage.sync.get([...YOUTUBE_FEATURES, 'pausedUntil'], function(result) {
      const isPaused = result.pausedUntil && Date.now() < result.pausedUntil;

      // Apply classes for each enabled feature
      document.documentElement.classList.toggle('yt-block-homepage', result.yt_homepage && !isPaused);
      document.documentElement.classList.toggle('yt-block-shorts', result.yt_shorts && !isPaused);
      document.documentElement.classList.toggle('yt-block-sidebar', result.yt_sidebar && !isPaused);
      document.documentElement.classList.toggle('yt-block-comments', result.yt_comments && !isPaused);
      document.documentElement.classList.toggle('yt-block-endcards', result.yt_endcards && !isPaused);
      document.documentElement.classList.toggle('yt-block-chat', result.yt_chat && !isPaused);
      document.documentElement.classList.toggle('yt-block-notifications', result.yt_notifications && !isPaused);
      document.documentElement.classList.toggle('yt-block-autoplay', result.yt_autoplay && !isPaused);

      // Show indicator if anything is blocked
      const anythingBlocked = YOUTUBE_FEATURES.some(key =>
        result[key] === true && !isPaused
      );
      if (anythingBlocked) showIndicator();
      else hideIndicator();
    });
  }

  // Initialize from storage
  updateYouTubeBlocking();

  // Listen for changes to any YouTube feature setting
  browserAPI.storage.onChanged.addListener(function(changes, namespace) {
    const hasRelevantChange = YOUTUBE_FEATURES.some(key => changes[key]) || changes.pausedUntil;
    if (hasRelevantChange) {
      updateYouTubeBlocking();
    }
  });

  // Handle SPA navigation - ensure indicator stays visible
  const observer = new MutationObserver(() => {
    const hasAnyBlockingClass = YOUTUBE_FEATURES.some(key => {
      const className = 'yt-block-' + key.replace('yt_', '');
      return document.documentElement.classList.contains(className);
    });
    if (hasAnyBlockingClass && !indicatorElement) {
      showIndicator();
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
})();
