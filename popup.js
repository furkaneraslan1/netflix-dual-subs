// Default settings
const defaultSettings = {
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
};

// Load settings when popup opens
document.addEventListener('DOMContentLoaded', async () => {
  const settings = await chrome.storage.sync.get(defaultSettings);
  
  // Apply settings to UI
  document.getElementById('enabled').checked = settings.enabled;
  document.getElementById('targetLanguage').value = settings.targetLanguage;
  document.getElementById('translationService').value = settings.translationService;
  document.getElementById('apiKey').value = settings.apiKey;
  document.getElementById('libreUrl').value = settings.libreUrl;
  document.getElementById('translatedSize').value = settings.translatedSize;
  document.getElementById('translatedColor').value = settings.translatedColor;

  // Update size display
  document.getElementById('translatedSizeValue').textContent = `${settings.translatedSize}px`;

  // Background settings
  document.getElementById('showBackground').checked = settings.showBackground;
  document.getElementById('bgOpacity').value = settings.bgOpacity;
  document.getElementById('bgOpacityValue').textContent = `${settings.bgOpacity}%`;
  document.getElementById('textOpacity').value = settings.textOpacity;
  document.getElementById('textOpacityValue').textContent = `${settings.textOpacity}%`;
  updateBgOpacityVisibility(settings.showBackground);

  // Set active position
  document.querySelectorAll('.position-option').forEach(opt => {
    opt.classList.toggle('active', opt.dataset.position === settings.position);
  });
  
  // Show/hide API key field
  updateServiceFields(settings.translationService);
});

// Translation service change handler
document.getElementById('translationService').addEventListener('change', (e) => {
  updateServiceFields(e.target.value);
});

function updateServiceFields(service) {
  const apiKeyGroup = document.getElementById('apiKeyGroup');
  const libreUrlGroup = document.getElementById('libreUrlGroup');
  
  apiKeyGroup.style.display = service === 'deepl' ? 'block' : 'none';
  libreUrlGroup.style.display = service === 'libre' ? 'block' : 'none';
}

// Position selection
document.querySelectorAll('.position-option').forEach(option => {
  option.addEventListener('click', () => {
    document.querySelectorAll('.position-option').forEach(opt => opt.classList.remove('active'));
    option.classList.add('active');
  });
});

// Size slider update
document.getElementById('translatedSize').addEventListener('input', (e) => {
  document.getElementById('translatedSizeValue').textContent = `${e.target.value}px`;
});

// Background toggle
document.getElementById('showBackground').addEventListener('change', (e) => {
  updateBgOpacityVisibility(e.target.checked);
});

function updateBgOpacityVisibility(show) {
  document.getElementById('bgOpacityGroup').style.opacity = show ? '1' : '0.5';
  document.getElementById('bgOpacity').disabled = !show;
}

// Opacity sliders
document.getElementById('bgOpacity').addEventListener('input', (e) => {
  document.getElementById('bgOpacityValue').textContent = `${e.target.value}%`;
});

document.getElementById('textOpacity').addEventListener('input', (e) => {
  document.getElementById('textOpacityValue').textContent = `${e.target.value}%`;
});

// Save settings
document.getElementById('saveBtn').addEventListener('click', async () => {
  const activePosition = document.querySelector('.position-option.active');
  
  const settings = {
    enabled: document.getElementById('enabled').checked,
    targetLanguage: document.getElementById('targetLanguage').value,
    translationService: document.getElementById('translationService').value,
    apiKey: document.getElementById('apiKey').value,
    libreUrl: document.getElementById('libreUrl').value,
    position: activePosition ? activePosition.dataset.position : 'bottom',
    translatedSize: parseInt(document.getElementById('translatedSize').value),
    translatedColor: document.getElementById('translatedColor').value,
    showBackground: document.getElementById('showBackground').checked,
    bgOpacity: parseInt(document.getElementById('bgOpacity').value),
    textOpacity: parseInt(document.getElementById('textOpacity').value)
  };
  
  await chrome.storage.sync.set(settings);
  
  // Notify content script of settings change
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.url && tab.url.includes('netflix.com')) {
    chrome.tabs.sendMessage(tab.id, { type: 'SETTINGS_UPDATED', settings });
  }
  
  showStatus('Settings saved!', 'success');
});

// Toggle handler - immediate update
document.getElementById('enabled').addEventListener('change', async (e) => {
  const settings = await chrome.storage.sync.get(defaultSettings);
  settings.enabled = e.target.checked;
  await chrome.storage.sync.set(settings);
  
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.url && tab.url.includes('netflix.com')) {
    chrome.tabs.sendMessage(tab.id, { type: 'SETTINGS_UPDATED', settings });
  }
});

function showStatus(message, type) {
  const status = document.getElementById('status');
  status.textContent = message;
  status.className = `status ${type}`;
  status.style.display = 'block';
  
  setTimeout(() => {
    status.style.display = 'none';
  }, 3000);
}
