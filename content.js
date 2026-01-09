// Netflix Dual Subtitles - Content Script

(function() {
  'use strict';

  // State
  let settings = {
    enabled: true,
    targetLanguage: 'en',
    translationService: 'google',
    apiKey: '',
    libreUrl: 'https://libretranslate.com',
    position: 'bottom',
    translatedSize: 32,
    translatedColor: '#ffff00',
    showBackground: true,
    bgOpacity: 80,
    textOpacity: 100
  };

  let translationCache = new Map();
  let subtitleObserver = null;
  let translatedContainer = null;
  let isInitialized = false;
  let currentTranslation = null; // Track current pending translation
  let lastSubtitleText = '';
  let checkInterval = null;
  let observedContainer = null; // Track which container we're observing
  let subtitleHistory = []; // Buffer of recent subtitles for context
  const HISTORY_SIZE = 5; // Number of previous subtitles to keep

  // Throttle function with trailing edge - ensures last call is always processed
  // This is critical for catching subtitle disappearance events
  function throttle(func, limit) {
    let inThrottle = false;
    let lastArgs = null;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => {
          inThrottle = false;
          // Process any pending call that came in during throttle period
          if (lastArgs) {
            func.apply(this, lastArgs);
            lastArgs = null;
          }
        }, limit);
      } else {
        // Store the latest args to process after throttle period
        lastArgs = args;
      }
    };
  }

  // Throttled version of processSubtitles to prevent excessive calls
  const throttledProcessSubtitles = throttle(() => processSubtitles(), 100);

  // Initialize
  async function init() {
    if (isInitialized) return;
    isInitialized = true;

    console.log('[Netflix Dual Subs] Initializing...');

    // Load settings
    await loadSettings();

    // Create translated subtitle container
    createTranslatedContainer();

    // Start observing for subtitles
    startSubtitleObserver();

    // Listen for fullscreen changes (lightweight event listeners only)
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    // Listen for settings updates
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'SETTINGS_UPDATED') {
        console.log('[Netflix Dual Subs] Settings updated:', message.settings.translationService, 'API key:', message.settings.apiKey ? 'set' : 'not set');
        settings = message.settings;
        // Clear cache when settings change to force re-translation
        translationCache.clear();
        lastSubtitleText = '';
        updateContainerStyles();
        repositionContainer();
        if (!settings.enabled) {
          hideTranslatedSubtitle();
        }
      }
    });

    console.log('[Netflix Dual Subs] Initialized successfully');
  }

  // Load settings from storage
  async function loadSettings() {
    try {
      const stored = await chrome.storage.sync.get(settings);
      settings = { ...settings, ...stored };
    } catch (e) {
      console.error('[Netflix Dual Subs] Failed to load settings:', e);
    }
  }

  // Find the best parent for the subtitle container (handles fullscreen)
  function findSubtitleParent() {
    // In fullscreen, we need to attach to the Netflix player container
    const videoPlayer = document.querySelector('.watch-video--player-view');
    const watchVideo = document.querySelector('.watch-video');
    const nfPlayer = document.querySelector('.nf-player-container');

    // Priority: player view > watch video > nf-player > body
    return videoPlayer || watchVideo || nfPlayer || document.body;
  }

  // Create the container for translated subtitles
  function createTranslatedContainer() {
    // Remove existing container if any
    const existing = document.getElementById('netflix-dual-subs-translated');
    if (existing) existing.remove();

    translatedContainer = document.createElement('div');
    translatedContainer.id = 'netflix-dual-subs-translated';
    translatedContainer.className = 'netflix-dual-subs-container';

    updateContainerStyles();

    // Attach to the right parent
    const parent = findSubtitleParent();
    parent.appendChild(translatedContainer);

    console.log('[Netflix Dual Subs] Container attached to:', parent.className || 'body');
  }

  // Reposition container (e.g., when entering/exiting fullscreen)
  function repositionContainer() {
    if (!translatedContainer) {
      createTranslatedContainer();
      return;
    }

    const parent = findSubtitleParent();
    if (translatedContainer.parentElement !== parent) {
      parent.appendChild(translatedContainer);
      console.log('[Netflix Dual Subs] Container repositioned to:', parent.className || 'body');
    }

    updateContainerStyles();
  }

  // Update container styles based on settings
  function updateContainerStyles() {
    if (!translatedContainer) return;

    // Calculate background color with opacity
    const bgOpacity = settings.showBackground ? (settings.bgOpacity / 100) : 0;
    const backgroundColor = `rgba(0, 0, 0, ${bgOpacity})`;

    // Calculate text opacity
    const textOpacity = settings.textOpacity / 100;

    // Netflix-style subtitle appearance
    const baseStyles = {
      position: 'fixed',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: '2147483647',
      textAlign: 'center',
      maxWidth: '80%',
      padding: settings.showBackground ? '8px 16px' : '0',
      borderRadius: settings.showBackground ? '4px' : '0',
      backgroundColor: backgroundColor,
      fontFamily: 'Netflix Sans, Helvetica Neue, Helvetica, Arial, sans-serif',
      fontWeight: 'bold',
      textShadow: '0 0 7px rgba(0,0,0,.9), 0 0 3px rgba(0,0,0,.8), 2px 2px 4px rgba(0,0,0,.9)',
      pointerEvents: 'none',
      lineHeight: '1.5',
      letterSpacing: '0.5px',
      opacity: textOpacity
    };

    // Clear previous position styles
    translatedContainer.style.top = '';
    translatedContainer.style.bottom = '';

    // Position based on settings - use fixed percentages (Netflix subs are ~10-12% from bottom)
    if (settings.position === 'top') {
      baseStyles.top = '10%';
    } else {
      // Default: translated above original
      baseStyles.bottom = '23%';
    }

    // Apply styles
    Object.assign(translatedContainer.style, baseStyles);
    translatedContainer.style.fontSize = `${settings.translatedSize}px`;
    translatedContainer.style.color = settings.translatedColor;
  }

  // Handle fullscreen changes
  function handleFullscreenChange() {
    console.log('[Netflix Dual Subs] Fullscreen change detected');
    // Small delay to let Netflix update its DOM
    setTimeout(() => {
      repositionContainer();
    }, 100);
  }

  // Start observing for Netflix subtitle changes
  function startSubtitleObserver() {
    // Disconnect existing observer
    if (subtitleObserver) {
      subtitleObserver.disconnect();
    }

    // Clear existing interval
    if (checkInterval) {
      clearInterval(checkInterval);
    }

    subtitleObserver = new MutationObserver(() => {
      if (!settings.enabled) return;
      throttledProcessSubtitles();
    });

    // Try to observe only the subtitle container (much more efficient)
    const startObserving = () => {
      const subtitleContainer = document.querySelector('.player-timedtext');
      if (subtitleContainer && subtitleContainer !== observedContainer) {
        subtitleObserver.disconnect();
        subtitleObserver.observe(subtitleContainer, {
          childList: true,
          subtree: true,
          characterData: true
        });
        observedContainer = subtitleContainer;
        console.log('[Netflix Dual Subs] Observing subtitle container directly');
        return true;
      }
      return !!observedContainer;
    };

    // If subtitle container exists, observe it directly
    if (!startObserving()) {
      // Otherwise, wait for it to appear with a limited scope observer
      const playerObserver = new MutationObserver(() => {
        if (startObserving()) {
          playerObserver.disconnect();
        }
      });

      const player = document.querySelector('.watch-video') || document.querySelector('.nf-player-container');
      if (player) {
        playerObserver.observe(player, { childList: true, subtree: true });
      }
    }

    // Backup check at a reasonable interval (2 seconds instead of 500ms)
    checkInterval = setInterval(() => {
      if (settings.enabled) {
        // Check if container is still in DOM
        if (translatedContainer && !document.body.contains(translatedContainer)) {
          repositionContainer();
        }
        // Re-attach observer if subtitle container changed or was removed
        const subtitleContainer = document.querySelector('.player-timedtext');
        if (subtitleContainer && subtitleContainer !== observedContainer) {
          startObserving();
        } else if (!subtitleContainer && observedContainer) {
          // Container was removed, reset tracking
          observedContainer = null;
        }
      }
    }, 2000);
  }

  // Process current subtitles
  function processSubtitles() {
    // Find Netflix subtitle container
    const subtitleContainer = document.querySelector('.player-timedtext');

    if (!subtitleContainer) {
      hideTranslatedSubtitle();
      return;
    }

    // Netflix structures subtitles with each line in a separate div
    // Look for text containers - each represents a line/speaker
    const textContainers = subtitleContainer.querySelectorAll('.player-timedtext-text-container');

    if (textContainers.length === 0) {
      hideTranslatedSubtitle();
      return;
    }

    // Collect lines - preserve Netflix's line structure (including <br> breaks)
    const lines = [];

    textContainers.forEach(container => {
      // Check for <br> elements inside the container
      const hasBr = container.querySelector('br');

      if (hasBr) {
        // Split text by <br> elements - get innerHTML and split
        const html = container.innerHTML;
        const parts = html.split(/<br\s*\/?>/i);
        parts.forEach(part => {
          // Strip HTML tags and get text content
          const temp = document.createElement('div');
          temp.innerHTML = part;
          const text = temp.textContent.trim();
          if (text) {
            lines.push(text);
          }
        });
      } else {
        const text = container.textContent.trim();
        if (text) {
          lines.push(text);
        }
      }
    });

    if (lines.length === 0) {
      hideTranslatedSubtitle();
      return;
    }

    // Join lines for comparison key
    const fullText = lines.join('\n');

    // Skip if same as last subtitle
    if (fullText === lastSubtitleText) {
      return;
    }

    lastSubtitleText = fullText;

    // Translate each line and display with same structure
    translateAndDisplay(lines);
  }

  // Translate lines and display
  async function translateAndDisplay(lines) {
    const fullText = lines.join(' ');
    const cacheKey = `${settings.translationService}:${settings.targetLanguage}:${lines.join('|')}`;

    if (translationCache.has(cacheKey)) {
      showTranslatedSubtitle(translationCache.get(cacheKey));
      // Still add to history even if cached
      addToHistory(fullText);
      return;
    }

    // Cancel any pending translation for different text
    if (currentTranslation) {
      currentTranslation.cancelled = true;
    }

    const translationState = { cancelled: false };
    currentTranslation = translationState;

    // Get context from previous subtitles (exclude current)
    const context = subtitleHistory.join(' ');

    try {
      // Keep previous subtitle visible while translating (no loading state)
      // Translate all lines in parallel for faster response
      const translationPromises = lines.map(async (line) => {
        const lineCacheKey = `${settings.translationService}:${settings.targetLanguage}:${line}`;

        // Return cached translation if available
        if (translationCache.has(lineCacheKey)) {
          return translationCache.get(lineCacheKey);
        }

        // Request translation from background script with context
        const response = await chrome.runtime.sendMessage({
          type: 'TRANSLATE',
          text: line,
          targetLang: settings.targetLanguage,
          service: settings.translationService,
          apiKey: settings.apiKey,
          libreUrl: settings.libreUrl,
          context: context // Previous subtitles for context
        });

        if (response && response.success) {
          translationCache.set(lineCacheKey, response.translation);
          return response.translation;
        }
        return line; // Fallback to original
      });

      const translatedLines = await Promise.all(translationPromises);

      // Check if this translation is still relevant
      if (translationState.cancelled) return;

      // Join with newlines to preserve line structure
      const fullTranslation = translatedLines.join('\n');
      translationCache.set(cacheKey, fullTranslation);

      // Add current subtitle to history after successful translation
      addToHistory(fullText);

      // Limit cache size
      if (translationCache.size > 500) {
        const firstKey = translationCache.keys().next().value;
        translationCache.delete(firstKey);
      }

      showTranslatedSubtitle(fullTranslation);
    } catch (e) {
      console.error('[Netflix Dual Subs] Translation error:', e);
      hideTranslatedSubtitle();
    }
  }

  // Add subtitle to history buffer
  function addToHistory(text) {
    if (!text || text === subtitleHistory[subtitleHistory.length - 1]) return;

    subtitleHistory.push(text);

    // Keep only the last N subtitles
    if (subtitleHistory.length > HISTORY_SIZE) {
      subtitleHistory.shift();
    }
  }

  // Show translated subtitle
  function showTranslatedSubtitle(text) {
    if (!translatedContainer || !document.body.contains(translatedContainer)) {
      createTranslatedContainer();
    }

    // Escape HTML for safety, then convert newlines to <br> for line breaks
    const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const withBreaks = escaped.replace(/\n/g, '<br>');
    translatedContainer.innerHTML = withBreaks;
    translatedContainer.style.display = 'block';

    // Apply current styles (including background and opacity settings)
    updateContainerStyles();
  }

  // Hide translated subtitle
  function hideTranslatedSubtitle() {
    if (translatedContainer) {
      translatedContainer.style.display = 'none';
    }
    lastSubtitleText = '';
  }

  // Wait for Netflix player to be ready
  function waitForPlayer() {
    // Only initialize on actual watch pages, not homepage/browse
    if (!location.href.includes('/watch/')) {
      return;
    }

    const maxAttempts = 50;
    let attempts = 0;

    const check = () => {
      attempts++;

      // Check for video element or player container
      const video = document.querySelector('video');
      const player = document.querySelector('.watch-video');

      if (video || player) {
        init();
      } else if (attempts < maxAttempts) {
        setTimeout(check, 200);
      }
    };

    check();
  }

  // Start when page is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForPlayer);
  } else {
    waitForPlayer();
  }

  // Handle SPA navigation using History API (more efficient than MutationObserver)
  let lastUrl = location.href;

  // Listen for popstate (back/forward navigation)
  window.addEventListener('popstate', handleNavigation);

  // Intercept pushState and replaceState
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function(...args) {
    originalPushState.apply(this, args);
    handleNavigation();
  };

  history.replaceState = function(...args) {
    originalReplaceState.apply(this, args);
    handleNavigation();
  };

  // Fallback: Poll for URL changes that bypass History API
  setInterval(() => {
    if (location.href !== lastUrl) {
      handleNavigation();
    }
  }, 1000);

  function handleNavigation() {
    if (location.href !== lastUrl) {
      lastUrl = location.href;

      // Reset state for new video
      lastSubtitleText = '';
      subtitleHistory = []; // Clear context history for new video
      hideTranslatedSubtitle();

      // Re-initialize for new page
      if (location.href.includes('/watch/')) {
        setTimeout(() => {
          isInitialized = false;
          waitForPlayer();
        }, 1000);
      }
    }
  }

})();