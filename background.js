// Background service worker for Netflix Dual Subtitles

// Handle installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Set default settings on first install
    chrome.storage.sync.set({
      enabled: true,
      targetLanguage: 'tr',
      translationService: 'google',
      apiKey: '',
      libreUrl: 'https://libretranslate.com',
      position: 'bottom',
      translatedSize: 18,
      translatedColor: '#ffff00',
      showBackground: true,
      bgOpacity: 80,
      textOpacity: 100
    });

    console.log('Netflix Dual Subtitles installed');
  }
});

// Translation cache to avoid repeated API calls
const translationCache = new Map();
const CACHE_MAX_SIZE = 1000;

// Handle messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'TRANSLATE') {
    console.log('[Netflix Dual Subs] Translation request:', message.service, message.targetLang, message.text.substring(0, 50));
    handleTranslation(message.text, message.targetLang, message.service, message.apiKey, message.libreUrl, message.context)
      .then(translation => {
        console.log('[Netflix Dual Subs] Translation success:', translation.substring(0, 50));
        sendResponse({ success: true, translation });
      })
      .catch(error => {
        console.error('[Netflix Dual Subs] Translation error:', error.message);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep channel open for async response
  }
});

// Get cache key
function getCacheKey(text, targetLang, service) {
  return `${service}:${targetLang}:${text}`;
}

// Clean cache if too large
function cleanCache() {
  if (translationCache.size > CACHE_MAX_SIZE) {
    const keysToDelete = Array.from(translationCache.keys()).slice(0, CACHE_MAX_SIZE / 2);
    keysToDelete.forEach(key => translationCache.delete(key));
  }
}

// Handle single translation
async function handleTranslation(text, targetLang, service, apiKey, libreUrl, context = '') {
  const cacheKey = getCacheKey(text, targetLang, service);

  // Check cache first
  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey);
  }

  let translation;

  switch (service) {
    case 'google':
      translation = await translateWithGoogle(text, targetLang, context);
      break;
    case 'deepl':
      translation = await translateWithDeepL(text, targetLang, apiKey, context);
      break;
    case 'libre':
      translation = await translateWithLibre(text, targetLang, libreUrl);
      break;
    default:
      translation = await translateWithGoogle(text, targetLang, context);
  }

  // Cache the result
  cleanCache();
  translationCache.set(cacheKey, translation);

  return translation;
}

// Google Translate (free, unofficial API)
async function translateWithGoogle(text, targetLang, context = '') {
  // If we have context, prepend it with a separator to help translation
  // The context helps Google understand the conversation flow
  let textToTranslate = text;
  let hasContext = context && context.trim().length > 0;

  if (hasContext) {
    // Use a clear separator that we can use to extract just our translation
    textToTranslate = `${context} ||| ${text}`;
  }

  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(textToTranslate)}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Google Translate request failed');
  }

  const data = await response.json();

  // Parse response - Google returns nested arrays
  let translation = '';
  if (data && data[0]) {
    for (const segment of data[0]) {
      if (segment[0]) {
        translation += segment[0];
      }
    }
  }

  // If we used context, extract only the part after the separator
  if (hasContext && translation.includes('|||')) {
    const parts = translation.split('|||');
    translation = parts[parts.length - 1].trim();
  }

  return translation || text;
}

// DeepL Translation
async function translateWithDeepL(text, targetLang, apiKey, context = '') {
  if (!apiKey) {
    throw new Error('DeepL API key is required');
  }

  // DeepL uses uppercase language codes
  const langCode = targetLang.toUpperCase();

  // Determine if free or pro API
  const baseUrl = apiKey.endsWith(':fx')
    ? 'https://api-free.deepl.com/v2/translate'
    : 'https://api.deepl.com/v2/translate';

  // Build request body with optional context
  const requestBody = {
    text: [text],
    target_lang: langCode
  };

  // DeepL supports context parameter for better translations
  // Context should be previous sentences to help understand the current one
  if (context && context.trim().length > 0) {
    requestBody.context = context;
  }

  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'Authorization': `DeepL-Auth-Key ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`DeepL error: ${error}`);
  }

  const data = await response.json();
  return data.translations[0].text;
}

// LibreTranslate
async function translateWithLibre(text, targetLang, libreUrl) {
  const url = `${libreUrl}/translate`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      q: text,
      source: 'auto',
      target: targetLang
    })
  });
  
  if (!response.ok) {
    throw new Error('LibreTranslate request failed');
  }
  
  const data = await response.json();
  return data.translatedText;
}
