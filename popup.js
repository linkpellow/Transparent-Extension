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
  textColor: '#ffffff', // Text color (default white)
  elementPickerEnabled: false, // Element picker enabled
  elementPickerActive: false, // Element picker currently active
  selectedElements: [] // Array of {selector, action, text}
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
    document.getElementById('elementPickerToggle').checked = settings.elementPickerEnabled || false;
    
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
    
    const elementPickerOptions = document.getElementById('elementPickerOptions');
    elementPickerOptions.style.display = settings.elementPickerEnabled ? 'block' : 'none';
    
    // Load and display selected elements
    loadSelectedElements(settings.selectedElements || []);
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
    textColor: document.getElementById('textColor').value,
    elementPickerEnabled: document.getElementById('elementPickerToggle').checked,
    elementPickerActive: false, // Will be set when picker is activated
    selectedElements: getSelectedElementsFromUI()
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

  // Listen for error messages from content script (set up once)
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'pickerError') {
      updatePickerStatus(message.message || 'Error: Please open an event popup first.', 'error');
      document.getElementById('startPickingBtn').style.display = 'block';
      document.getElementById('stopPickingBtn').style.display = 'none';
      sendResponse({ success: true });
      return true;
    }
    return false;
  });

  // Element picker toggle
  document.getElementById('elementPickerToggle').addEventListener('change', (e) => {
    const elementPickerOptions = document.getElementById('elementPickerOptions');
    elementPickerOptions.style.display = e.target.checked ? 'block' : 'none';
    
    if (!e.target.checked) {
      // Stop picking if picker is disabled
      stopElementPicking();
    }
    
    const settings = getCurrentSettings();
    saveSettings(settings);
  });

  // Start picking button
  document.getElementById('startPickingBtn').addEventListener('click', () => {
    startElementPicking();
  });

  // Stop picking button
  document.getElementById('stopPickingBtn').addEventListener('click', () => {
    stopElementPicking();
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

// Element Picker Functions

// Get selected elements from UI
function getSelectedElementsFromUI() {
  const container = document.getElementById('selectedElementsContainer');
  if (!container) return [];
  
  const elements = [];
  const items = container.querySelectorAll('.selected-element-item');
  
  items.forEach((item, index) => {
    const selector = item.querySelector('.element-selector')?.textContent || '';
    const actionSelect = item.querySelector('.element-action-select');
    const action = actionSelect ? actionSelect.value : 'hide';
    const textInput = item.querySelector('.element-text-input');
    const text = (action === 'insertText' && textInput) ? textInput.value : '';
    
    if (selector) {
      elements.push({ selector, action, text });
    }
  });
  
  return elements;
}

// Load and display selected elements
function loadSelectedElements(elements) {
  const container = document.getElementById('selectedElementsContainer');
  const listSection = document.getElementById('selectedElementsList');
  
  if (!container || !listSection) return;
  
  container.innerHTML = '';
  
  if (elements.length === 0) {
    listSection.style.display = 'none';
    return;
  }
  
  listSection.style.display = 'block';
  
  elements.forEach((element, index) => {
    const item = document.createElement('div');
    item.className = 'selected-element-item';
    item.dataset.index = index;
    
    const selectorDiv = document.createElement('div');
    selectorDiv.className = 'element-selector';
    selectorDiv.textContent = element.selector || '';
    
    const actionGroup = document.createElement('div');
    actionGroup.className = 'element-action-group';
    
    const actionSelect = document.createElement('select');
    actionSelect.className = 'element-action-select';
    actionSelect.innerHTML = `
      <option value="hide">Hide</option>
      <option value="remove">Remove</option>
      <option value="insertText">Insert Text</option>
    `;
    actionSelect.value = element.action || 'hide';
    
    const textInput = document.createElement('input');
    textInput.type = 'text';
    textInput.className = 'element-text-input';
    textInput.placeholder = 'Enter text to insert...';
    textInput.value = element.text || '';
    if (actionSelect.value === 'insertText') {
      textInput.classList.add('show');
    }
    
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-element-btn';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', () => {
      item.remove();
      updateSelectedElements();
    });
    
    actionSelect.addEventListener('change', (e) => {
      if (e.target.value === 'insertText') {
        textInput.classList.add('show');
      } else {
        textInput.classList.remove('show');
      }
      updateSelectedElements();
    });
    
    textInput.addEventListener('input', () => {
      updateSelectedElements();
    });
    
    actionGroup.appendChild(actionSelect);
    actionGroup.appendChild(textInput);
    actionGroup.appendChild(removeBtn);
    
    item.appendChild(selectorDiv);
    item.appendChild(actionGroup);
    container.appendChild(item);
  });
}

// Update selected elements in storage
function updateSelectedElements() {
  console.log('[TPI Popup] updateSelectedElements() called');
  const settings = getCurrentSettings();
  console.log('[TPI Popup] Settings to save:', settings);
  console.log('[TPI Popup] Selected elements:', settings.selectedElements);
  
  saveSettings(settings);
  
  // Immediately apply changes to any open popup
  console.log('[TPI Popup] Notifying content script to re-apply modifications...');
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs && tabs.length > 0 && tabs[0].url && tabs[0].url.includes('calendar.google.com')) {
      chrome.tabs.sendMessage(tabs[0].id, { 
        action: 'reapplyElementModifications' 
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('[TPI Popup] Error sending reapply message:', chrome.runtime.lastError);
        } else {
          console.log('[TPI Popup] Reapply message sent, response:', response);
        }
      });
    }
  });
}

