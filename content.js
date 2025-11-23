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
    textColor: '#ffffff' // Text color (default white)
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

  // Replace .xnWuge element with SVG icon - aggressive approach
  async function replaceXnWugeWithIcon(popup, settings) {
    if (!popup) return;
    
    function doReplace() {
      // Find the .xnWuge element
      const xnWuge = popup.querySelector('.xnWuge');
      if (!xnWuge) return false;
      
      // Check if already replaced
      if (popup.querySelector('.tpi-xnwuge-replacement')) {
        return true; // Already replaced
      }
      
      // Get parent and position before removing
      const parent = xnWuge.parentElement;
      if (!parent) return false;
      
      // Get computed styles
      const xnWugeStyle = window.getComputedStyle(xnWuge);
      const position = xnWugeStyle.position || 'absolute';
      const top = xnWugeStyle.top || '0';
      const left = xnWugeStyle.left || '0';
      const width = xnWugeStyle.width || '64px';
      const height = xnWugeStyle.height || '64px';
      const zIndex = xnWugeStyle.zIndex || '1';
      
      // Create umbrella icon
      createUmbrellaIcon(settings).then(icon => {
        if (!icon) return;
        
        // Style the icon to match .xnWuge's position and size
        icon.style.setProperty('position', position, 'important');
        icon.style.setProperty('top', top, 'important');
        icon.style.setProperty('left', left, 'important');
        icon.style.setProperty('width', width, 'important');
        icon.style.setProperty('height', height, 'important');
        icon.style.setProperty('display', 'flex', 'important');
        icon.style.setProperty('align-items', 'center', 'important');
        icon.style.setProperty('justify-content', 'center', 'important');
        icon.style.setProperty('z-index', zIndex, 'important');
        icon.style.setProperty('pointer-events', 'none', 'important');
        icon.classList.add('tpi-xnwuge-replacement');
        
        // For SVG elements, ensure proper sizing
        const svgElement = icon.tagName === 'svg' ? icon : icon.querySelector('svg');
        if (svgElement) {
          const size = Math.min(
            parseInt(width) || 64,
            parseInt(height) || 64
          );
          svgElement.setAttribute('width', size.toString());
          svgElement.setAttribute('height', size.toString());
          svgElement.style.setProperty('width', '100%', 'important');
          svgElement.style.setProperty('height', '100%', 'important');
          svgElement.style.setProperty('display', 'block', 'important');
        }
        
        // Set icon color to white for visibility
        icon.style.setProperty('color', '#ffffff', 'important');
        const svgForColor = icon.tagName === 'svg' ? icon : icon.querySelector('svg');
        if (svgForColor) {
          svgForColor.style.setProperty('color', '#ffffff', 'important');
          const paths = svgForColor.querySelectorAll('path, circle, line');
          paths.forEach(path => {
            if (path.getAttribute('fill') && path.getAttribute('fill') !== 'none') {
              path.setAttribute('fill', '#ffffff');
            }
            if (path.getAttribute('stroke') && path.getAttribute('stroke') !== 'none') {
              path.setAttribute('stroke', '#ffffff');
            }
          });
        }
        
        // REMOVE .xnWuge completely
        xnWuge.remove();
        
        // Insert icon in the same position
        parent.appendChild(icon);
      });
      
      return true;
    }
    
    // Try immediately
    if (!doReplace()) {
      // If not found, try with delays and MutationObserver
      const observer = new MutationObserver(() => {
        if (doReplace()) {
          observer.disconnect();
        }
      });
      
      observer.observe(popup, {
        childList: true,
        subtree: true
      });
      
      // Also try with delays
      setTimeout(() => {
        if (doReplace()) observer.disconnect();
      }, 50);
      setTimeout(() => {
        if (doReplace()) observer.disconnect();
      }, 200);
      setTimeout(() => {
        observer.disconnect();
      }, 2000);
    }
  }

  // Inject large umbrella icon in popup where .xnWuge was
  async function injectLargeUmbrellaIconInPopup(popup, settings) {
    if (!popup) return;
    
    // Find the .xnWuge element's parent container (where we want to place the icon)
    const xnWuge = popup.querySelector('.xnWuge');
    if (!xnWuge) return;
    
    // Check if icon already exists
    const existingIcon = popup.querySelector('.tpi-popup-umbrella-icon');
    if (existingIcon) {
      // Update icon color if settings changed
      applyIconColor(existingIcon, settings);
      return;
    }
    
    // Find the parent container of .xnWuge (usually .zZj8Pb.EaVNbc)
    const parentContainer = xnWuge.parentElement;
    if (!parentContainer) return;
    
    // Ensure parent has position: relative
    const parentStyle = window.getComputedStyle(parentContainer);
    if (parentStyle.position === 'static' || !parentStyle.position) {
      parentContainer.style.setProperty('position', 'relative', 'important');
    }
    
    // Create large umbrella icon
    const icon = await createUmbrellaIcon(settings);
    if (!icon) return;
    
    // Style the icon for popup (large size)
    icon.classList.add('tpi-popup-umbrella-icon');
    icon.style.setProperty('position', 'absolute', 'important');
    icon.style.setProperty('top', '0', 'important');
    icon.style.setProperty('left', '0', 'important');
    icon.style.setProperty('width', '64px', 'important');
    icon.style.setProperty('height', '64px', 'important');
    icon.style.setProperty('display', 'flex', 'important');
    icon.style.setProperty('align-items', 'center', 'important');
    icon.style.setProperty('justify-content', 'center', 'important');
    icon.style.setProperty('z-index', '1', 'important');
    icon.style.setProperty('pointer-events', 'none', 'important');
    
    // For SVG elements, ensure proper sizing
    const svgElement = icon.tagName === 'svg' ? icon : icon.querySelector('svg');
    if (svgElement) {
      svgElement.setAttribute('width', '64');
      svgElement.setAttribute('height', '64');
      svgElement.style.setProperty('width', '64px', 'important');
      svgElement.style.setProperty('height', '64px', 'important');
      svgElement.style.setProperty('display', 'block', 'important');
    }
    
    // Set icon color to cyan for popup (matches extension theme)
    icon.style.setProperty('color', '#00bcd4', 'important');
    const svgForColor = icon.tagName === 'svg' ? icon : icon.querySelector('svg');
    if (svgForColor) {
      svgForColor.style.setProperty('color', '#00bcd4', 'important');
      const paths = svgForColor.querySelectorAll('path, circle, line');
      paths.forEach(path => {
        if (path.getAttribute('fill') && path.getAttribute('fill') !== 'none') {
          path.setAttribute('fill', '#00bcd4');
        }
        if (path.getAttribute('stroke') && path.getAttribute('stroke') !== 'none') {
          path.setAttribute('stroke', '#00bcd4');
        }
      });
    }
    
    // Insert the icon in the parent container (where .xnWuge is)
    parentContainer.insertBefore(icon, xnWuge);
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
        
        // Check if popup opened (when .hMdQi appears)
        if (mutation.addedNodes.length > 0) {
          for (let node of mutation.addedNodes) {
            if (node.nodeType === 1) { // Element node
               // Check if popup opened
               if (node.classList && node.classList.contains('hMdQi')) {
                 // Popup opened - re-apply colors to all processed events
                 setTimeout(() => {
                   reapplyColorsToProcessedEvents();
                   
                   // Replace .xnWuge with SVG icon
                   const popup = node;
                   loadSettings().then(settings => {
                     replaceXnWugeWithIcon(popup, settings);
                   });
                   
                   // Remove any umbrella icons from popup - icons only show on event bars
                   // Remove all possible icon variations - be very aggressive
                   const existingIcons = popup.querySelectorAll('.tpi-popup-umbrella-icon, .tpi-umbrella-icon');
                   existingIcons.forEach(icon => icon.remove());
                   
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
    // Start observing immediately
    startObserving();
    
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

  // Start the extension
  init();
})();

