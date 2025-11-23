// TPI Popup Script - Simplified
// Auto-applies default settings and handles settings gear modal

const defaultSettings = {
  enabled: true,
  filterMode: 'filtered',
  filterKeywords: 'transparent',
  filterByTitle: true,
  filterByCalendar: false,
  caseSensitive: false,
  colorMode: 'custom',
  customColor: '#2e3c52',
  outlineEnabled: true,
  outlineDisplayMode: 'filtered',
  outlineThickness: 0.7,
  outlineColor: '#2cbcd4',
  iconEnabled: true,
  iconWhite: true,
  iconDisplayMode: 'filtered',
  iconFilterMode: 'filtered',
  iconKeywords: '',
  customIconSvg: '',
  textColorEnabled: true,
  textColorDisplayMode: 'all',
  textColor: '#ffffff',
  googleCalendarBranding: false
};

// Load settings from storage or use defaults
function loadSettings() {
  chrome.storage.sync.get(['tpiSettings'], (result) => {
    const settings = result.tpiSettings || defaultSettings;
    
    // Update hidden form elements with loaded settings
    document.getElementById('enabledToggle').checked = settings.enabled;
    document.getElementById('filterMode').value = settings.filterMode;
    document.getElementById('filterKeywords').value = settings.filterKeywords;
    document.getElementById('filterByTitle').checked = settings.filterByTitle;
    document.getElementById('filterByCalendar').checked = settings.filterByCalendar;
    document.getElementById('caseSensitive').checked = settings.caseSensitive;
    document.getElementById('colorMode').value = settings.colorMode;
    document.getElementById('customColor').value = settings.customColor;
    document.getElementById('customColorText').value = settings.customColor;
    document.getElementById('outlineEnabledToggle').checked = settings.outlineEnabled;
    document.getElementById('outlineDisplayMode').value = settings.outlineDisplayMode;
    document.getElementById('outlineThickness').value = settings.outlineThickness;
    document.getElementById('outlineColor').value = settings.outlineColor;
    document.getElementById('outlineColorText').value = settings.outlineColor;
    document.getElementById('iconEnabledToggle').checked = settings.iconEnabled;
    document.getElementById('iconWhiteToggle').checked = settings.iconWhite;
    document.getElementById('iconDisplayMode').value = settings.iconDisplayMode;
    document.getElementById('textColorEnabledToggle').checked = settings.textColorEnabled;
    document.getElementById('textColorDisplayMode').value = settings.textColorDisplayMode;
    document.getElementById('textColor').value = settings.textColor;
    document.getElementById('textColorText').value = settings.textColor;
    document.getElementById('googleCalendarBranding').checked = settings.googleCalendarBranding || false;
    
    // Auto-apply settings
    applySettings();
  });
}

// Get current settings from UI
function getCurrentSettings() {
  return {
    enabled: document.getElementById('enabledToggle').checked,
    filterMode: document.getElementById('filterMode').value,
    filterKeywords: document.getElementById('filterKeywords').value,
    filterByTitle: document.getElementById('filterByTitle').checked,
    filterByCalendar: document.getElementById('filterByCalendar').checked,
    caseSensitive: document.getElementById('caseSensitive').checked,
    colorMode: document.getElementById('colorMode').value,
    customColor: document.getElementById('customColor').value,
    outlineEnabled: document.getElementById('outlineEnabledToggle').checked,
    outlineDisplayMode: document.getElementById('outlineDisplayMode').value,
    outlineThickness: parseFloat(document.getElementById('outlineThickness').value),
    outlineColor: document.getElementById('outlineColor').value,
    iconEnabled: document.getElementById('iconEnabledToggle').checked,
    iconWhite: document.getElementById('iconWhiteToggle').checked,
    iconDisplayMode: document.getElementById('iconDisplayMode').value,
    iconFilterMode: document.getElementById('iconDisplayMode').value,
    iconKeywords: '',
    customIconSvg: '',
    textColorEnabled: document.getElementById('textColorEnabledToggle').checked,
    textColorDisplayMode: document.getElementById('textColorDisplayMode').value,
    textColor: document.getElementById('textColor').value,
    googleCalendarBranding: document.getElementById('googleCalendarBranding').checked
  };
}

// Save settings to storage
function saveSettings(settings) {
  chrome.storage.sync.set({ tpiSettings: settings }, () => {
    // Settings saved - content script will pick up changes via storage.onChanged
  });
}

// Apply settings (save and trigger update)
function applySettings() {
  const settings = getCurrentSettings();
  saveSettings(settings);
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
  // Load and apply settings
  loadSettings();
  
  // Settings gear modal handlers
  const settingsGear = document.getElementById('settingsGear');
  const settingsModal = document.getElementById('settingsModal');
  const closeSettings = document.getElementById('closeSettings');
  const googleCalendarBranding = document.getElementById('googleCalendarBranding');
  
  // Open settings modal
  settingsGear.addEventListener('click', () => {
    settingsModal.style.display = 'flex';
  });
  
  // Close settings modal
  closeSettings.addEventListener('click', () => {
    settingsModal.style.display = 'none';
  });
  
  // Close modal when clicking outside
  settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
      settingsModal.style.display = 'none';
    }
  });
  
  // Handle Google Calendar branding checkbox
  googleCalendarBranding.addEventListener('change', () => {
    applySettings();
  });
  
  // Auto-apply settings when hidden form elements change (if they ever do)
  // This ensures settings are always in sync
  const hiddenInputs = document.querySelectorAll('div[style*="display: none"] input, div[style*="display: none"] select, div[style*="display: none"] textarea');
  hiddenInputs.forEach(input => {
    input.addEventListener('change', () => {
      applySettings();
    });
  });
  
  // Auto-apply on page load to ensure defaults are set
  setTimeout(() => {
    applySettings();
  }, 100);
});