// Start element picking mode
function startElementPicking() {
  console.log('[TPI Popup] startElementPicking() called');
  console.log('[TPI Popup] Step 1: Querying active tab...');
  
  // Get current tab
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    console.log('[TPI Popup] Step 2: Tab query callback executed');
    console.log('[TPI Popup] Tabs found:', tabs);
    console.log('[TPI Popup] Number of tabs:', tabs ? tabs.length : 0);
    
    if (!tabs || tabs.length === 0) {
      console.error('[TPI Popup] ERROR: No active tabs found');
      updatePickerStatus('Error: No active tab found. Please ensure a tab is open.', 'error');
      return;
    }
    
    const activeTab = tabs[0];
    console.log('[TPI Popup] Step 3: Active tab identified');
    console.log('[TPI Popup] Tab ID:', activeTab.id);
    console.log('[TPI Popup] Tab URL:', activeTab.url);
    console.log('[TPI Popup] Tab title:', activeTab.title);
    
    // Check if tab URL is Google Calendar
    if (!activeTab.url || !activeTab.url.includes('calendar.google.com')) {
      console.error('[TPI Popup] ERROR: Tab is not Google Calendar');
      console.error('[TPI Popup] Current URL:', activeTab.url);
      updatePickerStatus('Error: Please navigate to Google Calendar first.', 'error');
      return;
    }
    
    console.log('[TPI Popup] Step 4: Preparing to send message to content script');
    console.log('[TPI Popup] Message payload:', { action: 'startElementPicking' });
    console.log('[TPI Popup] Target tab ID:', activeTab.id);
    
    // Send message to content script to start picking
    try {
      console.log('[TPI Popup] Step 5: Calling chrome.tabs.sendMessage()...');
      chrome.tabs.sendMessage(activeTab.id, { action: 'startElementPicking' }, (response) => {
        console.log('[TPI Popup] Step 6: Message callback executed');
        console.log('[TPI Popup] chrome.runtime.lastError:', chrome.runtime.lastError);
        console.log('[TPI Popup] Response received:', response);
        console.log('[TPI Popup] Response type:', typeof response);
        console.log('[TPI Popup] Response is null?', response === null);
        console.log('[TPI Popup] Response is undefined?', response === undefined);
        
        if (chrome.runtime.lastError) {
          console.error('[TPI Popup] ERROR: chrome.runtime.lastError detected');
          console.error('[TPI Popup] Error message:', chrome.runtime.lastError.message);
          console.error('[TPI Popup] Full error object:', JSON.stringify(chrome.runtime.lastError, null, 2));
          console.error('[TPI Popup] Error stack:', chrome.runtime.lastError.stack || 'No stack trace');
          
          // Check for specific error types
          if (chrome.runtime.lastError.message.includes('Could not establish connection')) {
            console.error('[TPI Popup] DIAGNOSIS: Content script not loaded or context invalidated');
            console.error('[TPI Popup] SOLUTION: Content script may need to be reloaded');
            updatePickerStatus('Error: Content script not loaded. Please refresh the Google Calendar page.', 'error');
          } else if (chrome.runtime.lastError.message.includes('Receiving end does not exist')) {
            console.error('[TPI Popup] DIAGNOSIS: No message listener in content script');
            console.error('[TPI Popup] SOLUTION: Content script may not have message listener registered');
            updatePickerStatus('Error: Content script not responding. Please refresh the page.', 'error');
          } else {
            console.error('[TPI Popup] DIAGNOSIS: Unknown error type');
            updatePickerStatus('Error: Please refresh the Google Calendar page and try again.', 'error');
          }
          return;
        }
        
        console.log('[TPI Popup] Step 7: No runtime errors, checking response...');
        console.log('[TPI Popup] Response.success:', response ? response.success : 'N/A');
        console.log('[TPI Popup] Response.success === true?', response && response.success === true);
        
        if (response && response.success) {
          console.log('[TPI Popup] Step 8: SUCCESS - Response indicates success');
          console.log('[TPI Popup] Updating UI elements...');
          
          // Update UI
          const startBtn = document.getElementById('startPickingBtn');
          const stopBtn = document.getElementById('stopPickingBtn');
          
          console.log('[TPI Popup] Start button element:', startBtn);
          console.log('[TPI Popup] Stop button element:', stopBtn);
          
          if (startBtn) {
            startBtn.style.display = 'none';
            console.log('[TPI Popup] Start button hidden');
          } else {
            console.warn('[TPI Popup] WARNING: Start button element not found');
          }
          
          if (stopBtn) {
            stopBtn.style.display = 'block';
            console.log('[TPI Popup] Stop button shown');
          } else {
            console.warn('[TPI Popup] WARNING: Stop button element not found');
          }
          
          updatePickerStatus('Picking mode active. Click any element in the event popup to select it.', 'active');
          console.log('[TPI Popup] Status updated to active');
          
          // Update settings
          console.log('[TPI Popup] Step 9: Updating settings...');
          const settings = getCurrentSettings();
          console.log('[TPI Popup] Current settings:', settings);
          settings.elementPickerActive = true;
          console.log('[TPI Popup] Settings updated, saving...');
          saveSettings(settings);
          console.log('[TPI Popup] Settings saved successfully');
          console.log('[TPI Popup] COMPLETE: Element picker started successfully');
        } else {
          console.error('[TPI Popup] ERROR: Response does not indicate success');
          console.error('[TPI Popup] Response value:', response);
          console.error('[TPI Popup] Response.success value:', response ? response.success : 'N/A');
          updatePickerStatus('Error starting picker. Please refresh the page.', 'error');
        }
      });
    } catch (error) {
      console.error('[TPI Popup] EXCEPTION: Caught error in try-catch block');
      console.error('[TPI Popup] Exception type:', error.constructor.name);
      console.error('[TPI Popup] Exception message:', error.message);
      console.error('[TPI Popup] Exception stack:', error.stack);
      updatePickerStatus('Error: Unexpected error occurred. Check console for details.', 'error');
    }
  });
  
  console.log('[TPI Popup] startElementPicking() function call completed (async operations continue)');
}

