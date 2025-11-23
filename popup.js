// TPI Popup Script
// Handles user interface interactions

const defaultSettings = {
  enabled: true,
  filterMode: 'all', // 'all' or 'filtered'
  filterKeywords: '',
  filterByTitle: true,
  filterByCalendar: false,
  caseSensitive: false,
  colorMode: 'random',
  customColor: '#4285f4',
  outlineEnabled: true,
  outlineDisplayMode: 'all', // 'all' or 'filtered'
  outlineThickness: 1, // in pixels
  outlineColor: '#ffffff',
  iconEnabled: false,
  iconWhite: true, // Make icon white
  iconDisplayMode: 'all', // 'all' or 'filtered' - for consistency with outline and text color
  iconFilterMode: 'all', // 'all', 'filtered', or 'keywords' - legacy support
  iconKeywords: '',
  customIconSvg: '', // Custom SVG icon code
  textColorEnabled: false, // Enable text color customization
  textColorDisplayMode: 'all', // 'all' or 'filtered'
  textColor: '#ffffff' // Text color (default white)
};

// Load settings from storage
function loadSettings() {
  chrome.storage.sync.get(['tpiSettings'], (result) => {
    const settings = result.tpiSettings || defaultSettings;
    
    // Update UI with loaded settings
    document.getElementById('enabledToggle').checked = settings.enabled;
    document.getElementById('filterMode').value = settings.filterMode || 'all';
    document.getElementById('filterKeywords').value = settings.filterKeywords || '';
    document.getElementById('filterByTitle').checked = settings.filterByTitle !== false;
    document.getElementById('filterByCalendar').checked = settings.filterByCalendar || false;
    document.getElementById('caseSensitive').checked = settings.caseSensitive || false;
    document.getElementById('colorMode').value = settings.colorMode;
    document.getElementById('customColor').value = settings.customColor;
    document.getElementById('customColorText').value = settings.customColor;
    document.getElementById('outlineEnabledToggle').checked = settings.outlineEnabled !== false;
    document.getElementById('outlineDisplayMode').value = settings.outlineDisplayMode || 'all';
    document.getElementById('outlineThickness').value = settings.outlineThickness || 1;
    document.getElementById('outlineThicknessValue').textContent = (settings.outlineThickness || 1) + 'px';
    document.getElementById('outlineColor').value = settings.outlineColor || '#ffffff';
    document.getElementById('outlineColorText').value = settings.outlineColor || '#ffffff';
    document.getElementById('iconEnabledToggle').checked = settings.iconEnabled || false;
    document.getElementById('iconWhiteToggle').checked = settings.iconWhite !== false;
    // Support both iconDisplayMode (new) and iconFilterMode (legacy) for backward compatibility
    const iconDisplayMode = settings.iconDisplayMode || (settings.iconFilterMode === 'keywords' ? 'all' : (settings.iconFilterMode || 'all'));
    document.getElementById('iconDisplayMode').value = iconDisplayMode === 'keywords' ? 'all' : iconDisplayMode;
    document.getElementById('iconKeywords').value = settings.iconKeywords || '';
    document.getElementById('customIconSvg').value = settings.customIconSvg || '';
    document.getElementById('textColorEnabledToggle').checked = settings.textColorEnabled || false;
    document.getElementById('textColorDisplayMode').value = settings.textColorDisplayMode || 'all';
    document.getElementById('textColor').value = settings.textColor || '#ffffff';
    document.getElementById('textColorText').value = settings.textColor || '#ffffff';
    
    // Show/hide clear button based on whether custom icon exists
    const clearCustomIconBtn = document.getElementById('clearCustomIconBtn');
    clearCustomIconBtn.style.display = (settings.customIconSvg && settings.customIconSvg.trim()) ? 'block' : 'none';
    
    // Show/hide sections
    const customColorSection = document.getElementById('customColorSection');
    customColorSection.style.display = settings.colorMode === 'custom' ? 'block' : 'none';
    
    const filterSection = document.getElementById('filterSection');
    filterSection.style.display = settings.filterMode === 'filtered' ? 'block' : 'none';
    
    const outlineOptionsSection = document.getElementById('outlineOptionsSection');
    outlineOptionsSection.style.display = settings.outlineEnabled !== false ? 'block' : 'none';
    
    const iconColorSection = document.getElementById('iconColorSection');
    iconColorSection.style.display = settings.iconEnabled ? 'block' : 'none';
    
    const iconFilterSection = document.getElementById('iconFilterSection');
    iconFilterSection.style.display = settings.iconEnabled ? 'block' : 'none';
    
    const iconKeywordsSection = document.getElementById('iconKeywordsSection');
    iconKeywordsSection.style.display = (settings.iconEnabled && settings.iconFilterMode === 'keywords') ? 'block' : 'none';
    
    const textColorOptionsSection = document.getElementById('textColorOptionsSection');
    textColorOptionsSection.style.display = settings.textColorEnabled ? 'block' : 'none';
  });
}

