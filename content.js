// TPI - Google Calendar Color Changer
// This script modifies the colors of Google Calendar events

(function() {
  'use strict';

  // Default color settings
  const defaultSettings = {
    enabled: true,
    filterMode: 'all', // 'all' or 'filtered'
    filterKeywords: '',
    filterByTitle: true,
    filterByCalendar: false,
    caseSensitive: false,
    colorMode: 'random', // 'random', 'gradient', 'custom'
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
    elementPickerEnabled: false,
    elementPickerActive: false,
    selectedElements: [] // Array of {selector, action, text}
  };

  // Load settings from storage
  async function loadSettings() {
    try {
      // Check if extension context is still valid before creating Promise
      if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.sync) {
        console.debug('TPI: Extension context invalidated, using default settings');
        return defaultSettings;
      }
      
      return new Promise((resolve) => {
        try {
          chrome.storage.sync.get(['tpiSettings'], (result) => {
            try {
              if (chrome.runtime && chrome.runtime.lastError) {
                console.debug('TPI: Error loading settings:', chrome.runtime.lastError.message);
                resolve(defaultSettings);
                return;
              }
              resolve(result.tpiSettings || defaultSettings);
            } catch (error) {
              console.debug('TPI: Error in storage callback:', error);
              resolve(defaultSettings);
            }
          });
        } catch (error) {
          console.debug('TPI: Error accessing chrome.storage:', error);
          resolve(defaultSettings);
        }
      });
    } catch (error) {
      console.debug('TPI: Error in loadSettings:', error);
      return defaultSettings;
    }
  }

  // Save settings to storage
  function saveSettings(settings) {
    try {
      // Check if extension context is still valid
      if (!chrome.storage || !chrome.storage.sync) {
        console.debug('TPI: Extension context invalidated, cannot save settings');
        return;
      }
      
      chrome.storage.sync.set({ tpiSettings: settings }, () => {
        if (chrome.runtime.lastError) {
          console.debug('TPI: Error saving settings:', chrome.runtime.lastError.message);
        }
      });
    } catch (error) {
      console.debug('TPI: Error in saveSettings:', error);
    }
  }

  // Convert hex color to RGB object
  function hexToRgb(hex) {
    if (!hex) return null;
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }

  // Generate a random color
  function getRandomColor() {
    const colors = [
      '#4285f4', // Blue
      '#ea4335', // Red
      '#fbbc04', // Yellow
      '#34a853', // Green
      '#ff6d01', // Orange
      '#9334e6', // Purple
      '#e8710a', // Deep Orange
      '#0b8043', // Dark Green
      '#d50000', // Dark Red
      '#304ffe', // Indigo
      '#c51162', // Pink
      '#00acc1'  // Cyan
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  // Generate gradient colors
  function getGradientColor(index) {
    const hue = (index * 137.508) % 360; // Golden angle approximation
    return `hsl(${hue}, 70%, 50%)`;
  }

  // Check if an event matches the filter criteria
  function eventMatchesFilter(eventElement, settings) {
    // If filter mode is 'all', match everything
    if (settings.filterMode !== 'filtered') {
      return true;
    }

    // If no keywords, don't match anything (safety check)
    if (!settings.filterKeywords || settings.filterKeywords.trim() === '') {
      return false;
    }

    // Get keywords from settings (split by newlines)
    const keywords = settings.filterKeywords
      .split('\n')
      .map(k => k.trim())
      .filter(k => k.length > 0);

    if (keywords.length === 0) {
      return false;
    }

    // Get event text content
    const eventText = eventElement.textContent || '';
    const ariaLabel = eventElement.getAttribute('aria-label') || '';
    
    // Try to extract event title and calendar name from aria-label
    // Format is often: "time, Title, Calendar: CalendarName, ..."
    let eventTitle = '';
    let calendarName = '';
    
    if (ariaLabel) {
      const parts = ariaLabel.split(',');
      if (parts.length >= 2) {
        eventTitle = parts[1].trim();
      }
      // Look for "Calendar: Name" pattern
      const calendarMatch = ariaLabel.match(/Calendar:\s*([^,]+)/i);
      if (calendarMatch) {
        calendarName = calendarMatch[1].trim();
      }
    }

    // Also try to get title from visible text elements
    const titleElement = eventElement.querySelector('.I0UMhf, .KcY3wb, [class*="title"], [class*="Title"]');
    if (titleElement) {
      eventTitle = titleElement.textContent.trim() || eventTitle;
    }

    // Prepare text for matching
    const prepareText = (text) => {
      return settings.caseSensitive ? text : text.toLowerCase();
    };

    // Check each keyword
    for (const keyword of keywords) {
      const searchKeyword = prepareText(keyword);
      
      // Check event title if enabled
      if (settings.filterByTitle) {
        const titleText = prepareText(eventTitle || eventText || ariaLabel);
        if (titleText.includes(searchKeyword)) {
          return true;
        }
      }
      
      // Check calendar name if enabled
      if (settings.filterByCalendar && calendarName) {
        const calendarText = prepareText(calendarName);
        if (calendarText.includes(searchKeyword)) {
          return true;
        }
      }
      
      // Fallback: check full text content if title matching is enabled
      if (settings.filterByTitle && !eventTitle) {
        const fullText = prepareText(eventText || ariaLabel);
        if (fullText.includes(searchKeyword)) {
          return true;
        }
      }
    }

    return false;
  }

  // Load default umbrella SVG from file
  let defaultUmbrellaSvgCache = null;
  
  async function loadDefaultUmbrellaSvg() {
    if (defaultUmbrellaSvgCache) {
      return defaultUmbrellaSvgCache;
    }
    
    try {
      const svgUrl = chrome.runtime.getURL('UMBRELLA.svg');
      const response = await fetch(svgUrl);
      const svgText = await response.text();
      defaultUmbrellaSvgCache = svgText;
      return svgText;
    } catch (e) {
      console.debug('TPI: Error loading UMBRELLA.svg, using fallback', e);
      return null;
    }
  }

  // Create icon SVG element (umbrella or custom)
  async function createUmbrellaIcon(settings) {
    // Check if custom SVG is provided
    if (settings && settings.customIconSvg && settings.customIconSvg.trim()) {
      try {
        // Parse the custom SVG
        const parser = new DOMParser();
        const doc = parser.parseFromString(settings.customIconSvg.trim(), 'image/svg+xml');
        const customSvg = doc.querySelector('svg');
        
        if (customSvg) {
          // Clone the custom SVG
          const svg = customSvg.cloneNode(true);
          
          // Set standard attributes
          svg.setAttribute('width', '14');
          svg.setAttribute('height', '14');
          svg.style.cssText = 'display: inline-block; vertical-align: middle; margin-right: 4px; width: 14px; height: 14px;';
          svg.classList.add('tpi-umbrella-icon');
          
          // Apply color based on settings
          if (settings) {
            applyIconColor(svg, settings);
          }
          
          return svg;
        }
      } catch (e) {
        console.debug('TPI: Error parsing custom SVG, using default icon', e);
        // Fall through to default umbrella icon
      }
    }
    
    // Load and use default umbrella SVG from file
    const defaultSvgText = await loadDefaultUmbrellaSvg();
    if (defaultSvgText) {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(defaultSvgText, 'image/svg+xml');
        const defaultSvg = doc.querySelector('svg');
        
        if (defaultSvg) {
          const svg = defaultSvg.cloneNode(true);
          
          // Set standard attributes
          svg.setAttribute('width', '14');
          svg.setAttribute('height', '14');
          svg.style.cssText = 'display: inline-block; vertical-align: middle; margin-right: 4px; width: 14px; height: 14px;';
          svg.classList.add('tpi-umbrella-icon');
          
          // Apply color based on settings
          if (settings) {
            applyIconColor(svg, settings);
          }
          
          return svg;
        }
      } catch (e) {
        console.debug('TPI: Error parsing default SVG, using fallback', e);
      }
    }
    
    // Fallback: Create a simple SVG if loading/parsing fails
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '14');
    svg.setAttribute('height', '14');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.style.cssText = 'display: inline-block; vertical-align: middle; margin-right: 4px; width: 14px; height: 14px;';
    svg.classList.add('tpi-umbrella-icon');
    
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M12 4C7 4 3 8 3 13C3 13.55 3.45 14 4 14H20C20.55 14 21 13.55 21 13C21 8 17 4 12 4Z');
    path.setAttribute('fill', 'currentColor');
    svg.appendChild(path);
    
    if (settings) {
      applyIconColor(svg, settings);
    }
    
    return svg;
  }

  // Apply color to umbrella icon based on settings
  function applyIconColor(iconElement, settings) {
    if (!iconElement) return;
    
    const color = (settings.iconWhite !== false) ? '#ffffff' : '#202124';
    iconElement.style.setProperty('color', color, 'important');
    
    // Apply to all SVG children
    const paths = iconElement.querySelectorAll('path, circle, line');
    paths.forEach(path => {
      if (path.getAttribute('fill') && path.getAttribute('fill') !== 'none') {
        path.setAttribute('fill', color);
      }
      if (path.getAttribute('stroke') && path.getAttribute('stroke') !== 'none') {
        path.setAttribute('stroke', color);
      }
    });
  }

  // Check if an event should get an icon
  function shouldShowIcon(eventElement, settings) {
    if (!settings.iconEnabled) {
      return false;
    }

    // Use iconDisplayMode (new) or fall back to iconFilterMode (legacy) for backward compatibility
    const displayMode = settings.iconDisplayMode || settings.iconFilterMode || 'all';

    // If icon display mode is 'all', show on all events
    if (displayMode === 'all') {
      return true;
    }

    // If icon display mode is 'filtered', use the same filter as colors
    if (displayMode === 'filtered') {
      return eventMatchesFilter(eventElement, settings);
    }

    // Legacy support: If icon filter mode is 'keywords', check icon-specific keywords
    if (settings.iconFilterMode === 'keywords') {
      if (!settings.iconKeywords || settings.iconKeywords.trim() === '') {
        return true; // If no keywords, show on all (or return false if you want none)
      }

      const keywords = settings.iconKeywords
        .split('\n')
        .map(k => k.trim())
        .filter(k => k.length > 0);

      if (keywords.length === 0) {
        return true; // No keywords means all events
      }

      // Get event text
      const eventText = eventElement.textContent || '';
      const ariaLabel = eventElement.getAttribute('aria-label') || '';
      
      // Extract title
      let eventTitle = '';
      if (ariaLabel) {
        const parts = ariaLabel.split(',');
        if (parts.length >= 2) {
          eventTitle = parts[1].trim();
        }
      }
      
      const titleElement = eventElement.querySelector('.I0UMhf, .KcY3wb');
      if (titleElement) {
        eventTitle = titleElement.textContent.trim() || eventTitle;
      }

      const prepareText = (text) => {
        return settings.caseSensitive ? text : text.toLowerCase();
      };

      // Check if any keyword matches
      for (const keyword of keywords) {
        const searchKeyword = prepareText(keyword);
        const titleText = prepareText(eventTitle || eventText || ariaLabel);
        if (titleText.includes(searchKeyword)) {
          return true;
        }
      }

      return false;
    }

    return false;
  }


  // Style .xnWuge element with umbrella SVG background
  function styleXnWugeElement(popup) {
    if (!popup) return;
    
    // Get extension ID
    const extensionId = chrome.runtime.id;
    const umbrellaSvgUrl = `chrome-extension://${extensionId}/UMBRELLA.svg`;
    
    // Find and style all .xnWuge elements
    const xnWugeElements = popup.querySelectorAll('.xnWuge');
    xnWugeElements.forEach(umbrellaEl => {
      if (umbrellaEl) {
        umbrellaEl.style.setProperty(
          'background-image',
          `url("${umbrellaSvgUrl}")`,
          'important'
        );
        umbrellaEl.style.setProperty('background-repeat', 'no-repeat', 'important');
        umbrellaEl.style.setProperty('background-position', 'center', 'important');
        umbrellaEl.style.setProperty('background-size', 'contain', 'important');
        
        // Keep brand color as the backing fill if the SVG has transparency
        umbrellaEl.style.setProperty('background-color', 'rgb(75, 153, 210)', 'important');
      }
    });
    
    // Also try document-wide query and filter to popup
    const allXnWuge = Array.from(document.querySelectorAll('.xnWuge')).filter(el => popup.contains(el));
    allXnWuge.forEach(umbrellaEl => {
      if (umbrellaEl) {
        umbrellaEl.style.setProperty(
          'background-image',
          `url("${umbrellaSvgUrl}")`,
          'important'
        );
        umbrellaEl.style.setProperty('background-repeat', 'no-repeat', 'important');
        umbrellaEl.style.setProperty('background-position', 'center', 'important');
        umbrellaEl.style.setProperty('background-size', 'contain', 'important');
        umbrellaEl.style.setProperty('background-color', 'rgb(75, 153, 210)', 'important');
      }
    });
  }
  
  // Remove specific element by selector
  function removeSpecificElement(popup) {
    if (!popup) return;
    
    // Remove the specific element: #xDetDlg > div > div.hMdQi > div.nBzcnc.OjZ2cc.OcVpRe.Q7NH3.N1DhNb > div.zZj8Pb.EaVNbc > div
    const selector = '#xDetDlg > div > div.hMdQi > div.nBzcnc.OjZ2cc.OcVpRe.Q7NH3.N1DhNb > div.zZj8Pb.EaVNbc > div';
    
    // Try within popup first
    let elements = popup.querySelectorAll(selector);
    
    // If not found, try document-wide but filter to popup
    if (elements.length === 0) {
      elements = Array.from(document.querySelectorAll(selector)).filter(el => popup.contains(el));
    }
    
    elements.forEach(el => {
      if (el.parentNode) {
        el.remove();
      }
    });
  }

  // Inject umbrella icon into popup event title
  async function injectIconIntoPopupTitle(popup, settings) {
    if (!popup || !settings.iconEnabled) return;
    
    // Find the event title element in the popup
    const titleSelectors = ['.UfeRlc', '.UfeRlc span[role="heading"]', '#rAECCd', '[role="heading"]'];
    let titleElement = null;
    
    for (const selector of titleSelectors) {
      const elements = popup.querySelectorAll(selector);
      for (const el of elements) {
        // Make sure it's actually a title (has text content)
        if (el.textContent && el.textContent.trim().length > 0) {
          titleElement = el;
          break;
        }
      }
      if (titleElement) break;
    }
    
    if (!titleElement) return;
    
    // Check if icon already exists
    const existingIcon = titleElement.querySelector('.tpi-popup-title-icon');
    if (existingIcon) {
      // Update icon if settings changed
      applyIconColor(existingIcon, settings);
      return;
    }
    
    // Create umbrella icon
    const icon = await createUmbrellaIcon(settings);
    if (!icon) return;
    
    // Style for popup title (inline, next to text)
    icon.classList.add('tpi-popup-title-icon');
    icon.style.cssText = 'display: inline-block; vertical-align: middle; margin-right: 8px; width: 18px; height: 18px;';
    
    // Apply color
    applyIconColor(icon, settings);
    
    // Insert icon at the beginning of the title element
    if (titleElement.firstChild) {
      titleElement.insertBefore(icon, titleElement.firstChild);
    } else {
      titleElement.appendChild(icon);
    }
  }
  
  // Inject umbrella icon into event title
  function injectIconIntoEvent(eventElement, settings) {
    // CRITICAL: Never inject icons into popup elements - only into actual calendar event bars
    // Check if this element is inside the popup (.hMdQi)
    if (eventElement.closest && eventElement.closest('.hMdQi')) {
      return; // Don't inject icon into popup elements
    }
    // Also check if this element itself is the popup or a popup child
    if (eventElement.classList && (eventElement.classList.contains('hMdQi') || 
        eventElement.classList.contains('xnWuge') ||
        (eventElement.querySelector && eventElement.querySelector('.hMdQi')))) {
      return; // Don't inject icon into popup elements
    }
    
    if (!shouldShowIcon(eventElement, settings)) {
      // Remove icon if it exists but shouldn't be shown
      const existingIcon = eventElement.querySelector('.tpi-umbrella-icon');
      if (existingIcon) {
        existingIcon.remove();
      }
      return;
    }

    // Check if icon already exists
    const existingIcon = eventElement.querySelector('.tpi-umbrella-icon');
    if (existingIcon) {
      // Update icon color if settings changed
      applyIconColor(existingIcon, settings);
      return; // Icon already added
    }

    // Find the main event container (the event bar itself)
    // This is typically the element with data-eventid or the main event wrapper
    let containerEl = null;
    
    // Priority 1: Element with role="button" and data-eventid (main event container)
    if (eventElement.getAttribute('role') === 'button' && eventElement.hasAttribute('data-eventid')) {
      containerEl = eventElement;
    } else {
      // Look for the main event container within the event element
      const mainContainer = eventElement.querySelector('[role="button"][data-eventid], [data-eventid].GTG3wb, [data-eventid].ChfiMc');
      if (mainContainer) {
        containerEl = mainContainer;
      } else {
        // Fallback: use the event element itself if it looks like a container
        containerEl = eventElement;
      }
    }

    if (!containerEl) {
      return; // No suitable container found
    }

    // Ensure container has position: relative for absolute positioning
    const containerStyle = window.getComputedStyle(containerEl);
    if (containerStyle.position === 'static' || !containerStyle.position) {
      containerEl.style.setProperty('position', 'relative', 'important');
    }

    // Position icon without adding padding to prevent width expansion
    // The icon will be absolutely positioned and won't affect the container's width
    const iconWidth = 20;
    const iconSpacing = 20; // Spacing from right edge - no padding needed since icon is absolutely positioned

    // Create and inject icon on the far right
    createUmbrellaIcon(settings).then(icon => {
      if (icon && containerEl && !containerEl.querySelector('.tpi-umbrella-icon')) {
        // Set absolute positioning for far-right placement
        icon.style.setProperty('position', 'absolute', 'important');
        // Position icon closer to text by using a smaller right offset
        // This prevents the need for padding that would expand the width
        icon.style.setProperty('right', iconSpacing + 'px', 'important');
        icon.style.setProperty('top', '50%', 'important');
        icon.style.setProperty('transform', 'translateY(-50%)', 'important');
        icon.style.setProperty('width', iconWidth + 'px', 'important');
        icon.style.setProperty('height', iconWidth + 'px', 'important');
        icon.style.setProperty('display', 'block', 'important');
        icon.style.setProperty('z-index', '10', 'important');
        icon.style.setProperty('pointer-events', 'none', 'important');
        icon.classList.add('tpi-far-right-icon');
        
        // For SVG elements, ensure proper sizing
        const svgElement = icon.tagName === 'svg' ? icon : icon.querySelector('svg');
        if (svgElement) {
          svgElement.setAttribute('width', iconWidth);
          svgElement.setAttribute('height', iconWidth);
          svgElement.style.setProperty('width', iconWidth + 'px', 'important');
          svgElement.style.setProperty('height', iconWidth + 'px', 'important');
        }

        containerEl.appendChild(icon);
      }
    });
  }

  // Apply color to a calendar event
  function applyColorToEvent(eventElement, color) {
    if (!eventElement) return;

    // CRITICAL: Never apply colors to popup elements - only to actual calendar event bars
    // Check if this element is inside the popup (.hMdQi)
    if (eventElement.closest && eventElement.closest('.hMdQi')) {
      return; // Don't apply colors to popup elements
    }
    // Also check if this element itself is the popup or a popup child
    if (eventElement.classList && (eventElement.classList.contains('hMdQi') || 
        eventElement.classList.contains('xnWuge'))) {
      return; // Don't apply colors to popup elements
    }

    // Google Calendar event structure:
    // Main container: [role="button"][data-eventid] with inline background-color and border-color
    // Inside: .QZVPzb > .jSrjCf with background-color (color indicator)
    
    // Method 1: Update the main event container's background and border colors
    // This is the primary visual element that shows the event color
    eventElement.style.setProperty('background-color', color, 'important');
    eventElement.style.setProperty('border-color', color, 'important');
    
    // Method 2: Update the color indicator (.jSrjCf) inside .QZVPzb
    // This is the small colored bar/indicator inside the event
    const colorIndicator = eventElement.querySelector('.jSrjCf');
    if (colorIndicator) {
      colorIndicator.style.setProperty('background-color', color, 'important');
    }
    
    // Method 3: Find .QZVPzb container and update its .jSrjCf child
    const qzvpzbContainer = eventElement.querySelector('.QZVPzb');
    if (qzvpzbContainer) {
      const indicator = qzvpzbContainer.querySelector('.jSrjCf');
      if (indicator) {
        indicator.style.setProperty('background-color', color, 'important');
      }
    }
    
    // Method 4: Find all .jSrjCf elements within this event (comprehensive coverage)
    const allIndicators = eventElement.querySelectorAll('.jSrjCf');
    allIndicators.forEach(indicator => {
      indicator.style.setProperty('background-color', color, 'important');
    });
    
    // Method 5: Update any inline style attributes that contain background-color
    // This catches dynamically set styles
    // IMPORTANT: Exclude popup elements (.hMdQi and its children)
    const elementsWithBgColor = eventElement.querySelectorAll('[style*="background-color"]');
    elementsWithBgColor.forEach(el => {
      // Skip popup elements - never apply colors to popup's colored background
      if (el.closest && el.closest('.hMdQi')) {
        return; // Don't modify popup elements
      }
      if (el.classList && (el.classList.contains('hMdQi') || el.classList.contains('xnWuge'))) {
        return; // Don't modify popup elements
      }
      
      const style = el.getAttribute('style') || '';
      if (style.includes('background-color')) {
        el.style.setProperty('background-color', color, 'important');
      }
      if (style.includes('border-color')) {
        el.style.setProperty('border-color', color, 'important');
      }
    });
    
    // Method 6: Set CSS custom property for advanced styling and future use
    eventElement.style.setProperty('--tpi-event-color', color, 'important');
    
    // Method 7: Set data attribute for tracking and CSS targeting
    eventElement.setAttribute('data-tpi-color', color);
    eventElement.classList.add('tpi-colored-event');
  }

  // Process all calendar events on the page
  async function processCalendarEvents() {
    const settings = await loadSettings();
    
    if (!settings.enabled) {
      return;
    }

    // Find all calendar event elements
    // Primary structure: [role="button"][data-eventid] containing .QZVPzb > .jSrjCf
    const eventSelectors = [
      // Primary: Main event containers with data-eventid (most reliable)
      '[role="button"][data-eventid]',
      '[role="button"][data-eventchip]',
      
      // Events with the color indicator structure
      '[role="button"]:has(.jSrjCf)',
      '[data-eventid]:has(.QZVPzb)',
      
      // Direct color indicator containers
      '.QZVPzb', // Event container with color indicator
      
      // Fallback selectors for different views
      '[data-eventid]',
      '[data-event-id]',
      '[jslog*="event"]',
      
      // Common event containers
      '.YvxZqe', // Primary event container class
      '[role="button"][aria-label*="Event"]',
      '[role="button"][aria-label*="event"]',
      
      // Week/Day view events with inline styles
      '[style*="background-color"][role="button"]',
      '[jsaction*="event"]',
      
      // Agenda view
      '[data-event-chip]',
      '[data-event-chip-id]'
    ];

    let events = new Set();
    
    eventSelectors.forEach(selector => {
      try {
          const found = document.querySelectorAll(selector);
          found.forEach(el => {
            // CRITICAL: Skip popup elements - never process elements inside or that are the popup
            if (el.closest && el.closest('.hMdQi')) {
              return; // Skip popup elements
            }
            if (el.classList && el.classList.contains('hMdQi')) {
              return; // Skip the popup itself
            }
            
            // Priority 1: Main event container with role="button" and data-eventid
          if (el.getAttribute('role') === 'button' && el.hasAttribute('data-eventid')) {
            events.add(el);
            return;
          }
          
          // Priority 2: Element with data-eventid (event identifier)
          if (el.hasAttribute('data-eventid')) {
            // Make sure it's the main container, not a child
            if (el.getAttribute('role') === 'button' || 
                el.classList.contains('GTG3wb') ||
                el.style.backgroundColor) {
              events.add(el);
              return;
            }
            // Otherwise, find the parent button container
            let parent = el.parentElement;
            let depth = 0;
            while (parent && depth < 5) {
              if (parent.getAttribute('role') === 'button' && parent.hasAttribute('data-eventid')) {
                events.add(parent);
                return;
              }
              parent = parent.parentElement;
              depth++;
            }
          }
          
          // Priority 3: .QZVPzb containers (color indicator wrapper)
          if (el.classList.contains('QZVPzb')) {
            // Find the parent event container
            let parent = el.parentElement;
            let depth = 0;
            while (parent && depth < 5) {
              if (parent.getAttribute('role') === 'button' && parent.hasAttribute('data-eventid')) {
                events.add(parent);
                return;
              }
              parent = parent.parentElement;
              depth++;
            }
            // If no button parent found, use the QZVPzb itself
            events.add(el);
            return;
          }
          
          // Priority 4: Elements containing .jSrjCf (color indicator)
          if (el.querySelector('.jSrjCf')) {
            // Check if this is already a main event container
            if (el.getAttribute('role') === 'button' && el.hasAttribute('data-eventid')) {
              events.add(el);
              return;
            }
            // Otherwise find the parent event container
            let parent = el.parentElement;
            let depth = 0;
            while (parent && depth < 5) {
              if (parent.getAttribute('role') === 'button' && parent.hasAttribute('data-eventid')) {
                events.add(parent);
                return;
              }
              parent = parent.parentElement;
              depth++;
            }
            events.add(el);
            return;
          }
          
          // Fallback: Filter to only actual calendar events
          const hasContent = el.textContent && el.textContent.trim().length > 0;
          const hasEventStructure = el.hasAttribute('data-eventid') || 
                                   el.getAttribute('role') === 'button' ||
                                   el.classList.contains('YvxZqe') ||
                                   el.classList.contains('GTG3wb');
          const hasVisualIndicator = el.style.backgroundColor || 
                                     window.getComputedStyle(el).backgroundColor !== 'rgba(0, 0, 0, 0)';
          
          if (hasEventStructure && (hasContent || hasVisualIndicator)) {
            // Find the top-level event container
            let eventContainer = el;
            let parent = el.parentElement;
            let depth = 0;
            
            while (parent && depth < 5) {
              if (parent.getAttribute('role') === 'button' && parent.hasAttribute('data-eventid')) {
                eventContainer = parent;
                break;
              }
              parent = parent.parentElement;
              depth++;
            }
            
            events.add(eventContainer);
          }
        });
      } catch (e) {
        // Silently handle selector errors (e.g., :has() not supported in all browsers)
        if (!selector.includes(':has')) {
          console.debug('TPI: Selector error', selector, e);
        }
      }
    });

    // Convert Set to Array and filter out popup elements
    events = Array.from(events).filter(event => {
      // CRITICAL: Exclude any elements inside or that are the popup (.hMdQi)
      if (event.closest && event.closest('.hMdQi')) {
        return false; // Don't process popup elements
      }
      if (event.classList && event.classList.contains('hMdQi')) {
        return false; // Don't process the popup itself
      }
      return true; // Process this event
    });

    // Apply colors to events
    let filteredIndex = 0; // Index for gradient mode when filtering
    
    events.forEach((event, index) => {
      // If already processed, check if color needs to be re-applied
      if (event.hasAttribute('data-tpi-processed')) {
        // Check if this event has a stored color that needs to be re-applied
        const storedColor = event.getAttribute('data-tpi-color');
        if (storedColor) {
          // Verify the color is still applied, if not, re-apply it
          const currentBg = window.getComputedStyle(event).backgroundColor;
          const storedColorRgb = hexToRgb(storedColor);
          
          // If color doesn't match, re-apply it
          if (storedColorRgb) {
            const expectedRgb = `rgb(${storedColorRgb.r}, ${storedColorRgb.g}, ${storedColorRgb.b})`;
            if (currentBg !== expectedRgb && currentBg !== storedColor) {
              applyColorToEvent(event, storedColor);
            }
          }
        }
        
        // Still check for icons even if already processed (in case icon settings changed)
        if (settings.iconEnabled) {
          injectIconIntoEvent(event, settings);
        }
        // Re-apply outline and text color in case settings changed
        applyOutlineToEvent(event, settings);
        applyTextColor(event, settings);
        return;
      }

      // Inject umbrella icon if enabled (do this before color filtering)
      if (settings.iconEnabled) {
        injectIconIntoEvent(event, settings);
      }

      // Check if event matches filter criteria for colors
      const matchesColorFilter = eventMatchesFilter(event, settings);
      if (!matchesColorFilter) {
        // Still apply outline if outline display mode is 'all'
        if (settings.outlineEnabled && settings.outlineDisplayMode === 'all') {
          applyOutlineToEvent(event, settings);
        }
        event.setAttribute('data-tpi-processed', 'true');
        return; // Skip coloring this event if it doesn't match the filter
      }

      let color;
      switch (settings.colorMode) {
        case 'random':
          color = getRandomColor();
          break;
        case 'gradient':
          color = getGradientColor(filteredIndex);
          filteredIndex++;
          break;
        case 'custom':
          color = settings.customColor;
          break;
        default:
          color = getRandomColor();
      }

      applyColorToEvent(event, color);
      // Apply outline (will check display mode internally)
      applyOutlineToEvent(event, settings);
      applyTextColor(event, settings);
      event.setAttribute('data-tpi-processed', 'true');
    });
  }

  // Apply outline to a calendar event
  function applyOutlineToEvent(eventElement, settings) {
    if (!eventElement) return;

    // CRITICAL: Never apply outlines to popup elements - only to actual calendar event bars
    // Check if this element is inside the popup (.hMdQi)
    if (eventElement.closest && eventElement.closest('.hMdQi')) {
      return; // Don't apply outline to popup elements
    }
    // Also check if this element itself is the popup or a popup child
    if (eventElement.classList && (eventElement.classList.contains('hMdQi') || 
        eventElement.classList.contains('xnWuge') ||
        eventElement.querySelector && eventElement.querySelector('.hMdQi'))) {
      return; // Don't apply outline to popup elements
    }

    // Remove outline if disabled
    if (!settings.outlineEnabled) {
      eventElement.style.setProperty('box-shadow', '', 'important');
      eventElement.style.setProperty('border', '', 'important');
      eventElement.style.setProperty('outline', '', 'important');
      eventElement.style.setProperty('outline-offset', '', 'important');
      return;
    }

    // Check if outline should be applied based on display mode
    if (settings.outlineDisplayMode === 'filtered') {
      // Only apply outline if event matches the color filter
      if (!eventMatchesFilter(eventElement, settings)) {
        // Remove outline if event doesn't match filter
        eventElement.style.setProperty('box-shadow', '', 'important');
        eventElement.style.setProperty('border', '', 'important');
        eventElement.style.setProperty('outline', '', 'important');
        eventElement.style.setProperty('outline-offset', '', 'important');
        return;
      }
    }

    const thickness = settings.outlineThickness || 1;
    const color = settings.outlineColor || '#ffffff';

    // Apply outline using multiple methods for better compatibility
    eventElement.style.setProperty('box-shadow', `0 0 0 ${thickness}px ${color}`, 'important');
    eventElement.style.setProperty('border', `${thickness}px solid ${color}`, 'important');
    eventElement.style.setProperty('outline', `${thickness}px solid ${color}`, 'important');
    eventElement.style.setProperty('outline-offset', `-${thickness}px`, 'important');
  }

  // Apply text color to event
  function applyTextColor(eventElement, settings) {
    if (!eventElement) return;

    const textColor = (settings.textWhite !== false) ? '#ffffff' : null;

    if (textColor) {
      // Apply white color to text elements
      const textSelectors = [
        '.I0UMhf', // Event title
        '.KcY3wb', // Title container
        '[role="heading"]', // Headings
        '.lhydbb', // Time text
        '.Jcb6qd', // Event content
        '.fFwDnf', // Event details
        'span', // All spans
        'div' // All divs with text
      ];

      textSelectors.forEach(selector => {
        const elements = eventElement.querySelectorAll(selector);
        elements.forEach(el => {
          // Only apply if element has text content
          if (el.textContent && el.textContent.trim().length > 0) {
            el.style.setProperty('color', textColor, 'important');
          }
        });
      });

      // Also apply to the event element itself if it has text
      if (eventElement.textContent && eventElement.textContent.trim().length > 0) {
        eventElement.style.setProperty('color', textColor, 'important');
      }
    } else {
      // Remove white color (let it inherit default)
      eventElement.style.setProperty('color', '', 'important');
      const textElements = eventElement.querySelectorAll('*');
      textElements.forEach(el => {
        if (el.style.color === 'rgb(255, 255, 255)' || el.style.color === '#ffffff') {
          el.style.setProperty('color', '', 'important');
        }
      });
    }
  }

  // Use MutationObserver to handle dynamically loaded events
  let observer;
  
  function startObserving() {
    if (observer) {
      observer.disconnect();
    }

    observer = new MutationObserver((mutations) => {
      let shouldProcess = false;
      let hasEventNodes = false;
      let needsColorReapply = false;
      
      mutations.forEach((mutation) => {
        // Check if style attribute changed on an element with data-tpi-color
        if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
          const target = mutation.target;
          if (target && target.hasAttribute && target.hasAttribute('data-tpi-color')) {
            // Check if the background-color was reset
            const currentBg = window.getComputedStyle(target).backgroundColor;
            const storedColor = target.getAttribute('data-tpi-color');
            const storedColorRgb = hexToRgb(storedColor);
            
            // If the background color doesn't match our stored color, re-apply it
            if (storedColorRgb && currentBg !== `rgb(${storedColorRgb.r}, ${storedColorRgb.g}, ${storedColorRgb.b})` && 
                currentBg !== storedColor && !currentBg.includes(storedColorRgb.r)) {
              needsColorReapply = true;
              // Re-apply color immediately
              const color = target.getAttribute('data-tpi-color');
              if (color) {
                applyColorToEvent(target, color);
              }
            }
          }
        }
        
              // Check if popup opened or closed
        if (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0) {
          // Check if popup was removed
          for (let node of mutation.removedNodes) {
            if (node.nodeType === 1 && node.classList && node.classList.contains('hMdQi')) {
              // Popup closed - stop element picker if active
              if (elementPickerActive) {
                stopElementPicking();
              }
              // Disconnect modification observer if it exists
              if (node._tpiModificationObserver) {
                node._tpiModificationObserver.disconnect();
                delete node._tpiModificationObserver;
              }
              // Disconnect removal observer if it exists
              if (node._tpiRemovalObserver) {
                node._tpiRemovalObserver.disconnect();
                delete node._tpiRemovalObserver;
              }
              // Disconnect .xnWuge removal observer if it exists
              if (node._tpiXnWugeRemovalObserver) {
                node._tpiXnWugeRemovalObserver.disconnect();
                delete node._tpiXnWugeRemovalObserver;
              }
              // Clear interval if it exists
              if (node._tpiXnWugeInterval) {
                clearInterval(node._tpiXnWugeInterval);
                delete node._tpiXnWugeInterval;
              }
              // Clear removal selectors
              delete node._tpiRemoveSelectors;
              // Clear active popup reference
              if (activePopup === node) {
                activePopup = null;
              }
            }
          }
          
          for (let node of mutation.addedNodes) {
            if (node.nodeType === 1) { // Element node
               // Check if popup opened
               if (node.classList && node.classList.contains('hMdQi')) {
                 // Popup opened - re-apply colors to all processed events
                 setTimeout(async () => {
                   reapplyColorsToProcessedEvents();
                   
                   const popup = node;

                   // Load settings once for all popup modifications
                   const currentSettings = await loadSettings();
                   
                   // Inject icon into popup title
                   injectIconIntoPopupTitle(popup, currentSettings);

                   // Style .xnWuge element with umbrella SVG
                   styleXnWugeElement(popup);

                   
                   // Remove specific element
                   removeSpecificElement(popup);
                   
                   // Set up persistent styling for .xnWuge and removal for specific element
                   if (!popup._tpiXnWugeRemovalObserver) {
                     // Style immediately on every mutation
                     popup._tpiXnWugeRemovalObserver = new MutationObserver(() => {
                         // Style .xnWuge elements immediately
                         styleXnWugeElement(popup);
                         
                         // Remove specific element
                         removeSpecificElement(popup);
                     });
                     
                     popup._tpiXnWugeRemovalObserver.observe(popup, {
                       childList: true,
                       subtree: true,
                       attributes: true
                     });
                     
                     // Also style immediately every 100ms as backup
                     const intervalId = setInterval(async () => {
                       if (!popup.parentNode) {
                         clearInterval(intervalId);
                         return;
                       }
                       const freshSettings = await loadSettings();
                       injectIconIntoPopupTitle(popup, freshSettings);
                       styleXnWugeElement(popup);
                       removeSpecificElement(popup);
                     }, 100);
                     
                     popup._tpiXnWugeInterval = intervalId;
                   }
                   
                   // Apply element modifications
                   applyElementModifications(popup, currentSettings);
                   
                   // Set up observer to re-apply modifications if popup content changes
                   const modificationObserver = new MutationObserver(async () => {
                     // Load fresh settings in case user changed actions
                     const freshSettings = await loadSettings();
                     injectIconIntoPopupTitle(popup, freshSettings);
                     applyElementModifications(popup, freshSettings);
                   });
                   
                   modificationObserver.observe(popup, {
                     childList: true,
                     subtree: true,
                     attributes: true
                   });
                   
                   // Store observer to disconnect when popup closes
                   popup._tpiModificationObserver = modificationObserver;
                   
                   // Store active popup reference
                   activePopup = popup;
                   
                   // Remove umbrella icons from popup (but keep title icon)
                   // Remove all possible icon variations except the title icon
                   const existingIcons = popup.querySelectorAll('.tpi-popup-umbrella-icon, .tpi-umbrella-icon:not(.tpi-popup-title-icon)');
                   existingIcons.forEach(icon => {
                     // Don't remove the title icon
                     if (!icon.classList.contains('tpi-popup-title-icon')) {
                       icon.remove();
                     }
                   });
                   
                   // Also check for any SVG elements that might be umbrella icons
                   const allSvgs = popup.querySelectorAll('svg');
                   allSvgs.forEach(svg => {
                     const parent = svg.parentElement;
                     if (parent && (parent.classList.contains('tpi-popup-umbrella-icon') || 
                         parent.classList.contains('tpi-umbrella-icon') ||
                         parent.classList.contains('tpi-far-right-icon') ||
                         parent.classList.contains('tpi-far-left-icon'))) {
                       parent.remove();
                     }
                   });
                   
                   // Hide specific popup content: description, notes, and attendees
                   function hidePopupContent() {
                     // Hide description: "Transparent Insurance health consultation."
                     // Target span with jscontroller="BlntMb" containing the text
                     const descriptionSpans = popup.querySelectorAll('span[jscontroller="BlntMb"]');
                     descriptionSpans.forEach(span => {
                       if (span.textContent && span.textContent.includes('Transparent Insurance health consultation')) {
                         span.style.display = 'none';
                         span.style.visibility = 'hidden';
                       }
                     });
                     
                     // Hide notes section: "Notes - Transparent Insurance — Robert Parkfield"
                     // Target div with id="xDetDlgAtm" or span with class "PdReTd rEYZee"
                     const notesDiv = popup.querySelector('#xDetDlgAtm');
                     if (notesDiv) {
                       notesDiv.style.display = 'none';
                       notesDiv.style.visibility = 'hidden';
                     }
                     
                     const notesSpans = popup.querySelectorAll('span.PdReTd.rEYZee');
                     notesSpans.forEach(span => {
                       if (span.textContent && span.textContent.includes('Notes - Transparent Insurance')) {
                         // Hide the parent container (the entire notes section)
                         let parent = span.closest('.toUqff');
                         if (parent) {
                           parent.style.display = 'none';
                           parent.style.visibility = 'hidden';
                         } else {
                           span.style.display = 'none';
                           span.style.visibility = 'hidden';
                         }
                       }
                     });
                     
                     // Hide attendee: "Link Pellow" but NOT the organizer section
                     // The organizer section has id="xDetDlgCal" and contains "Organizer: Link Pellow"
                     // Only hide attendee sections, not organizer sections
                     const attendeeDivs = popup.querySelectorAll('div.Fh4HL');
                     attendeeDivs.forEach(div => {
                       if (div.textContent && div.textContent.trim() === 'Link Pellow') {
                         // Check if this is in an organizer section - if so, don't hide it
                         const organizerContainer = div.closest('#xDetDlgCal');
                         const hasOrganizerText = div.closest('.nBzcnc.OcVpRe')?.textContent?.includes('Organizer');
                         
                         // Only hide if it's NOT in the organizer section
                         if (!organizerContainer && !hasOrganizerText) {
                           div.style.display = 'none';
                           div.style.visibility = 'hidden';
                         }
                       }
                     });
                     
                     // Hide attendee containers but preserve organizer container
                     const allContainers = popup.querySelectorAll('div.nBzcnc.OcVpRe');
                     allContainers.forEach(container => {
                       const containerText = container.textContent || '';
                       const isOrganizer = container.querySelector('#xDetDlgCal') || 
                                          containerText.includes('Organizer:') ||
                                          container.id === 'xDetDlgCal';
                       
                       // Only hide if it contains "Link Pellow" but is NOT the organizer section
                       if (containerText.includes('Link Pellow') && !isOrganizer) {
                         container.style.setProperty('display', 'none', 'important');
                         container.style.setProperty('visibility', 'hidden', 'important');
                       }
                     });
                     
                     // Hide specific icon elements: notes, drive, and event icons
                     // Target icons directly by their classes and text content
                     
                     // Hide notes icon (giSqbe class)
                     const notesIcons = popup.querySelectorAll('i.google-material-icons.giSqbe, i.google-material-icons.giSqbe.MpJKQd');
                     notesIcons.forEach(icon => {
                       if (icon.textContent && icon.textContent.trim() === 'notes') {
                         const container = icon.closest('div.zZj8Pb.EaVNbc');
                         if (container) {
                           container.style.setProperty('display', 'none', 'important');
                           container.style.setProperty('visibility', 'hidden', 'important');
                           container.style.setProperty('opacity', '0', 'important');
                         }
                         icon.style.setProperty('display', 'none', 'important');
                         icon.style.setProperty('visibility', 'hidden', 'important');
                       }
                     });
                     
                     // Hide drive icon (imyxFc class)
                     const driveIcons = popup.querySelectorAll('i.google-material-icons.imyxFc');
                     driveIcons.forEach(icon => {
                       if (icon.textContent && icon.textContent.trim() === 'drive') {
                         const container = icon.closest('div.zZj8Pb.EaVNbc');
                         if (container) {
                           container.style.setProperty('display', 'none', 'important');
                           container.style.setProperty('visibility', 'hidden', 'important');
                           container.style.setProperty('opacity', '0', 'important');
                         }
                         icon.style.setProperty('display', 'none', 'important');
                         icon.style.setProperty('visibility', 'hidden', 'important');
                       }
                     });
                     
                     // Hide event icon (MpJKQd without giSqbe or imyxFc)
                     const eventIcons = popup.querySelectorAll('i.google-material-icons.MpJKQd:not(.giSqbe):not(.imyxFc)');
                     eventIcons.forEach(icon => {
                       if (icon.textContent && icon.textContent.trim() === 'event') {
                         const container = icon.closest('div.zZj8Pb.EaVNbc');
                         if (container) {
                           container.style.setProperty('display', 'none', 'important');
                           container.style.setProperty('visibility', 'hidden', 'important');
                           container.style.setProperty('opacity', '0', 'important');
                         }
                         icon.style.setProperty('display', 'none', 'important');
                         icon.style.setProperty('visibility', 'hidden', 'important');
                       }
                     });
                     
                     // Also check all icon containers by text content as fallback
                     const allIconContainers = popup.querySelectorAll('div.zZj8Pb.EaVNbc');
                     allIconContainers.forEach(container => {
                       const icon = container.querySelector('i.google-material-icons');
                       if (icon) {
                         const iconText = icon.textContent || icon.innerText || '';
                         const trimmedText = iconText.trim();
                         if (trimmedText === 'notes' || trimmedText === 'drive' || trimmedText === 'event') {
                           container.style.setProperty('display', 'none', 'important');
                           container.style.setProperty('visibility', 'hidden', 'important');
                           container.style.setProperty('opacity', '0', 'important');
                         }
                       }
                     });
                     
                     // Move reminder section ("30 minutes before") up
                     function moveReminderUp() {
                       // Find all elements containing "30 minutes before"
                       const allElements = popup.querySelectorAll('div, span, p');
                       allElements.forEach(el => {
                         const text = el.textContent || '';
                         if (text.trim() === '30 minutes before' || 
                             (text.includes('30 minutes before') && 
                              !text.includes('Link Pellow') &&
                              !text.includes('Notes -'))) {
                           // Find the parent container that holds the reminder and bell icon
                           let reminderContainer = el;
                           let foundContainer = false;
                           
                           // Go up to find a suitable container
                           for (let i = 0; i < 5 && reminderContainer && reminderContainer !== popup; i++) {
                             const parent = reminderContainer.parentElement;
                             if (parent) {
                               // Check if this parent contains the bell icon
                               const hasBellIcon = parent.querySelector('i.google-material-icons[aria-hidden="true"]');
                               const containerText = parent.textContent || '';
                               
                               // If this container has the bell icon and reminder text, move it up
                               if (hasBellIcon && containerText.includes('30 minutes before') &&
                                   !containerText.includes('Link Pellow') &&
                                   !containerText.includes('Notes -')) {
                                 parent.style.setProperty('margin-top', '-60px', 'important');
                                 parent.style.setProperty('position', 'relative', 'important');
                                 foundContainer = true;
                                 break;
                               }
                               reminderContainer = parent;
                             } else {
                               break;
                             }
                           }
                           
                           // If we didn't find a container with bell icon, just move the element itself
                           if (!foundContainer) {
                             el.style.setProperty('margin-top', '-60px', 'important');
                             el.style.setProperty('position', 'relative', 'important');
                           }
                         }
                       });
                     }
                     
                     moveReminderUp();
                     
                     // Break event title so "— Robert Parkfield" appears on new line
                     function breakEventTitle() {
                       // Find the event title element
                       const titleElements = popup.querySelectorAll('.UfeRlc, .UfeRlc span[role="heading"], #rAECCd');
                       titleElements.forEach(titleEl => {
                         const text = titleEl.textContent || titleEl.innerText || '';
                         if (text.includes('Transparent Insurance — Robert Parkfield')) {
                           // Replace " — " with a line break before the dash
                           const newText = text.replace(' — ', '\n— ');
                           titleEl.textContent = newText;
                           titleEl.style.setProperty('white-space', 'pre-line', 'important');
                           titleEl.style.setProperty('word-break', 'break-word', 'important');
                         }
                       });
                       
                       // Also check all text nodes within title containers
                       const titleContainers = popup.querySelectorAll('.UfeRlc, #rAECCd');
                       titleContainers.forEach(container => {
                         const walker = document.createTreeWalker(
                           container,
                           NodeFilter.SHOW_TEXT,
                           null,
                           false
                         );
                         
                         let node;
                         while (node = walker.nextNode()) {
                           if (node.textContent && node.textContent.includes('Transparent Insurance — Robert Parkfield')) {
                             const newText = node.textContent.replace(' — ', '\n— ');
                             node.textContent = newText;
                             // Set parent to use pre-line
                             if (node.parentElement) {
                               node.parentElement.style.setProperty('white-space', 'pre-line', 'important');
                               node.parentElement.style.setProperty('word-break', 'break-word', 'important');
                             }
                           }
                         }
                       });
                     }
                     
                     breakEventTitle();
                     
                     // Remove padding between event title and date/time
                     function removeTitlePadding() {
                       // Find the date/time element and remove its top margin/padding
                       const dateElements = popup.querySelectorAll('.AzuXid');
                       dateElements.forEach(dateEl => {
                         dateEl.style.setProperty('margin-top', '0', 'important');
                         dateEl.style.setProperty('padding-top', '0', 'important');
                       });
                       
                       // Find the title element and remove its bottom margin/padding
                       const titleElements = popup.querySelectorAll('.UfeRlc, #rAECCd');
                       titleElements.forEach(titleEl => {
                         titleEl.style.setProperty('margin-bottom', '0', 'important');
                         titleEl.style.setProperty('padding-bottom', '0', 'important');
                       });
                       
                       // Also check parent containers
                       const titleContainers = popup.querySelectorAll('.UfeRlc, #rAECCd');
                       titleContainers.forEach(container => {
                         const nextSibling = container.nextElementSibling;
                         if (nextSibling && nextSibling.classList.contains('AzuXid')) {
                           nextSibling.style.setProperty('margin-top', '0', 'important');
                           nextSibling.style.setProperty('padding-top', '0', 'important');
                         }
                       });
                     }
                     
                     removeTitlePadding();
                   }
                   
                   // Hide content immediately
                   hidePopupContent();
                   
                   // Use MutationObserver to continuously remove icons and hide content
                   const iconObserver = new MutationObserver(() => {
                     const newIcons = popup.querySelectorAll('.tpi-popup-umbrella-icon, .tpi-umbrella-icon, .tpi-far-right-icon, .tpi-far-left-icon');
                     newIcons.forEach(icon => icon.remove());
                     // Re-hide content in case it gets re-added
                     hidePopupContent();
                   });
                   
                   iconObserver.observe(popup, {
                     childList: true,
                     subtree: true
                   });
                   
                   // Store observer to disconnect when popup closes
                   popup._tpiIconObserver = iconObserver;
                   
                   // Also specifically find and re-apply color to the event that opened the popup
                  const eventId = node.querySelector('[data-eventid]')?.getAttribute('data-eventid');
                  if (eventId) {
                    const eventElement = document.querySelector(`[data-eventid="${eventId}"]`);
                    if (eventElement && eventElement.hasAttribute('data-tpi-color')) {
                      const color = eventElement.getAttribute('data-tpi-color');
                      applyColorToEvent(eventElement, color);
                    }
                  }
                }, 50);
              }
              
              // Check if any added nodes are likely calendar events
              if (node.hasAttribute && (node.hasAttribute('data-eventid') || 
                  node.querySelector && node.querySelector('[data-eventid]') ||
                  node.classList && (node.classList.contains('QZVPzb') || 
                  node.classList.contains('GTG3wb')))) {
                hasEventNodes = true;
                break;
              }
            }
          }
          if (hasEventNodes || mutation.addedNodes.length > 0) {
            shouldProcess = true;
          }
        }
      });
      
      if (shouldProcess) {
        // Process immediately if we detect event nodes, otherwise debounce
        if (hasEventNodes) {
          // Process immediately for event nodes
          processCalendarEvents();
          // Also set a debounce for any additional changes
          clearTimeout(window.tpiProcessTimeout);
          window.tpiProcessTimeout = setTimeout(() => {
            processCalendarEvents();
          }, 100);
        } else {
          // Debounce for other DOM changes
          clearTimeout(window.tpiProcessTimeout);
          window.tpiProcessTimeout = setTimeout(() => {
            processCalendarEvents();
          }, 200);
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class']
    });
  }

  // Re-apply colors to all events that have been colored (in case they were reset)
  function reapplyColorsToProcessedEvents() {
    const processedEvents = document.querySelectorAll('[data-tpi-color]');
    processedEvents.forEach(event => {
      const storedColor = event.getAttribute('data-tpi-color');
      if (storedColor) {
        const currentBg = window.getComputedStyle(event).backgroundColor;
        const storedColorRgb = hexToRgb(storedColor);
        
        if (storedColorRgb) {
          const expectedRgb = `rgb(${storedColorRgb.r}, ${storedColorRgb.g}, ${storedColorRgb.b})`;
          // If color doesn't match, re-apply it
          if (currentBg !== expectedRgb && currentBg !== storedColor) {
            applyColorToEvent(event, storedColor);
          }
        }
      }
    });
  }

  // Initialize when page loads
  function init() {
    console.log('[TPI Content] ========================================');
    console.log('[TPI Content] TPI Content Script Initializing...');
    console.log('[TPI Content] Document URL:', window.location.href);
    console.log('[TPI Content] Document ready state:', document.readyState);
    console.log('[TPI Content] Chrome runtime available?', typeof chrome !== 'undefined');
    console.log('[TPI Content] Chrome runtime ID:', chrome.runtime ? chrome.runtime.id : 'N/A');
    console.log('[TPI Content] ========================================');
    
    // Start observing immediately
    console.log('[TPI Content] Starting mutation observer...');
    startObserving();
    console.log('[TPI Content] Mutation observer started');
    
    // Process events immediately and repeatedly to catch lazy-loaded content
    const processImmediately = () => {
      processCalendarEvents();
    };
    
    // Process immediately
    processImmediately();
    
    // Also process after a short delay to catch initial load
    setTimeout(processImmediately, 100);
    setTimeout(processImmediately, 500);
    setTimeout(processImmediately, 1000);
    
    // Wait for calendar to fully load
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(processImmediately, 100);
        setTimeout(processImmediately, 500);
      });
    }
    
    // Process on any scroll (calendar lazy-loads on scroll)
    let scrollTimeout;
    window.addEventListener('scroll', () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(processImmediately, 50);
    }, { passive: true });
    
    // Process on resize (calendar may reorganize)
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(processImmediately, 100);
    }, { passive: true });
    
    // Periodic check to catch any lazy-loaded events and re-apply colors (every 500ms)
    const periodicCheck = setInterval(() => {
      processCalendarEvents();
      // Also re-apply colors to processed events in case they were reset
      reapplyColorsToProcessedEvents();
    }, 500);
    
    // Clean up interval when page unloads
    window.addEventListener('beforeunload', () => {
      clearInterval(periodicCheck);
    });

    // Listen for settings changes
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'sync' && changes.tpiSettings) {
        console.log('[TPI Content] Settings changed, checking for element modifications...');
        
        // Check if element modifications changed
        const newSettings = changes.tpiSettings.newValue;
        const oldSettings = changes.tpiSettings.oldValue;
        
        const elementsChanged = !oldSettings || 
          JSON.stringify(newSettings?.selectedElements) !== JSON.stringify(oldSettings?.selectedElements);
        
        if (elementsChanged && newSettings?.selectedElements) {
          console.log('[TPI Content] Element modifications changed, re-applying to open popup...');
          const popup = document.querySelector('.hMdQi');
          if (popup) {
            console.log('[TPI Content] Popup is open, applying modifications immediately...');
            applyElementModifications(popup, newSettings);
          } else {
            console.log('[TPI Content] No popup open, will apply when popup opens');
          }
        }
        
        // Reset processed flags and remove all icons
        document.querySelectorAll('[data-tpi-processed]').forEach(el => {
          el.removeAttribute('data-tpi-processed');
        });
        // Remove all existing icons so they can be re-evaluated
        document.querySelectorAll('.tpi-umbrella-icon').forEach(icon => {
          icon.remove();
        });
        processCalendarEvents();
      }
    });
  }

  // Element Picker Functionality
  
  let elementPickerActive = false;
  let hoveredElement = null;
  let hoverHighlight = null;
  
  // Generate a unique CSS selector for an element
  function generateSelector(element) {
    if (!element || element === document.body) {
      return 'body';
    }
    
    // Check if we're inside the popup
    const popup = element.closest('.hMdQi');
    if (!popup) {
      // Not in popup - return a generic selector
      return 'body';
    }
    
    // Try ID first (most specific)
    if (element.id) {
      const idSelector = `#${CSS.escape(element.id)}`;
      try {
        const matches = popup.querySelectorAll(idSelector);
        if (matches.length === 1 && matches[0] === element) {
          return `.hMdQi ${idSelector}`;
        }
      } catch (e) {
        // Invalid selector, continue
      }
    }
    
    // Try class combination
    if (element.className && typeof element.className === 'string') {
      const classes = element.className.trim().split(/\s+/).filter(c => c.length > 0 && !c.includes(':'));
      if (classes.length > 0) {
        // Try with all classes first
        const allClassesSelector = '.' + classes.map(c => CSS.escape(c)).join('.');
        try {
          const matches = popup.querySelectorAll(allClassesSelector);
          if (matches.length === 1 && matches[0] === element) {
            return `.hMdQi ${allClassesSelector}`;
          }
        } catch (e) {
          // Invalid selector, continue
        }
        
        // Try with fewer classes if too many matches
        if (classes.length > 1) {
          const fewClassesSelector = '.' + classes.slice(0, 2).map(c => CSS.escape(c)).join('.');
          try {
            const matches = popup.querySelectorAll(fewClassesSelector);
            if (matches.length === 1 && matches[0] === element) {
              return `.hMdQi ${fewClassesSelector}`;
            }
          } catch (e) {
            // Invalid selector, continue
          }
        }
      }
    }
    
    // Build path using tag name and nth-child
    const path = [];
    let current = element;
    let depth = 0;
    const maxDepth = 15;
    
    while (current && current !== popup && current !== document.body && current !== document.documentElement && depth < maxDepth) {
      let selector = current.tagName.toLowerCase();
      
      // Add ID if available
      if (current.id) {
        selector += `#${CSS.escape(current.id)}`;
        path.unshift(selector);
        break;
      }
      
      // Add classes if available (limit to 2 most distinctive classes)
      if (current.className && typeof current.className === 'string') {
        const classes = current.className.trim().split(/\s+/).filter(c => c.length > 0 && !c.includes(':'));
        if (classes.length > 0) {
          // Use first 2 classes that don't look like dynamic/hashed classes
          const stableClasses = classes.filter(c => c.length > 2 && !/^[a-z0-9]{6,}$/i.test(c)).slice(0, 2);
          if (stableClasses.length > 0) {
            selector += '.' + stableClasses.map(c => CSS.escape(c)).join('.');
          }
        }
      }
      
      // Add nth-child for specificity
      const parent = current.parentElement;
      if (parent && parent !== popup) {
        const siblings = Array.from(parent.children).filter(s => s.tagName === current.tagName);
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          selector += `:nth-of-type(${index})`;
        }
      }
      
      path.unshift(selector);
      current = parent;
      depth++;
    }
    
    if (path.length === 0) {
      // Fallback: use tag name
      return `.hMdQi ${element.tagName.toLowerCase()}`;
    }
    
    return `.hMdQi ${path.join(' > ')}`;
  }
  
  // Create hover highlight overlay
  function createHoverHighlight() {
    console.log('[TPI Content] createHoverHighlight() called');
    console.log('[TPI Content] Current hoverHighlight:', hoverHighlight);
    
    if (hoverHighlight) {
      console.log('[TPI Content] Hover highlight already exists, returning existing');
      return hoverHighlight;
    }
    
    console.log('[TPI Content] Creating new hover highlight element...');
    try {
      hoverHighlight = document.createElement('div');
      console.log('[TPI Content] Div element created');
      
      hoverHighlight.id = 'tpi-element-picker-highlight';
      console.log('[TPI Content] ID set to:', hoverHighlight.id);
      
      hoverHighlight.style.cssText = `
        position: absolute;
        border: 2px solid #00bcd4;
        background-color: rgba(0, 188, 212, 0.1);
        pointer-events: none;
        z-index: 999999;
        box-sizing: border-box;
        transition: all 0.1s ease;
      `;
      console.log('[TPI Content] Styles applied');
      
      console.log('[TPI Content] Appending to document.body...');
      console.log('[TPI Content] document.body exists?', document.body !== null);
      document.body.appendChild(hoverHighlight);
      console.log('[TPI Content] Hover highlight appended to body');
      console.log('[TPI Content] Hover highlight parent:', hoverHighlight.parentNode);
      
      return hoverHighlight;
    } catch (error) {
      console.error('[TPI Content] ERROR in createHoverHighlight():', error);
      console.error('[TPI Content] Error type:', error.constructor.name);
      console.error('[TPI Content] Error message:', error.message);
      console.error('[TPI Content] Error stack:', error.stack);
      hoverHighlight = null;
      throw error;
    }
  }
  
  // Update hover highlight position
  function updateHoverHighlight(element) {
    if (!element || !hoverHighlight) return;
    
    const rect = element.getBoundingClientRect();
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;
    
    hoverHighlight.style.left = (rect.left + scrollX) + 'px';
    hoverHighlight.style.top = (rect.top + scrollY) + 'px';
    hoverHighlight.style.width = rect.width + 'px';
    hoverHighlight.style.height = rect.height + 'px';
    hoverHighlight.style.display = 'block';
  }
  
  // Remove hover highlight
  function removeHoverHighlight() {
    if (hoverHighlight) {
      hoverHighlight.style.display = 'none';
    }
    hoveredElement = null;
  }
  
  // Handle mouse move for element picking
  function handleElementPickerMouseMove(e) {
    if (!elementPickerActive) return;
    
    // Only allow picking within the popup
    const popup = document.querySelector('.hMdQi');
    if (!popup) {
      removeHoverHighlight();
      return;
    }
    
    // Check if we're hovering over an element inside the popup
    const target = e.target;
    if (!target || !popup.contains(target) || target === popup) {
      removeHoverHighlight();
      return;
    }
    
    // Skip our own highlight element
    if (target.id === 'tpi-element-picker-highlight') {
      return;
    }
    
    hoveredElement = target;
    updateHoverHighlight(target);
  }
  
  // Capture and log HTML structure of element and surrounding area
  function captureElementStructure(element) {
    const structure = {
      element: {
        tagName: element.tagName,
        id: element.id || null,
        className: element.className || null,
        classes: element.className ? element.className.split(/\s+/).filter(c => c) : [],
        textContent: element.textContent ? element.textContent.substring(0, 200) : null,
        innerHTML: element.innerHTML ? element.innerHTML.substring(0, 500) : null,
        outerHTML: element.outerHTML ? element.outerHTML.substring(0, 1000) : null,
        attributes: {},
        computedStyles: {}
      },
      parent: null,
      siblings: {
        previous: [],
        next: []
      },
      children: [],
      context: {
        selector: null,
        xpath: null,
        breadcrumb: []
      }
    };
    
    // Capture all attributes
    if (element.attributes) {
      Array.from(element.attributes).forEach(attr => {
        structure.element.attributes[attr.name] = attr.value;
      });
    }
    
    // Capture important computed styles
    const computed = window.getComputedStyle(element);
    structure.element.computedStyles = {
      display: computed.display,
      visibility: computed.visibility,
      position: computed.position,
      width: computed.width,
      height: computed.height,
      margin: computed.margin,
      padding: computed.padding,
      backgroundColor: computed.backgroundColor,
      color: computed.color,
      fontSize: computed.fontSize,
      fontWeight: computed.fontWeight
    };
    
    // Capture parent structure
    if (element.parentElement) {
      const parent = element.parentElement;
      structure.parent = {
        tagName: parent.tagName,
        id: parent.id || null,
        className: parent.className || null,
        classes: parent.className ? parent.className.split(/\s+/).filter(c => c) : [],
        outerHTML: parent.outerHTML ? parent.outerHTML.substring(0, 500) : null
      };
    }
    
    // Capture siblings
    if (element.parentElement) {
      const siblings = Array.from(element.parentElement.children);
      const index = siblings.indexOf(element);
      
      // Previous siblings (up to 2)
      structure.siblings.previous = siblings.slice(Math.max(0, index - 2), index).map(sib => ({
        tagName: sib.tagName,
        id: sib.id || null,
        className: sib.className || null,
        textContent: sib.textContent ? sib.textContent.substring(0, 100) : null
      }));
      
      // Next siblings (up to 2)
      structure.siblings.next = siblings.slice(index + 1, index + 3).map(sib => ({
        tagName: sib.tagName,
        id: sib.id || null,
        className: sib.className || null,
        textContent: sib.textContent ? sib.textContent.substring(0, 100) : null
      }));
    }
    
    // Capture direct children (up to 5)
    structure.children = Array.from(element.children).slice(0, 5).map(child => ({
      tagName: child.tagName,
      id: child.id || null,
      className: child.className || null,
      textContent: child.textContent ? child.textContent.substring(0, 100) : null,
      outerHTML: child.outerHTML ? child.outerHTML.substring(0, 300) : null
    }));
    
    // Generate breadcrumb path
    let current = element;
    while (current && current !== document.body && current !== document.documentElement) {
      const breadcrumbItem = {
        tagName: current.tagName.toLowerCase(),
        id: current.id || null,
        className: current.className ? current.className.split(/\s+/)[0] : null
      };
      structure.context.breadcrumb.unshift(breadcrumbItem);
      current = current.parentElement;
      if (structure.context.breadcrumb.length > 10) break; // Limit depth
    }
    
    // Generate XPath
    try {
      structure.context.xpath = getXPath(element);
    } catch (e) {
      structure.context.xpath = 'Unable to generate XPath';
    }
    
    return structure;
  }
  
  // Generate XPath for an element
  function getXPath(element) {
    if (element.id) {
      return `//*[@id="${element.id}"]`;
    }
    if (element === document.body) {
      return '/html/body';
    }
    if (element === document.documentElement) {
      return '/html';
    }
    
    let ix = 0;
    const siblings = element.parentNode ? element.parentNode.childNodes : [];
    for (let i = 0; i < siblings.length; i++) {
      const sibling = siblings[i];
      if (sibling === element) {
        const path = getXPath(element.parentNode);
        return path + '/' + element.tagName.toLowerCase() + '[' + (ix + 1) + ']';
      }
      if (sibling.nodeType === 1 && sibling.tagName === element.tagName) {
        ix++;
      }
    }
    return '';
  }
  
  // Handle click for element picking
  function handleElementPickerClick(e) {
    if (!elementPickerActive || !hoveredElement) return;
    
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    
    // Only allow picking within the popup
    const popup = document.querySelector('.hMdQi');
    if (!popup || !popup.contains(hoveredElement)) {
      return;
    }
    
    // Capture complete HTML structure
    console.log('========================================');
    console.log('[TPI LEAD DEV] ELEMENT SELECTED - HTML STRUCTURE ANALYSIS');
    console.log('========================================');
    
    const structure = captureElementStructure(hoveredElement);
    structure.context.selector = generateSelector(hoveredElement);
    
    // Log complete structure
    console.log('\n[TPI LEAD DEV] ===== SELECTED ELEMENT =====');
    console.log('Tag:', structure.element.tagName);
    console.log('ID:', structure.element.id || '(none)');
    console.log('Classes:', structure.element.classes.length > 0 ? structure.element.classes.join(', ') : '(none)');
    console.log('Full Class String:', structure.element.className || '(none)');
    console.log('\n[TPI LEAD DEV] ===== ATTRIBUTES =====');
    console.log(JSON.stringify(structure.element.attributes, null, 2));
    console.log('\n[TPI LEAD DEV] ===== COMPUTED STYLES =====');
    console.log(JSON.stringify(structure.element.computedStyles, null, 2));
    console.log('\n[TPI LEAD DEV] ===== TEXT CONTENT =====');
    console.log(structure.element.textContent || '(empty)');
    console.log('\n[TPI LEAD DEV] ===== INNER HTML (first 500 chars) =====');
    console.log(structure.element.innerHTML || '(empty)');
    console.log('\n[TPI LEAD DEV] ===== OUTER HTML (first 1000 chars) =====');
    console.log(structure.element.outerHTML || '(empty)');
    console.log('\n[TPI LEAD DEV] ===== PARENT ELEMENT =====');
    if (structure.parent) {
      console.log('Tag:', structure.parent.tagName);
      console.log('ID:', structure.parent.id || '(none)');
      console.log('Classes:', structure.parent.classes.length > 0 ? structure.parent.classes.join(', ') : '(none)');
      console.log('Outer HTML (first 500 chars):', structure.parent.outerHTML || '(empty)');
    } else {
      console.log('(no parent)');
    }
    console.log('\n[TPI LEAD DEV] ===== SIBLING ELEMENTS =====');
    console.log('Previous siblings:', structure.siblings.previous.length);
    structure.siblings.previous.forEach((sib, i) => {
      console.log(`  [${i + 1}] ${sib.tagName}${sib.id ? '#' + sib.id : ''}${sib.className ? '.' + sib.className.split(/\s+/)[0] : ''} - ${sib.textContent ? sib.textContent.substring(0, 50) : '(empty)'}`);
    });
    console.log('Next siblings:', structure.siblings.next.length);
    structure.siblings.next.forEach((sib, i) => {
      console.log(`  [${i + 1}] ${sib.tagName}${sib.id ? '#' + sib.id : ''}${sib.className ? '.' + sib.className.split(/\s+/)[0] : ''} - ${sib.textContent ? sib.textContent.substring(0, 50) : '(empty)'}`);
    });
    console.log('\n[TPI LEAD DEV] ===== CHILD ELEMENTS (first 5) =====');
    structure.children.forEach((child, i) => {
      console.log(`[${i + 1}] ${child.tagName}${child.id ? '#' + child.id : ''}${child.className ? '.' + child.className.split(/\s+/)[0] : ''}`);
      console.log(`    Text: ${child.textContent ? child.textContent.substring(0, 100) : '(empty)'}`);
      console.log(`    HTML: ${child.outerHTML ? child.outerHTML.substring(0, 200) : '(empty)'}`);
    });
    console.log('\n[TPI LEAD DEV] ===== SELECTOR & PATH =====');
    console.log('Generated Selector:', structure.context.selector);
    console.log('XPath:', structure.context.xpath);
    console.log('Breadcrumb:', structure.context.breadcrumb.map(b => 
      b.tagName + (b.id ? '#' + b.id : '') + (b.className ? '.' + b.className : '')
    ).join(' > '));
    console.log('\n[TPI LEAD DEV] ===== COMPLETE STRUCTURE JSON =====');
    console.log(JSON.stringify(structure, null, 2));
    console.log('========================================\n');
    
    // Generate selector
    const selector = generateSelector(hoveredElement);
    
    // Store selected element in storage so popup can pick it up
    try {
      const newElement = {
        selector: selector,
        action: 'hide', // Default action
        text: ''
      };
      
      // Store temporarily in storage to notify popup
      chrome.storage.sync.set({ tpiElementSelection: newElement }, () => {
        // Clear it after a short delay
        setTimeout(() => {
          chrome.storage.sync.remove('tpiElementSelection');
        }, 100);
      });
      
      // Also update settings directly
      loadSettings().then(settings => {
        settings.selectedElements = settings.selectedElements || [];
        // Check if already exists
        const exists = settings.selectedElements.some(el => el.selector === selector);
        if (!exists) {
          settings.selectedElements.push(newElement);
          saveSettings(settings);
        }
      });
    } catch (error) {
      console.debug('TPI: Error in element picker click handler:', error);
    }
    
    // Remove highlight temporarily
    removeHoverHighlight();
    
    // Re-enable after a short delay
    setTimeout(() => {
      if (elementPickerActive) {
        hoveredElement = e.target;
        updateHoverHighlight(e.target);
      }
    }, 100);
  }
  
  // Start element picking mode
  function startElementPicking() {
    console.log('[TPI Content] startElementPicking() function called');
    console.log('[TPI Content] Current elementPickerActive:', elementPickerActive);
    
    if (elementPickerActive) {
      console.warn('[TPI Content] WARNING: Element picker already active, returning early');
      return;
    }
    
    console.log('[TPI Content] Step 1: Checking if popup is open...');
    // Check if popup is open
    const popup = document.querySelector('.hMdQi');
    console.log('[TPI Content] Popup query result:', popup);
    console.log('[TPI Content] Popup exists?', popup !== null);
    
    if (!popup) {
      console.error('[TPI Content] ERROR: Cannot start element picker - popup not open');
      console.error('[TPI Content] Document body:', document.body);
      console.error('[TPI Content] All .hMdQi elements in document:', document.querySelectorAll('.hMdQi').length);
      console.error('[TPI Content] Document URL:', window.location.href);
      
      // Send message back to popup to show error
      try {
        console.log('[TPI Content] Attempting to send error message to popup...');
        chrome.runtime.sendMessage({
          action: 'pickerError',
          message: 'Please open an event popup first, then start picking.'
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('[TPI Content] Error sending picker error message:', chrome.runtime.lastError);
          } else {
            console.log('[TPI Content] Error message sent successfully');
          }
        });
      } catch (e) {
        console.error('[TPI Content] Exception sending picker error message:', e);
        console.error('[TPI Content] Exception stack:', e.stack);
      }
      return;
    }
    
    console.log('[TPI Content] Step 2: Popup found, proceeding with initialization');
    console.log('[TPI Content] Setting elementPickerActive to true');
    elementPickerActive = true;
    
    console.log('[TPI Content] Step 3: Creating hover highlight...');
    try {
      createHoverHighlight();
      console.log('[TPI Content] Hover highlight created:', hoverHighlight !== null);
    } catch (error) {
      console.error('[TPI Content] ERROR creating hover highlight:', error);
      console.error('[TPI Content] Error stack:', error.stack);
      elementPickerActive = false;
      return;
    }
    
    console.log('[TPI Content] Step 4: Adding event listeners...');
    try {
      document.addEventListener('mousemove', handleElementPickerMouseMove, true);
      console.log('[TPI Content] mousemove listener added');
      
      document.addEventListener('click', handleElementPickerClick, true);
      console.log('[TPI Content] click listener added');
    } catch (error) {
      console.error('[TPI Content] ERROR adding event listeners:', error);
      console.error('[TPI Content] Error stack:', error.stack);
      elementPickerActive = false;
      return;
    }
    
    console.log('[TPI Content] Step 5: Updating cursor...');
    try {
      document.body.style.cursor = 'crosshair';
      console.log('[TPI Content] Cursor updated to crosshair');
    } catch (error) {
      console.error('[TPI Content] ERROR updating cursor:', error);
      console.error('[TPI Content] Error stack:', error.stack);
    }
    
    console.log('[TPI Content] COMPLETE: Element picker started successfully');
    console.log('[TPI Content] Final elementPickerActive state:', elementPickerActive);
  }
  
  // Stop element picking mode
  function stopElementPicking() {
    console.log('[TPI Content] stopElementPicking() function called');
    console.log('[TPI Content] Current elementPickerActive:', elementPickerActive);
    
    if (!elementPickerActive) {
      console.warn('[TPI Content] WARNING: Element picker not active, returning early');
      return;
    }
    
    console.log('[TPI Content] Step 1: Setting elementPickerActive to false');
    elementPickerActive = false;
    
    console.log('[TPI Content] Step 2: Removing hover highlight...');
    try {
      removeHoverHighlight();
      console.log('[TPI Content] Hover highlight removed');
    } catch (error) {
      console.error('[TPI Content] ERROR removing hover highlight:', error);
    }
    
    console.log('[TPI Content] Step 3: Removing event listeners...');
    try {
      document.removeEventListener('mousemove', handleElementPickerMouseMove, true);
      console.log('[TPI Content] mousemove listener removed');
      
      document.removeEventListener('click', handleElementPickerClick, true);
      console.log('[TPI Content] click listener removed');
    } catch (error) {
      console.error('[TPI Content] ERROR removing event listeners:', error);
    }
    
    console.log('[TPI Content] Step 4: Restoring cursor...');
    try {
      document.body.style.cursor = '';
      console.log('[TPI Content] Cursor restored');
    } catch (error) {
      console.error('[TPI Content] ERROR restoring cursor:', error);
    }
    
    console.log('[TPI Content] Step 5: Removing highlight element from DOM...');
    try {
      if (hoverHighlight && hoverHighlight.parentNode) {
        hoverHighlight.parentNode.removeChild(hoverHighlight);
        hoverHighlight = null;
        console.log('[TPI Content] Highlight element removed from DOM');
      } else {
        console.log('[TPI Content] Highlight element not in DOM or already null');
      }
    } catch (error) {
      console.error('[TPI Content] ERROR removing highlight element:', error);
    }
    
    console.log('[TPI Content] COMPLETE: Element picker stopped successfully');
  }
  
  // Store active popup and its removal observer
  let activePopup = null;
  let removalObserver = null;
  let removalTimeout = null;
  
  // Apply element modifications with persistent removal
  function applyElementModifications(popup, settings) {
    if (!popup) return;
    
    if (!settings || !settings.selectedElements || settings.selectedElements.length === 0) {
      return;
    }
    
    // Separate actions for efficient processing
    const removeSelectors = [];
    const hideSelectors = [];
    const insertTextMods = [];
    
    settings.selectedElements.forEach((elementMod) => {
      if (!elementMod.selector || !elementMod.action) return;
      
      if (elementMod.action === 'remove') {
        removeSelectors.push(elementMod.selector);
      } else if (elementMod.action === 'hide') {
        hideSelectors.push(elementMod);
      } else if (elementMod.action === 'insertText' && elementMod.text) {
        insertTextMods.push(elementMod);
      }
    });
    
    // Apply hide actions
    hideSelectors.forEach((elementMod) => {
      const selector = elementMod.selector.replace(/^\.hMdQi\s+/, '').trim();
      const elements = popup.querySelectorAll(selector);
      if (elements.length === 0) {
        const allElements = document.querySelectorAll(elementMod.selector);
        Array.from(allElements).filter(el => popup.contains(el)).forEach(el => {
          if (!el.hasAttribute('data-tpi-modified')) {
            el.style.setProperty('display', 'none', 'important');
            el.style.setProperty('visibility', 'hidden', 'important');
            el.setAttribute('data-tpi-modified', 'hide');
          }
        });
      } else {
        elements.forEach(el => {
          if (!el.hasAttribute('data-tpi-modified')) {
            el.style.setProperty('display', 'none', 'important');
            el.style.setProperty('visibility', 'hidden', 'important');
            el.setAttribute('data-tpi-modified', 'hide');
          }
        });
      }
    });
    
    // Apply insert text actions
    insertTextMods.forEach((elementMod) => {
      const selector = elementMod.selector.replace(/^\.hMdQi\s+/, '').trim();
      let elements = popup.querySelectorAll(selector);
      if (elements.length === 0) {
        elements = Array.from(document.querySelectorAll(elementMod.selector)).filter(el => popup.contains(el));
      }
      elements.forEach(el => {
        if (!el.hasAttribute('data-tpi-modified')) {
          el.textContent = elementMod.text;
          if (el.tagName === 'DIV' || el.tagName === 'SPAN' || el.tagName === 'P') {
            el.innerHTML = elementMod.text;
          }
          el.setAttribute('data-tpi-modified', 'insertText');
        }
      });
    });
    
    // Apply remove actions - this needs to be persistent
    if (removeSelectors.length > 0) {
      // Store remove selectors on popup for persistent removal
      popup._tpiRemoveSelectors = removeSelectors;
      
      // Immediately remove all matching elements
      removeSelectors.forEach(selector => {
        const cleanedSelector = selector.replace(/^\.hMdQi\s+/, '').trim();
        let elements = popup.querySelectorAll(cleanedSelector);
        if (elements.length === 0) {
          elements = Array.from(document.querySelectorAll(selector)).filter(el => popup.contains(el));
        }
        elements.forEach(el => {
          if (el.parentNode) {
            el.remove();
          }
        });
      });
      
      // Set up persistent removal observer if not already set
      if (!popup._tpiRemovalObserver) {
        popup._tpiRemovalObserver = new MutationObserver(() => {
          // Debounce to avoid excessive calls
          clearTimeout(removalTimeout);
          removalTimeout = setTimeout(() => {
            if (popup._tpiRemoveSelectors && popup._tpiRemoveSelectors.length > 0) {
              popup._tpiRemoveSelectors.forEach(selector => {
                const cleanedSelector = selector.replace(/^\.hMdQi\s+/, '').trim();
                let elements = popup.querySelectorAll(cleanedSelector);
                if (elements.length === 0) {
                  elements = Array.from(document.querySelectorAll(selector)).filter(el => popup.contains(el));
                }
                elements.forEach(el => {
                  if (el.parentNode) {
                    el.remove();
                  }
                });
              });
            }
          }, 50);
        });
        
        popup._tpiRemovalObserver.observe(popup, {
          childList: true,
          subtree: true
        });
      }
    } else {
      // No remove selectors, disconnect observer if exists
      if (popup._tpiRemovalObserver) {
        popup._tpiRemovalObserver.disconnect();
        popup._tpiRemovalObserver = null;
      }
      popup._tpiRemoveSelectors = [];
    }
  }
  
  // Listen for messages from popup
  console.log('[TPI Content] Setting up message listener...');
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[TPI Content] Message received from popup');
    console.log('[TPI Content] Message object:', message);
    console.log('[TPI Content] Message action:', message ? message.action : 'N/A');
    console.log('[TPI Content] Sender:', sender);
    const senderTabId = sender && sender.tab ? sender.tab.id : 'N/A';
    console.log('[TPI Content] Sender tab ID:', senderTabId);
    console.log('[TPI Content] Sender frame ID:', sender ? sender.frameId : 'N/A');
    
    if (!message) {
      console.error('[TPI Content] ERROR: Message is null or undefined');
      sendResponse({ success: false, error: 'Message is null or undefined' });
      return false;
    }
    
    if (message.action === 'startElementPicking') {
      console.log('[TPI Content] Action: startElementPicking');
      console.log('[TPI Content] Step 1: Checking for popup element...');
      
      const popup = document.querySelector('.hMdQi');
      console.log('[TPI Content] Popup element found:', popup !== null);
      console.log('[TPI Content] Popup element:', popup);
      
      if (!popup) {
        console.error('[TPI Content] ERROR: Popup (.hMdQi) not found in DOM');
        console.error('[TPI Content] Current URL:', window.location.href);
        console.error('[TPI Content] Document ready state:', document.readyState);
        console.error('[TPI Content] All .hMdQi elements:', document.querySelectorAll('.hMdQi').length);
        
        sendResponse({ success: false, error: 'Popup not open' });
        
        // Also send error message
        try {
          console.log('[TPI Content] Attempting to send error message to popup...');
          chrome.runtime.sendMessage({
            action: 'pickerError',
            message: 'Please open an event popup first, then start picking.'
          }, (response) => {
            if (chrome.runtime.lastError) {
              console.error('[TPI Content] Error sending picker error message:', chrome.runtime.lastError);
            } else {
              console.log('[TPI Content] Error message sent successfully');
            }
          });
        } catch (e) {
          console.error('[TPI Content] Exception sending picker error:', e);
          console.error('[TPI Content] Exception stack:', e.stack);
        }
        return true;
      }
      
      console.log('[TPI Content] Step 2: Popup found, calling startElementPicking()...');
      console.log('[TPI Content] Current elementPickerActive state:', elementPickerActive);
      
      try {
        startElementPicking();
        console.log('[TPI Content] Step 3: startElementPicking() completed');
        console.log('[TPI Content] New elementPickerActive state:', elementPickerActive);
        console.log('[TPI Content] Sending success response...');
        sendResponse({ success: true });
        console.log('[TPI Content] Success response sent');
        return true;
      } catch (error) {
        console.error('[TPI Content] EXCEPTION in startElementPicking():', error);
        console.error('[TPI Content] Exception type:', error.constructor.name);
        console.error('[TPI Content] Exception message:', error.message);
        console.error('[TPI Content] Exception stack:', error.stack);
        sendResponse({ success: false, error: error.message });
        return true;
      }
    }
    
    if (message.action === 'stopElementPicking') {
      console.log('[TPI Content] Action: stopElementPicking');
      console.log('[TPI Content] Current elementPickerActive state:', elementPickerActive);
      
      try {
        stopElementPicking();
        console.log('[TPI Content] stopElementPicking() completed');
        console.log('[TPI Content] New elementPickerActive state:', elementPickerActive);
        sendResponse({ success: true });
        return true;
      } catch (error) {
        console.error('[TPI Content] EXCEPTION in stopElementPicking():', error);
        console.error('[TPI Content] Exception stack:', error.stack);
        sendResponse({ success: false, error: error.message });
        return true;
      }
    }
    
    if (message.action === 'reapplyElementModifications') {
      console.log('[TPI Content] Action: reapplyElementModifications');
      console.log('[TPI Content] Re-applying element modifications to open popup...');
      
      try {
        const popup = document.querySelector('.hMdQi');
        if (popup) {
          console.log('[TPI Content] Popup found, loading settings and applying modifications...');
          loadSettings().then(settings => {
            console.log('[TPI Content] Settings loaded, applying modifications...');
            applyElementModifications(popup, settings);
            console.log('[TPI Content] Modifications re-applied');
          });
          sendResponse({ success: true });
        } else {
          console.log('[TPI Content] No popup open, nothing to re-apply');
          sendResponse({ success: false, error: 'No popup open' });
        }
        return true;
      } catch (error) {
        console.error('[TPI Content] EXCEPTION in reapplyElementModifications:', error);
        console.error('[TPI Content] Exception stack:', error.stack);
        sendResponse({ success: false, error: error.message });
        return true;
      }
    }
    
    console.log('[TPI Content] Unknown action:', message.action);
    return false;
  });
  
  console.log('[TPI Content] Message listener registered successfully');
  
  // Load settings and apply element modifications when popup opens
  // This is also called from the mutation observer when popup opens

  // Start the extension
  console.log('[TPI Content] Calling init() function...');
  init();
  console.log('[TPI Content] init() completed, extension is running');
  console.log('[TPI Content] Element picker functions available:', {
    startElementPicking: typeof startElementPicking !== 'undefined',
    stopElementPicking: typeof stopElementPicking !== 'undefined',
    createHoverHighlight: typeof createHoverHighlight !== 'undefined'
  });
})();