// Stop element picking mode
function stopElementPicking() {
  console.log('[TPI Popup] stopElementPicking() called');
  
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    console.log('[TPI Popup] Stop: Tab query completed, tabs:', tabs);
    
    if (!tabs || tabs.length === 0) {
      console.error('[TPI Popup] Stop: ERROR - No active tabs found');
      return;
    }
    
    const activeTab = tabs[0];
    console.log('[TPI Popup] Stop: Sending message to tab ID:', activeTab.id);
    
    chrome.tabs.sendMessage(activeTab.id, { action: 'stopElementPicking' }, (response) => {
      console.log('[TPI Popup] Stop: Message callback executed');
      console.log('[TPI Popup] Stop: chrome.runtime.lastError:', chrome.runtime.lastError);
      console.log('[TPI Popup] Stop: Response:', response);
      
      if (chrome.runtime.lastError) {
        console.error('[TPI Popup] Stop: ERROR -', chrome.runtime.lastError.message);
      }
      
      // Update UI
      const startBtn = document.getElementById('startPickingBtn');
      const stopBtn = document.getElementById('stopPickingBtn');
      
      if (startBtn) {
        startBtn.style.display = 'block';
        console.log('[TPI Popup] Stop: Start button shown');
      }
      
      if (stopBtn) {
        stopBtn.style.display = 'none';
        console.log('[TPI Popup] Stop: Stop button hidden');
      }
      
      updatePickerStatus('Picking mode stopped. Click "Start Picking" to begin again.', 'inactive');
      
      // Update settings
      const settings = getCurrentSettings();
      settings.elementPickerActive = false;
      saveSettings(settings);
      console.log('[TPI Popup] Stop: Settings updated');
    });
  });
}

// Update picker status message
function updatePickerStatus(message, status = 'inactive') {
  const statusText = document.getElementById('pickerStatusText');
  const statusDiv = document.getElementById('pickerStatus');
  
  if (statusText) {
    statusText.textContent = message;
  }
  
  if (statusDiv) {
    statusDiv.className = 'picker-status';
    if (status === 'active') {
      statusDiv.style.borderColor = '#00bcd4';
      statusDiv.style.backgroundColor = 'rgba(0, 188, 212, 0.2)';
    } else if (status === 'error') {
      statusDiv.style.borderColor = '#ea4335';
      statusDiv.style.backgroundColor = 'rgba(234, 67, 53, 0.2)';
      statusDiv.style.color = '#ea4335';
    } else {
      statusDiv.style.borderColor = 'rgba(0, 188, 212, 0.3)';
      statusDiv.style.backgroundColor = 'rgba(0, 188, 212, 0.1)';
      statusDiv.style.color = '#00bcd4';
    }
  }
}

// Listen for messages from content script about element selection
// Note: This listener is set up in the content script, but we need to handle it in popup
// The content script will send messages via chrome.runtime.sendMessage
// We'll poll for new elements or use storage change events instead

// Listen for storage changes to detect new element selections
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync' && changes.tpiElementSelection) {
    // New element was selected
    const newElement = changes.tpiElementSelection.newValue;
    if (newElement) {
      const settings = getCurrentSettings();
      settings.selectedElements = settings.selectedElements || [];
      
      // Check if element already exists
      const exists = settings.selectedElements.some(el => el.selector === newElement.selector);
      if (!exists) {
        settings.selectedElements.push(newElement);
        saveSettings(settings);
        loadSelectedElements(settings.selectedElements);
        updatePickerStatus(`Element selected: ${newElement.selector.substring(0, 50)}...`, 'active');
      }
    }
  }
});