// Save settings to storage
function saveSettings(settings) {
  chrome.storage.sync.set({ tpiSettings: settings }, () => {
    // Notify content script of changes (storage.onChanged will handle it)
    // No need to reload - the content script listens for storage changes
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
    iconFilterMode: document.getElementById('iconDisplayMode').value, // Keep for backward compatibility
    iconKeywords: document.getElementById('iconKeywords').value,
    customIconSvg: document.getElementById('customIconSvg').value.trim(),
    textColorEnabled: document.getElementById('textColorEnabledToggle').checked,
    textColorDisplayMode: document.getElementById('textColorDisplayMode').value,
    textColor: document.getElementById('textColor').value
  };
}

// Initialize popup
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();

  // Enable/Disable toggle
  document.getElementById('enabledToggle').addEventListener('change', (e) => {
    const settings = getCurrentSettings();
    saveSettings(settings);
  });

  // Filter mode selector
  document.getElementById('filterMode').addEventListener('change', (e) => {
    const filterSection = document.getElementById('filterSection');
    filterSection.style.display = e.target.value === 'filtered' ? 'block' : 'none';
    
    const settings = getCurrentSettings();
    saveSettings(settings);
  });

  // Filter keywords
  document.getElementById('filterKeywords').addEventListener('input', (e) => {
    const settings = getCurrentSettings();
    saveSettings(settings);
  });

  // Filter options
  document.getElementById('filterByTitle').addEventListener('change', () => {
    const settings = getCurrentSettings();
    saveSettings(settings);
  });

  document.getElementById('filterByCalendar').addEventListener('change', () => {
    const settings = getCurrentSettings();
    saveSettings(settings);
  });

  document.getElementById('caseSensitive').addEventListener('change', () => {
    const settings = getCurrentSettings();
    saveSettings(settings);
  });

  // Color mode selector
  document.getElementById('colorMode').addEventListener('change', (e) => {
    const customColorSection = document.getElementById('customColorSection');
    customColorSection.style.display = e.target.value === 'custom' ? 'block' : 'none';
    
    const settings = getCurrentSettings();
    saveSettings(settings);
  });

  // Outline enabled toggle
  document.getElementById('outlineEnabledToggle').addEventListener('change', (e) => {
    const outlineOptionsSection = document.getElementById('outlineOptionsSection');
    outlineOptionsSection.style.display = e.target.checked ? 'block' : 'none';
    
    const settings = getCurrentSettings();
    saveSettings(settings);
  });

  // Outline display mode selector
  document.getElementById('outlineDisplayMode').addEventListener('change', () => {
    const settings = getCurrentSettings();
    saveSettings(settings);
  });

  // Outline thickness slider
  document.getElementById('outlineThickness').addEventListener('input', (e) => {
    document.getElementById('outlineThicknessValue').textContent = e.target.value + 'px';
    const settings = getCurrentSettings();
    saveSettings(settings);
  });

  // Outline color picker
  document.getElementById('outlineColor').addEventListener('input', (e) => {
    document.getElementById('outlineColorText').value = e.target.value;
    const settings = getCurrentSettings();
    saveSettings(settings);
  });

  // Outline color text input
  document.getElementById('outlineColorText').addEventListener('input', (e) => {
    const color = e.target.value;
    if (/^#[0-9A-F]{6}$/i.test(color)) {
      document.getElementById('outlineColor').value = color;
      const settings = getCurrentSettings();
      saveSettings(settings);
    }
  });

  // Icon enabled toggle
  document.getElementById('iconEnabledToggle').addEventListener('change', (e) => {
    const iconColorSection = document.getElementById('iconColorSection');
    iconColorSection.style.display = e.target.checked ? 'block' : 'none';
    
    const iconFilterSection = document.getElementById('iconFilterSection');
    iconFilterSection.style.display = e.target.checked ? 'block' : 'none';
    
    const iconKeywordsSection = document.getElementById('iconKeywordsSection');
    // Keywords section is hidden for now - can be re-enabled if needed
    iconKeywordsSection.style.display = 'none';
    
    const settings = getCurrentSettings();
    saveSettings(settings);
  });

  // Icon white toggle
  document.getElementById('iconWhiteToggle').addEventListener('change', () => {
    const settings = getCurrentSettings();
    saveSettings(settings);
  });

  // Text color enabled toggle
  document.getElementById('textColorEnabledToggle').addEventListener('change', (e) => {
    const textColorOptionsSection = document.getElementById('textColorOptionsSection');
    textColorOptionsSection.style.display = e.target.checked ? 'block' : 'none';
    
    const settings = getCurrentSettings();
    saveSettings(settings);
  });

  // Text color display mode
  document.getElementById('textColorDisplayMode').addEventListener('change', () => {
    const settings = getCurrentSettings();
    saveSettings(settings);
  });

  // Text color picker
  document.getElementById('textColor').addEventListener('input', (e) => {
    document.getElementById('textColorText').value = e.target.value;
    const settings = getCurrentSettings();
    saveSettings(settings);
  });

  // Text color text input
  document.getElementById('textColorText').addEventListener('input', (e) => {
    const color = e.target.value;
    if (/^#[0-9A-F]{6}$/i.test(color)) {
      document.getElementById('textColor').value = color;
      const settings = getCurrentSettings();
      saveSettings(settings);
    }
  });

  // Icon display mode
  document.getElementById('iconDisplayMode').addEventListener('change', () => {
    const settings = getCurrentSettings();
    saveSettings(settings);
  });

  // Icon keywords
  document.getElementById('iconKeywords').addEventListener('input', (e) => {
    const settings = getCurrentSettings();
    saveSettings(settings);
  });

  // Custom SVG icon
  document.getElementById('customIconSvg').addEventListener('input', (e) => {
    const clearCustomIconBtn = document.getElementById('clearCustomIconBtn');
    clearCustomIconBtn.style.display = e.target.value.trim() ? 'block' : 'none';
    
    const settings = getCurrentSettings();
    saveSettings(settings);
  });

  // Clear custom icon button
  document.getElementById('clearCustomIconBtn').addEventListener('click', () => {
    document.getElementById('customIconSvg').value = '';
    document.getElementById('clearCustomIconBtn').style.display = 'none';
    
    const settings = getCurrentSettings();
    saveSettings(settings);
  });

  // Color picker
  document.getElementById('customColor').addEventListener('input', (e) => {
    document.getElementById('customColorText').value = e.target.value;
    const settings = getCurrentSettings();
    saveSettings(settings);
  });

  // Color text input
  document.getElementById('customColorText').addEventListener('input', (e) => {
    const color = e.target.value;
    if (/^#[0-9A-F]{6}$/i.test(color)) {
      document.getElementById('customColor').value = color;
      const settings = getCurrentSettings();
      saveSettings(settings);
    }
  });

  // Apply button
  document.getElementById('applyBtn').addEventListener('click', () => {
    const settings = getCurrentSettings();
    saveSettings(settings);
    
    // Show feedback
    const btn = document.getElementById('applyBtn');
    const originalText = btn.textContent;
    btn.textContent = 'Applied!';
    btn.style.backgroundColor = '#34a853';
    
    setTimeout(() => {
      btn.textContent = originalText;
      btn.style.backgroundColor = '';
    }, 1500);
  });

  // Reset button
  document.getElementById('resetBtn').addEventListener('click', () => {
    // Reset to defaults
    const resetSettings = {
      ...defaultSettings,
      filterMode: 'all', // Reset filter to 'all' mode
      filterKeywords: '',
      filterByTitle: true,
      filterByCalendar: false,
      caseSensitive: false,
      outlineEnabled: true,
      outlineDisplayMode: 'all',
      outlineThickness: 1,
      outlineColor: '#ffffff',
      iconEnabled: false,
      iconWhite: true,
      iconFilterMode: 'all',
      iconKeywords: '',
      customIconSvg: '',
      textWhite: true
    };
    saveSettings(resetSettings);
    loadSettings();
    
    // Show feedback
    const btn = document.getElementById('resetBtn');
    const originalText = btn.textContent;
    btn.textContent = 'Reset!';
    
    setTimeout(() => {
      btn.textContent = originalText;
    }, 1500);
  });
});

