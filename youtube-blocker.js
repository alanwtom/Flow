// Browser compatibility
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

// YouTube FYP Blocker Content Script
(function() {
  let indicatorElement = null;

  // Granular feature storage keys
  const YOUTUBE_FEATURES = [
    'yt_homepage', 'yt_shorts', 'yt_posts', 'yt_sidebar', 'yt_comments',
    'yt_endcards', 'yt_chat', 'yt_notifications', 'yt_create_button', 'yt_autoplay'
  ];

  // Indicator functions (disabled - badge removed)
  function showIndicator() {
    // Badge removed - no-op
  }

  function hideIndicator() {
    // Badge removed - no-op
  }

  // Apply blocking based on individual settings
  function updateYouTubeBlocking() {
    browserAPI.storage.sync.get([...YOUTUBE_FEATURES, 'pausedUntil'], function(result) {
      const isPaused = result.pausedUntil && Date.now() < result.pausedUntil;

      // Apply classes for each enabled feature
      document.documentElement.classList.toggle('yt-block-homepage', result.yt_homepage && !isPaused);
      document.documentElement.classList.toggle('yt-block-shorts', result.yt_shorts && !isPaused);
      document.documentElement.classList.toggle('yt-block-posts', result.yt_posts && !isPaused);
      document.documentElement.classList.toggle('yt-block-sidebar', result.yt_sidebar && !isPaused);
      document.documentElement.classList.toggle('yt-block-comments', result.yt_comments && !isPaused);
      document.documentElement.classList.toggle('yt-block-endcards', result.yt_endcards && !isPaused);
      document.documentElement.classList.toggle('yt-block-chat', result.yt_chat && !isPaused);
      document.documentElement.classList.toggle('yt-block-notifications', result.yt_notifications && !isPaused);
      document.documentElement.classList.toggle('yt-block-create-button', result.yt_create_button && !isPaused);
      document.documentElement.classList.toggle('yt-block-autoplay', result.yt_autoplay && !isPaused);

      // Immediately apply JavaScript-based blocking for features that need it
      // Always call blockCreateButton to handle both enable and disable
      blockCreateButton();
      if (result.yt_shorts && !isPaused) {
        blockShortsElements();
      }

      // Show indicator if anything is blocked
      const anythingBlocked = YOUTUBE_FEATURES.some(key =>
        result[key] === true && !isPaused
      );
      if (anythingBlocked) showIndicator();
      else hideIndicator();
    });
  }

  // Aggressive Create button hiding via JavaScript
  function blockCreateButton() {
    const shouldBlock = document.documentElement.classList.contains('yt-block-create-button');

    // Find all topbar menu button renderers and button shapes
    const topbarButtons = document.querySelectorAll('ytd-topbar-menu-button-renderer, yt-button-shape');
    topbarButtons.forEach(el => {
      const button = el.tagName === 'YT-BUTTON-SHAPE' ? el.querySelector('button') || el : el.querySelector('button');
      if (!button) return;

      const ariaLabel = (button.getAttribute('aria-label') || '').toLowerCase();
      const title = (button.getAttribute('title') || '').toLowerCase();
      const isCreateButton = ariaLabel.includes('create') || title.includes('create') || isCameraIcon(el);

      if (shouldBlock && isCreateButton) {
        // Mark the element for CSS targeting and hide via inline style
        el.setAttribute('data-flow-create-button', '');
        el.style.display = 'none';
      } else if (!shouldBlock && el.hasAttribute('data-flow-create-button')) {
        // Restore the button
        el.removeAttribute('data-flow-create-button');
        el.style.display = '';
      }
    });

    // Fallback: Try to find by specific ID
    const uploadBtn = document.querySelector('#upload-btn');
    if (uploadBtn) {
      if (shouldBlock) {
        uploadBtn.setAttribute('data-flow-create-button', '');
        uploadBtn.style.display = 'none';
      } else if (uploadBtn.hasAttribute('data-flow-create-button')) {
        uploadBtn.removeAttribute('data-flow-create-button');
        uploadBtn.style.display = '';
      }
    }
  }

  // Helper to detect camera icon (Create button)
  function isCameraIcon(element) {
    const svg = element.querySelector('svg');
    if (!svg) return false;

    const paths = svg.querySelectorAll('path');
    for (const path of paths) {
      const d = path.getAttribute('d') || '';
      // Create button camera icon path patterns
      if (d.includes('M17 10.5') || d.includes('V7c0-.55') || d.includes('c0-.55-.45-1-1-1H4c')) {
        return true;
      }
    }
    return false;
  }

  // Aggressive Shorts blocking via JavaScript
  function blockShortsElements() {
    if (!document.documentElement.classList.contains('yt-block-shorts')) {
      return;
    }

    // Selectors for Shorts in various locations
    const shortsSelectors = [
      // Direct Shorts shelves
      'ytd-reel-shelf-renderer',
      // Shorts in homepage feed (by video type attribute)
      'ytd-grid-video-renderer[is-short]',
      'ytd-rich-item-renderer:has([href*="/shorts"])',
      'ytd-video-renderer:has(a[href*="/shorts"])',
      // Shorts in sidebar recommendations
      'ytd-compact-video-renderer:has(a[href*="/shorts"])',
      // Shorts by thumbnail overlay style
      'ytd-thumbnail-overlay-time-status-renderer[overlay-style="SHORTS"]',
      // Navigation
      'ytd-mini-guide-entry-renderer:has(a[href*="/shorts"])',
      'tp-yt-paper-tab:has(a[href*="/shorts"])',
    ];

    shortsSelectors.forEach(selector => {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          // Only hide if it's actually a Shorts element
          const href = el.querySelector?.('a[href*="/shorts"]')?.href ||
                      el.getAttribute?.('href') ||
                      el.querySelector?.('[href]')?.href || '';
          if (href.includes('/shorts') ||
              el.hasAttribute('is-short') ||
              el.querySelector?.('[overlay-style="SHORTS"]') ||
              el.tagName === 'YTD-REEL-SHELF-RENDERER') {
            el.style.display = 'none';
            el.setAttribute('data-flow-blocked', 'shorts');
          }
        });
      } catch (e) {
        // Selector might be invalid in some contexts, skip it
      }
    });

    // Also check for any links with /shorts in URL and hide their parent containers
    const allLinks = document.querySelectorAll('a[href*="/shorts"]');
    allLinks.forEach(link => {
      // Walk up to find the video container
      let parent = link;
      for (let i = 0; i < 8; i++) {
        parent = parent.parentElement;
        if (!parent) break;
        // Check if this is a video renderer container
        const tag = parent.tagName?.toLowerCase() || '';
        if (tag.includes('video-renderer') || tag.includes('item-renderer') || tag.includes('rich-item')) {
          parent.style.display = 'none';
          parent.setAttribute('data-flow-blocked', 'shorts');
          break;
        }
      }
    });
  }

  // MutationObserver for dynamic Shorts blocking
  let shortsObserver = null;
  let shortsDebounceTimer = null;
  function startShortsObserver() {
    if (shortsObserver) return;

    shortsObserver = new MutationObserver((mutations) => {
      // Only block if Shorts feature is enabled
      if (!document.documentElement.classList.contains('yt-block-shorts')) {
        return;
      }

      let hasNewNodes = false;
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === 1) { // Element node
            hasNewNodes = true;
          }
        });
      });

      if (hasNewNodes) {
        if (shortsDebounceTimer) return;
        shortsDebounceTimer = setTimeout(() => {
          blockShortsElements();
          shortsDebounceTimer = null;
        }, 100);
      }
    });

    shortsObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // Initialize from storage
  updateYouTubeBlocking();

  // Listen for changes to any YouTube feature setting
  browserAPI.storage.onChanged.addListener(function(changes, namespace) {
    const hasRelevantChange = YOUTUBE_FEATURES.some(key => changes[key]) || changes.pausedUntil;
    if (hasRelevantChange) {
      updateYouTubeBlocking();
      // Always call these when their settings change (to handle both enable and disable)
      if (changes.yt_shorts || changes.pausedUntil) {
        browserAPI.storage.sync.get(['yt_shorts', 'pausedUntil'], function(result) {
          if (result.yt_shorts && !result.pausedUntil) {
            blockShortsElements();
            startShortsObserver();
          }
        });
      }
      if (changes.yt_create_button || changes.pausedUntil) {
        blockCreateButton(); // This now handles both enable and disable
      }
    }
  });

  // Handle SPA navigation - ensure blocking persists
  const observer = new MutationObserver(() => {
    const hasAnyBlockingClass = YOUTUBE_FEATURES.some(key => {
      const className = 'yt-block-' + key.replace('yt_', '').replace('_', '-');
      return document.documentElement.classList.contains(className);
    });
    if (hasAnyBlockingClass) {
      // Re-run Shorts blocking on navigation
      if (document.documentElement.classList.contains('yt-block-shorts')) {
        blockShortsElements();
        startShortsObserver();
      }
      // Re-run Create button blocking on navigation
      if (document.documentElement.classList.contains('yt-block-create-button')) {
        blockCreateButton();
      }
    }
  });

  // Start observing when document is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      observer.observe(document.documentElement, { childList: true, subtree: true });
      // Initial Shorts blocking
      if (document.documentElement.classList.contains('yt-block-shorts')) {
        blockShortsElements();
        startShortsObserver();
      }
      // Initial Create button blocking
      if (document.documentElement.classList.contains('yt-block-create-button')) {
        blockCreateButton();
      }
    });
  } else {
    observer.observe(document.documentElement, { childList: true, subtree: true });
    // Initial Shorts blocking
    if (document.documentElement.classList.contains('yt-block-shorts')) {
      blockShortsElements();
      startShortsObserver();
    }
    // Initial Create button blocking
    if (document.documentElement.classList.contains('yt-block-create-button')) {
      blockCreateButton();
    }
  }
})();
