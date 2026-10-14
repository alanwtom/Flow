// Browser compatibility
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

// YouTube FYP Blocker Content Script
(function() {
  // Granular feature storage keys
  const YOUTUBE_FEATURES = [
    'yt_homepage', 'yt_shorts', 'yt_posts', 'yt_sidebar', 'yt_comments',
    'yt_endcards', 'yt_chat', 'yt_notifications', 'yt_create_button', 'yt_autoplay',
    'yt_playables', 'yt_featured', 'yt_explore', 'yt_news', 'yt_auto_shelves'
  ];

  // Apply blocking based on individual settings
  function updateYouTubeBlocking() {
    browserAPI.storage.sync.get(YOUTUBE_FEATURES, function(result) {
      // Apply classes for each enabled feature. The !! matters: an unset
      // setting comes back as undefined, and toggle(name, undefined) flips
      // the class in some DOM implementations instead of removing it.
      document.documentElement.classList.toggle('yt-block-homepage', !!result.yt_homepage);
      document.documentElement.classList.toggle('yt-block-shorts', !!result.yt_shorts);
      document.documentElement.classList.toggle('yt-block-posts', !!result.yt_posts);
      document.documentElement.classList.toggle('yt-block-sidebar', !!result.yt_sidebar);
      document.documentElement.classList.toggle('yt-block-comments', !!result.yt_comments);
      document.documentElement.classList.toggle('yt-block-endcards', !!result.yt_endcards);
      document.documentElement.classList.toggle('yt-block-chat', !!result.yt_chat);
      document.documentElement.classList.toggle('yt-block-notifications', !!result.yt_notifications);
      document.documentElement.classList.toggle('yt-block-create-button', !!result.yt_create_button);
      document.documentElement.classList.toggle('yt-block-autoplay', !!result.yt_autoplay);
      document.documentElement.classList.toggle('yt-block-playables', !!result.yt_playables);
      document.documentElement.classList.toggle('yt-block-featured', !!result.yt_featured);
      document.documentElement.classList.toggle('yt-block-explore', !!result.yt_explore);
      document.documentElement.classList.toggle('yt-block-news', !!result.yt_news);
      document.documentElement.classList.toggle('yt-block-auto-shelves', !!result.yt_auto_shelves);

      // Immediately apply JavaScript-based blocking for features that need it
      // Always call blockCreateButton to handle both enable and disable
      blockCreateButton();
      if (result.yt_shorts) {
        blockShortsElements();
      }
      if (result.yt_playables) {
        blockPlayablesElements();
      }
      // Titled shelves (Featured, Explore, News, and the "Play while you
      // watch" wording of the games shelf) can only be told apart by their
      // heading text, which CSS cannot read, so they are hidden here. The
      // helper does nothing unless one of those features is switched on.
      blockTitledShelves();
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

  // Aggressive Playables blocking via JavaScript
  function blockPlayablesElements() {
    if (!document.documentElement.classList.contains('yt-block-playables')) {
      return;
    }

    // Selectors for the Playables shelf/section in various locations
    const playablesSelectors = [
      // Playables shelf by mini-game card attribute
      'ytd-rich-section-renderer:has([is-mini-game-card-shelf])',
      'ytd-rich-section-renderer:has(ytd-mini-game-card-renderer)',
      'ytd-rich-shelf-renderer:has([is-mini-game-card-shelf])',
      // Playables section by links to /playables
      'ytd-rich-section-renderer:has(a[href*="/playables"])',
      'ytd-rich-shelf-renderer:has(a[href*="/playables"])',
      'ytd-rich-item-renderer:has(a[href*="/playables"])',
      // Direct mini-game card elements
      'ytd-mini-game-card-renderer',
      'ytd-mini-game-shelf-renderer',
      // Navigation entries pointing to Playables
      'ytd-mini-guide-entry-renderer:has(a[href*="/playables"])',
      'ytd-guide-entry-renderer:has(a[href*="/playables"])'
    ];

    playablesSelectors.forEach(selector => {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          el.style.display = 'none';
          el.setAttribute('data-flow-blocked', 'playables');
        });
      } catch (e) {
        // Selector might be invalid in some contexts, skip it
      }
    });

    // Also hide any rich-section whose header/title text mentions "Playables"
    // (including the "Play while you watch" wording YouTube now uses for the
    // same mini-games shelf)
    const richSections = document.querySelectorAll('ytd-rich-section-renderer');
    richSections.forEach(section => {
      const headerText = (section.querySelector('#title, #header, h2, ytd-rich-shelf-renderer #title')?.textContent || '').trim();
      if (/playables|play while you watch/i.test(headerText)) {
        section.style.display = 'none';
        section.setAttribute('data-flow-blocked', 'playables');
      }
    });
  }

  // Shelves that can only be told apart by their heading. YouTube reuses the
  // same few containers for every homepage shelf, so CSS has nothing stable
  // to match on — the heading text is the identifier. Only the shelf's own
  // title element is read, never the videos inside it, so a video that merely
  // mentions one of these words in its title cannot hide a whole shelf.
  const TITLED_SHELF_RULES = [
    { className: 'yt-block-playables', pattern: /playables|play while you watch/i, tag: 'playables' },
    { className: 'yt-block-featured', pattern: /youtube featured/i, tag: 'featured' },
    { className: 'yt-block-explore', pattern: /explore more|most relevant/i, tag: 'explore' },
    { className: 'yt-block-news', pattern: /breaking news|top news|trending/i, tag: 'news' }
  ];

  function getShelfTitleText(section) {
    const titleEl = section.querySelector(
      '#title, #title-text, #header, h2, yt-formatted-string#title, [slot="title"]'
    );
    return (titleEl?.textContent || '').trim();
  }

  function blockTitledShelves() {
    const autoHide = document.documentElement.classList.contains('yt-block-auto-shelves');
    const activeRules = TITLED_SHELF_RULES.filter(rule =>
      document.documentElement.classList.contains(rule.className)
    );
    if (activeRules.length === 0 && !autoHide) return;

    const sections = document.querySelectorAll(
      'ytd-rich-section-renderer, ytd-rich-shelf-renderer, ytd-shelf-renderer, grid-shelf-view-model'
    );
    sections.forEach(section => {
      const title = getShelfTitleText(section);
      const rule = title ? activeRules.find(r => r.pattern.test(title)) : undefined;
      if (rule) {
        const target = section.closest('ytd-rich-section-renderer') || section;
        target.style.display = 'none';
        target.setAttribute('data-flow-blocked', rule.tag);
      } else if (autoHide && section.tagName === 'YTD-RICH-SECTION-RENDERER') {
        // Future-proof mode: hide every grouped shelf on the feed, including
        // ones YouTube has not given a name we recognise yet. Single videos
        // outside a shelf are never touched — only the shelf wrapper goes.
        section.style.display = 'none';
        section.setAttribute('data-flow-blocked', 'auto-shelf');
      }
    });

    // Promotional cards labelled "YouTube featured" also turn up as loose
    // cards in the grid rather than inside a titled shelf.
    if (document.documentElement.classList.contains('yt-block-featured')) {
      document.querySelectorAll('yt-lockup-view-model').forEach(lockup => {
        if (/youtube featured/i.test(lockup.textContent || '')) {
          const item = lockup.closest('ytd-rich-item-renderer') || lockup;
          item.style.display = 'none';
          item.setAttribute('data-flow-blocked', 'featured');
        }
      });
    }
  }

  // True when any feature that needs the DOM watcher is switched on.
  function needsShelfWatcher() {
    return document.documentElement.classList.contains('yt-block-shorts') ||
      document.documentElement.classList.contains('yt-block-playables') ||
      document.documentElement.classList.contains('yt-block-featured') ||
      document.documentElement.classList.contains('yt-block-explore') ||
      document.documentElement.classList.contains('yt-block-news') ||
      document.documentElement.classList.contains('yt-block-auto-shelves');
  }

  // MutationObserver for dynamic Shorts/Playables blocking
  let shortsObserver = null;
  let shortsDebounceTimer = null;
  function startShortsObserver() {
    if (shortsObserver) return;

    shortsObserver = new MutationObserver((mutations) => {
      if (!needsShelfWatcher()) {
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
          if (document.documentElement.classList.contains('yt-block-shorts')) blockShortsElements();
          if (document.documentElement.classList.contains('yt-block-playables')) blockPlayablesElements();
          blockTitledShelves();
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
    const hasRelevantChange = YOUTUBE_FEATURES.some(key => changes[key]);
    if (hasRelevantChange) {
      updateYouTubeBlocking();
      // Always call these when their settings change (to handle both enable and disable)
      if (changes.yt_shorts) {
        browserAPI.storage.sync.get(['yt_shorts'], function(result) {
          if (result.yt_shorts) {
            blockShortsElements();
            startShortsObserver();
          }
        });
      }
      if (changes.yt_playables) {
        browserAPI.storage.sync.get(['yt_playables'], function(result) {
          if (result.yt_playables) {
            blockPlayablesElements();
            startShortsObserver();
          }
        });
      }
      if (changes.yt_featured || changes.yt_explore || changes.yt_news || changes.yt_auto_shelves) {
        blockTitledShelves();
        startShortsObserver();
      }
      if (changes.yt_create_button) {
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
      // Re-run Playables blocking on navigation
      if (document.documentElement.classList.contains('yt-block-playables')) {
        blockPlayablesElements();
        startShortsObserver();
      }
      // Re-run titled-shelf blocking on navigation
      if (needsShelfWatcher()) {
        blockTitledShelves();
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
      // Initial Playables blocking
      if (document.documentElement.classList.contains('yt-block-playables')) {
        blockPlayablesElements();
        startShortsObserver();
      }
      // Initial titled-shelf blocking (Featured / Explore / News)
      if (needsShelfWatcher()) {
        blockTitledShelves();
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
    // Initial Playables blocking
    if (document.documentElement.classList.contains('yt-block-playables')) {
      blockPlayablesElements();
      startShortsObserver();
    }
    // Initial titled-shelf blocking (Featured / Explore / News)
    if (needsShelfWatcher()) {
      blockTitledShelves();
      startShortsObserver();
    }
    // Initial Create button blocking
    if (document.documentElement.classList.contains('yt-block-create-button')) {
      blockCreateButton();
    }
  }
})();
