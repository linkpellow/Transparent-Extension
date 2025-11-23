// TPI - Google Calendar Color Changer
// This script modifies the colors of Google Calendar events

(function() {
  'use strict';
  
  console.log('TPI: [DEBUG] Script loaded and running!');

  // Default color settings
  const defaultSettings = {
    enabled: true,
    filterMode: 'filtered', // Only filtered events
    filterKeywords: 'transparent',
    filterByTitle: true,
    filterByCalendar: false,
    caseSensitive: false,
    colorMode: 'custom', // Event color mode
    customColor: '#2e3c52', // Default event color
    outlineEnabled: true,
    outlineDisplayMode: 'filtered', // Filtered events only
    outlineThickness: 0.7, // in pixels
    outlineColor: '#2cbcd4', // Cyan outline color
    iconEnabled: true, // Show umbrella icon
    iconWhite: true, // Make icon white
    iconDisplayMode: 'filtered', // Filtered events only
    iconFilterMode: 'filtered', // Legacy support
    iconKeywords: '',
    customIconSvg: '', // Custom SVG icon code
    textColorEnabled: true, // Enable text color
    textColorDisplayMode: 'all', // All events
    textColor: '#ffffff', // White text color
    googleCalendarBranding: false // Google Calendar branding toggle
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

  // Get timezone abbreviation
  function getTimezoneAbbreviation(timezone) {
    try {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        timeZoneName: 'short'
      });
      const parts = formatter.formatToParts(now);
      const tzName = parts.find(part => part.type === 'timeZoneName');
      return tzName ? tzName.value : '';
    } catch (e) {
      // Fallback: try to extract from timezone string
      const match = timezone.match(/\/([^/]+)$/);
      if (match) {
        const city = match[1].replace(/_/g, ' ');
        // Common timezone abbreviations
        const tzMap = {
          'America/New_York': 'EST',
          'America/Chicago': 'CST',
          'America/Denver': 'MST',
          'America/Los_Angeles': 'PST',
          'America/Phoenix': 'MST',
          'Europe/London': 'GMT',
          'Europe/Paris': 'CET',
          'Asia/Tokyo': 'JST'
        };
        return tzMap[timezone] || city.substring(0, 3).toUpperCase();
      }
      return '';
    }
  }

  // Hide reminder ("30 minutes before"), "Link Pellow", and notification bell icon
  function hideReminderAndAttendee(popup) {
    if (!popup) return;
    
    // Hide "30 minutes before" text
    const allElements = popup.querySelectorAll('div, span, p');
    allElements.forEach(el => {
      const text = el.textContent || '';
      if (text.trim() === '30 minutes before' || 
          (text.includes('30 minutes before') && 
           !text.includes('Link Pellow') &&
           !text.includes('Notes -'))) {
        el.style.setProperty('display', 'none', 'important');
        el.style.setProperty('visibility', 'hidden', 'important');
        // Also hide parent if it only contains the reminder
        const parent = el.parentElement;
        if (parent && (parent.textContent || '').trim() === '30 minutes before') {
          parent.style.setProperty('display', 'none', 'important');
          parent.style.setProperty('visibility', 'hidden', 'important');
        }
      }
    });
    
    // Hide notification bell icon
    const bellIcons = popup.querySelectorAll('i.google-material-icons[aria-hidden="true"]');
    bellIcons.forEach(icon => {
      const iconText = icon.textContent || icon.innerText || '';
      if (iconText.includes('notifications') || iconText.includes('notification')) {
        icon.style.setProperty('display', 'none', 'important');
        icon.style.setProperty('visibility', 'hidden', 'important');
        // Also hide parent container if it only contains the bell
        const parent = icon.parentElement;
        if (parent && parent.querySelectorAll('i.google-material-icons').length === 1) {
          parent.style.setProperty('display', 'none', 'important');
          parent.style.setProperty('visibility', 'hidden', 'important');
        }
      }
    });
    
    // Hide "Link Pellow" - hide it everywhere
    const linkPellowElements = popup.querySelectorAll('div, span, p');
    linkPellowElements.forEach(el => {
      const text = el.textContent || el.innerText || '';
      if (text.trim() === 'Link Pellow' || text.trim().startsWith('Link Pellow')) {
        // Hide the element
        el.style.setProperty('display', 'none', 'important');
        el.style.setProperty('visibility', 'hidden', 'important');
        el.style.setProperty('opacity', '0', 'important');
        el.style.setProperty('height', '0', 'important');
        el.style.setProperty('margin', '0', 'important');
        el.style.setProperty('padding', '0', 'important');
      }
    });
    
    // Also specifically target div.Fh4HL elements
    const attendeeDivs = popup.querySelectorAll('div.Fh4HL');
    attendeeDivs.forEach(div => {
      if (div.textContent && div.textContent.trim() === 'Link Pellow') {
        div.style.setProperty('display', 'none', 'important');
        div.style.setProperty('visibility', 'hidden', 'important');
        div.style.setProperty('opacity', '0', 'important');
        div.style.setProperty('height', '0', 'important');
        div.style.setProperty('margin', '0', 'important');
        div.style.setProperty('padding', '0', 'important');
      }
    });
    
    // Hide "Take meeting notes" and "Start a new document to capture notes"
    const allTextElements = popup.querySelectorAll('a, div, span, p');
    allTextElements.forEach(el => {
      const text = el.textContent || el.innerText || '';
      if (text.includes('Take meeting notes') || 
          text.includes('Start a new document to capture notes') ||
          text.trim() === 'Take meeting notes' ||
          text.trim() === 'Start a new document to capture notes') {
        // Hide the element and its parent container if it's a link
        el.style.setProperty('display', 'none', 'important');
        el.style.setProperty('visibility', 'hidden', 'important');
        el.style.setProperty('opacity', '0', 'important');
        el.style.setProperty('height', '0', 'important');
        el.style.setProperty('margin', '0', 'important');
        el.style.setProperty('padding', '0', 'important');
        
        // If it's a link, also hide its parent container
        if (el.tagName === 'A' || el.closest('a')) {
          const linkElement = el.tagName === 'A' ? el : el.closest('a');
          if (linkElement && linkElement.parentElement) {
            const parent = linkElement.parentElement;
            // Check if parent only contains this link
            const parentText = parent.textContent || '';
            if (parentText.includes('Take meeting notes') || 
                parentText.includes('Start a new document to capture notes')) {
              parent.style.setProperty('display', 'none', 'important');
              parent.style.setProperty('visibility', 'hidden', 'important');
              parent.style.setProperty('opacity', '0', 'important');
              parent.style.setProperty('height', '0', 'important');
              parent.style.setProperty('margin', '0', 'important');
              parent.style.setProperty('padding', '0', 'important');
            }
          }
        }
      }
    });
  }

  // Inject SVG icon where .xnWuge was - simple direct approach
  async function injectIconInXnWugeLocation(popup, settings) {
    console.log('TPI: [DEBUG] injectIconInXnWugeLocation called!', popup, settings);
    if (!popup) {
      console.warn('TPI: [DEBUG] No popup provided!');
      return;
    }
    
    console.log('TPI: [DEBUG] Popup element:', popup, 'Class:', popup.className);
    
    // Check if already injected
    if (popup.querySelector('.tpi-xnwuge-replacement')) {
      console.log('TPI: [DEBUG] Already has xnWuge replacement, continuing for title icon');
      // Don't return - we still want to inject title icon
    }
    
    function injectIcon() {
      // Find the title element to inject icon in front of it
      const titleElement = popup.querySelector('#rAECCd') || 
                          popup.querySelector('.UfeRlc') || 
                          popup.querySelector('span[role="heading"]');
      if (!titleElement) {
        console.debug('TPI: Title element not found');
        return false;
      }
      
      // Check if icon already exists
      if (titleElement.querySelector('.tpi-xnwuge-replacement') || 
          titleElement.previousElementSibling?.classList.contains('tpi-xnwuge-replacement')) {
        return true; // Already injected
      }
      
      console.debug('TPI: Injecting icon in front of title');
      
      // Create and inject icon
      createUmbrellaIcon(settings).then(icon => {
        if (!icon) {
          console.debug('TPI: Failed to create icon');
          return;
        }
        
        console.debug('TPI: Icon created, injecting...', icon);
        
        // Style the icon for front of title - larger size
        icon.style.setProperty('display', 'inline-block', 'important');
        icon.style.setProperty('vertical-align', 'middle', 'important');
        icon.style.setProperty('margin-right', '12px', 'important');
        icon.style.setProperty('margin-left', '8px', 'important');
        icon.style.setProperty('margin-top', '4px', 'important');
        icon.style.setProperty('width', '48px', 'important');
        icon.style.setProperty('height', '48px', 'important');
        icon.style.setProperty('flex-shrink', '0', 'important');
        icon.style.setProperty('visibility', 'visible', 'important');
        icon.style.setProperty('opacity', '1', 'important');
        icon.classList.add('tpi-xnwuge-replacement');
        
        // Remove any classes that might cause it to be hidden
        icon.classList.remove('tpi-popup-umbrella-icon', 'tpi-umbrella-icon');
        
        // For SVG elements, ensure proper sizing
        const svgElement = icon.tagName === 'svg' ? icon : icon.querySelector('svg');
        if (svgElement) {
          svgElement.setAttribute('width', '48');
          svgElement.setAttribute('height', '48');
          svgElement.style.setProperty('width', '48px', 'important');
          svgElement.style.setProperty('height', '48px', 'important');
          svgElement.style.setProperty('display', 'inline-block', 'important');
          svgElement.style.setProperty('vertical-align', 'middle', 'important');
        }
        
        // Set icon color to white for visibility
        icon.style.setProperty('color', '#ffffff', 'important');
        const svgForColor = icon.tagName === 'svg' ? icon : icon.querySelector('svg');
        if (svgForColor) {
          svgForColor.style.setProperty('color', '#ffffff', 'important');
          svgForColor.style.setProperty('fill', '#ffffff', 'important');
          const paths = svgForColor.querySelectorAll('path, circle, line, rect, polygon');
          paths.forEach(path => {
            const fill = path.getAttribute('fill');
            const stroke = path.getAttribute('stroke');
            if (fill && fill !== 'none' && fill !== 'transparent') {
              path.setAttribute('fill', '#ffffff');
            }
            if (stroke && stroke !== 'none' && stroke !== 'transparent') {
              path.setAttribute('stroke', '#ffffff');
            }
          });
        }
        
        // Insert icon at the very beginning of title element (before the text)
        if (titleElement.firstChild) {
          titleElement.insertBefore(icon, titleElement.firstChild);
        } else {
          titleElement.appendChild(icon);
        }
        
        // Format the title: move "Robert Parkfield" to new line, make it smaller, remove "—"
        const titleText = titleElement.textContent || titleElement.innerText || '';
        if (titleText.includes('Transparent Insurance') && titleText.includes('Robert Parkfield')) {
          // Get all text nodes (excluding the icon we just added)
          const textNodes = Array.from(titleElement.childNodes).filter(
            node => node.nodeType === Node.TEXT_NODE
          );
          
          // Clear existing text content but keep the icon
          textNodes.forEach(node => node.remove());
          
          // Create "Transparent Insurance" text (bolder)
          const mainTextSpan = document.createElement('span');
          mainTextSpan.textContent = 'Transparent Insurance';
          mainTextSpan.style.setProperty('font-weight', '600', 'important');
          titleElement.appendChild(mainTextSpan);
          
          // Create line break
          const br = document.createElement('br');
          titleElement.appendChild(br);
          
          // Create "Robert Parkfield" text (smaller, no dash)
          const nameSpan = document.createElement('span');
          nameSpan.textContent = 'Robert Parkfield';
          nameSpan.style.setProperty('font-size', '0.7em', 'important');
          nameSpan.style.setProperty('opacity', '0.9', 'important');
          nameSpan.style.setProperty('display', 'block', 'important');
          nameSpan.style.setProperty('margin-bottom', '16px', 'important');
          nameSpan.style.setProperty('padding-bottom', '8px', 'important');
          titleElement.appendChild(nameSpan);
          
          // Set white-space to pre-line to respect line breaks
          titleElement.style.setProperty('white-space', 'pre-line', 'important');
        }
        
        // Format time display: remove end time, keep only start time, add timezone, separate date and time with CSS
        const dateTimeElement = popup.querySelector('.AzuXid');
        if (dateTimeElement) {
          // Mark as formatted so CSS spacing rules apply
          dateTimeElement.classList.add('tpi-formatted');
          const fullText = dateTimeElement.textContent || '';
          
          // Get timezone from browser or event
          const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
          const timezoneAbbr = getTimezoneAbbreviation(timezone);
          
          // Pattern to find time: "4:30 – 5:00pm" or "12:00pm" or "4:30pm"
          const timePatternWithDuration = /(\d+:\d+)\s*[–-]\s*\d+:\d+\s*(am|pm)/i;
          const timePattern = /\d+:\d+\s*(am|pm)/i;
          
          let datePart = '';
          let timePart = '';
          
          // Check if there's a duration pattern first
          if (fullText.match(timePatternWithDuration)) {
            const match = fullText.match(timePatternWithDuration);
            if (match) {
              const startTime = match[1]; // e.g., "4:30"
              const amPm = match[2]; // e.g., "pm"
              timePart = startTime + amPm + ' ' + timezoneAbbr;
              
              // Find where the time starts in the original text
              const timeIndex = fullText.search(timePatternWithDuration);
              datePart = fullText.substring(0, timeIndex).replace(/⋅/g, '').trim();
            }
          } else if (fullText.match(timePattern)) {
            // Find where the time starts
            const timeMatch = fullText.match(timePattern);
            if (timeMatch) {
              const timeIndex = fullText.search(timePattern);
              datePart = fullText.substring(0, timeIndex).replace(/⋅/g, '').trim();
              
              // Check if timezone already exists
              const timeText = fullText.substring(timeIndex).trim();
              if (timeText.match(/[A-Z]{2,5}$/)) {
                // Timezone already exists
                timePart = timeText;
              } else {
                // Add timezone
                timePart = timeText + ' ' + timezoneAbbr;
              }
            }
          } else {
            // No time pattern found, just clean up the text
            datePart = fullText.replace(/⋅/g, '').trim();
            timePart = '';
          }
          
          // Clear the element and rebuild with separate spans
          dateTimeElement.innerHTML = '';
          
          // Create date span
          if (datePart) {
            const dateSpan = document.createElement('span');
            dateSpan.className = 'tpi-date-part';
            dateSpan.textContent = datePart;
            dateTimeElement.appendChild(dateSpan);
          }
          
          // Create time span with spacing
          if (timePart) {
            const timeSpan = document.createElement('span');
            timeSpan.className = 'tpi-time-part';
            timeSpan.textContent = timePart;
            timeSpan.style.setProperty('margin-left', '5.5em', 'important');
            timeSpan.style.setProperty('display', 'inline-block', 'important');
            dateTimeElement.appendChild(timeSpan);
          }
        }
        
        console.debug('TPI: Icon injected successfully in front of title', icon);
      });
      
      // Position action icons at bottom (with retries for dynamic content)
      removeActionIcons(popup);
      // Retry after delays to catch icons added dynamically
      setTimeout(() => removeActionIcons(popup), 100);
      setTimeout(() => removeActionIcons(popup), 300);
      setTimeout(() => removeActionIcons(popup), 500);
      
      // Remove specific button element
      removeSpecificButton(popup);
      
      // Set up observer to catch dynamically added action icons
      observeActionIcons(popup);
      
      return true;
    }
    
    // Position action icons at bottom of popup
    // Direct approach: Position each icon individually at the bottom
    function removeActionIcons(popup) {
      if (!popup) return;
      
      // Ensure popup has position relative for absolute positioning
      popup.style.setProperty('position', 'relative', 'important');
      
      // Find all action icon containers with class pYTkkf-Bz112c-RLmnJb
      const actionContainers = popup.querySelectorAll('.pYTkkf-Bz112c-RLmnJb');
      
      console.debug('TPI: Found', actionContainers.length, 'action icon containers to position at bottom');
      
      if (actionContainers.length === 0) return;
      
      // Position each icon directly at the bottom
      // Calculate right offset for each icon to arrange them horizontally
      const iconSpacing = 40; // Space between icons
      const rightOffset = 16; // Distance from right edge
      
      actionContainers.forEach((container, index) => {
        // Make sure it's visible
        container.style.setProperty('display', 'block', 'important');
        container.style.setProperty('visibility', 'visible', 'important');
        container.style.setProperty('opacity', '1', 'important');
        container.style.setProperty('pointer-events', 'auto', 'important');
        
        // Position absolutely at bottom
        container.style.setProperty('position', 'absolute', 'important');
        container.style.setProperty('bottom', '16px', 'important');
        
        // Calculate right position for horizontal arrangement
        // First icon is furthest right, subsequent icons go left
        const calculatedRight = rightOffset + (index * iconSpacing);
        container.style.setProperty('right', `${calculatedRight}px`, 'important');
        
        // Remove conflicting properties
        container.style.setProperty('top', 'auto', 'important');
        container.style.setProperty('left', 'auto', 'important');
        container.style.setProperty('transform', 'none', 'important');
        container.style.setProperty('z-index', '1000', 'important');
      });
    }
    
    // Set up MutationObserver to catch dynamically added action icons
    function observeActionIcons(popup) {
      if (!popup) return;
      
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Check if the added node is an action icon
              if (node.classList && node.classList.contains('pYTkkf-Bz112c-RLmnJb')) {
                console.debug('TPI: Detected dynamically added action icon, positioning at bottom...');
                // Small delay to ensure element is fully in DOM
                setTimeout(() => removeActionIcons(popup), 50);
              }
              // Check if any child is an action icon
              const actionIcons = node.querySelectorAll && node.querySelectorAll('.pYTkkf-Bz112c-RLmnJb');
              if (actionIcons && actionIcons.length > 0) {
                console.debug('TPI: Detected dynamically added action icons in subtree, positioning at bottom...');
                // Small delay to ensure elements are fully in DOM
                setTimeout(() => removeActionIcons(popup), 50);
              }
            }
          });
        });
      });
      
      observer.observe(popup, {
        childList: true,
        subtree: true
      });
      
      // Clean up observer after 10 seconds (popup should be fully loaded by then)
      setTimeout(() => {
        observer.disconnect();
      }, 10000);
    }
    
    // Remove specific button element
    function removeSpecificButton(popup) {
      if (!popup) return;
      
      // Try to find the element using the specific selector
      const buttonDiv = popup.querySelector('#xDetDlg > div > div.Tnsqdc > div > div > div.pPTZAe > div:nth-child(1) > span > button > div');
      
      if (buttonDiv) {
        console.debug('TPI: Found specific button element to remove');
        try {
          buttonDiv.remove();
        } catch (e) {
          // If remove fails, try parentElement.removeChild
          if (buttonDiv.parentElement) {
            try {
              buttonDiv.parentElement.removeChild(buttonDiv);
            } catch (e2) {
              // If that fails, hide it completely
              buttonDiv.style.setProperty('display', 'none', 'important');
              buttonDiv.style.setProperty('visibility', 'hidden', 'important');
              buttonDiv.style.setProperty('opacity', '0', 'important');
              buttonDiv.style.setProperty('width', '0', 'important');
              buttonDiv.style.setProperty('height', '0', 'important');
              buttonDiv.style.setProperty('pointer-events', 'none', 'important');
            }
          }
        }
      } else {
        // Also try finding by class combinations as fallback
        const button = popup.querySelector('div.pPTZAe > div:nth-child(1) > span > button > div');
        if (button) {
          console.debug('TPI: Found button element by fallback selector, removing...');
          try {
            button.remove();
          } catch (e) {
            if (button.parentElement) {
              try {
                button.parentElement.removeChild(button);
              } catch (e2) {
                button.style.setProperty('display', 'none', 'important');
                button.style.setProperty('visibility', 'hidden', 'important');
                button.style.setProperty('opacity', '0', 'important');
              }
            }
          }
        }
      }
    }
    
    // Inject icon in front of event title - specifically #rAECCd
    async function injectIconInTitle() {
      console.log('TPI: [DEBUG] injectIconInTitle called, popup:', popup);
      
      // Find the event title element - MUST be #rAECCd
      const titleElement = popup.querySelector('#rAECCd');
      if (!titleElement) {
        console.warn('TPI: [DEBUG] Title element #rAECCd not found in popup');
        console.log('TPI: [DEBUG] Popup HTML:', popup.innerHTML.substring(0, 500));
        // Try alternative selectors
        const altTitle = popup.querySelector('span[role="heading"]') || 
                        popup.querySelector('.UfeRlc span');
        if (altTitle) {
          console.log('TPI: [DEBUG] Found alternative title element:', altTitle);
        }
        return false;
      }
      
      console.log('TPI: [DEBUG] Found title element:', titleElement, 'Text:', titleElement.textContent);
      
      // Check if icon already exists in title
      if (titleElement.querySelector('.tpi-title-icon')) {
        console.log('TPI: [DEBUG] Icon already exists in title');
        return true; // Already injected
      }
      
      // Also check if icon is already a direct child (might have been inserted differently)
      const existingIcon = Array.from(titleElement.childNodes).find(
        node => node.nodeType === Node.ELEMENT_NODE && 
        node.classList && 
        node.classList.contains('tpi-title-icon')
      );
      if (existingIcon) {
        console.log('TPI: [DEBUG] Icon already exists as direct child');
        return true; // Already injected
      }
      
      console.log('TPI: [DEBUG] Creating icon for title...');
      
      try {
        // Create and inject icon
        const icon = await createUmbrellaIcon(settings);
        if (!icon) {
          console.error('TPI: [DEBUG] Failed to create icon for title - createUmbrellaIcon returned null/undefined');
          return false;
        }
        
        console.log('TPI: [DEBUG] Icon created:', icon, 'Tag:', icon.tagName, 'Classes:', icon.className);
        
        // Style the icon for title
        icon.style.setProperty('display', 'inline-block', 'important');
        icon.style.setProperty('vertical-align', 'middle', 'important');
        icon.style.setProperty('margin-right', '8px', 'important');
        icon.style.setProperty('width', '20px', 'important');
        icon.style.setProperty('height', '20px', 'important');
        icon.style.setProperty('flex-shrink', '0', 'important');
        icon.style.setProperty('visibility', 'visible', 'important');
        icon.style.setProperty('opacity', '1', 'important');
        // CRITICAL: Remove tpi-umbrella-icon class FIRST before adding tpi-title-icon
        // This prevents the removal code from deleting our icon
        icon.classList.remove('tpi-popup-umbrella-icon', 'tpi-umbrella-icon');
        icon.classList.add('tpi-title-icon');
        // Double-check: ensure it doesn't have the problematic class
        if (icon.classList.contains('tpi-umbrella-icon')) {
          console.warn('TPI: [DEBUG] Icon still has tpi-umbrella-icon class after removal!');
          icon.classList.remove('tpi-umbrella-icon');
        }
        
        // For SVG elements, ensure proper sizing
        const svgElement = icon.tagName === 'svg' ? icon : icon.querySelector('svg');
        if (svgElement) {
          console.log('TPI: [DEBUG] Found SVG element, setting attributes');
          svgElement.setAttribute('width', '20');
          svgElement.setAttribute('height', '20');
          svgElement.style.setProperty('width', '20px', 'important');
          svgElement.style.setProperty('height', '20px', 'important');
          svgElement.style.setProperty('display', 'inline-block', 'important');
          svgElement.style.setProperty('vertical-align', 'middle', 'important');
          svgElement.style.setProperty('visibility', 'visible', 'important');
          svgElement.style.setProperty('opacity', '1', 'important');
        } else {
          console.warn('TPI: [DEBUG] No SVG element found in icon');
        }
        
        // Set icon color to white for visibility
        icon.style.setProperty('color', '#ffffff', 'important');
        const svgForColor = icon.tagName === 'svg' ? icon : icon.querySelector('svg');
        if (svgForColor) {
          svgForColor.style.setProperty('color', '#ffffff', 'important');
          svgForColor.style.setProperty('fill', '#ffffff', 'important');
          const paths = svgForColor.querySelectorAll('path, circle, line, rect, polygon');
          console.log('TPI: [DEBUG] Found', paths.length, 'paths in SVG');
          paths.forEach(path => {
            const fill = path.getAttribute('fill');
            const stroke = path.getAttribute('stroke');
            if (fill && fill !== 'none' && fill !== 'transparent') {
              path.setAttribute('fill', '#ffffff');
            }
            if (stroke && stroke !== 'none' && stroke !== 'transparent') {
              path.setAttribute('stroke', '#ffffff');
            }
          });
        }
        
        // Insert icon at the very beginning of title element
        // The span contains text, so we insert the icon before any text nodes
        console.log('TPI: [DEBUG] Inserting icon into title element. First child:', titleElement.firstChild);
        if (titleElement.firstChild) {
          titleElement.insertBefore(icon, titleElement.firstChild);
        } else {
          titleElement.appendChild(icon);
        }
        
        console.log('TPI: [DEBUG] Icon injected successfully! Title HTML:', titleElement.innerHTML.substring(0, 200));
        console.log('TPI: [DEBUG] Icon computed styles:', window.getComputedStyle(icon).display, 
                    window.getComputedStyle(icon).visibility, 
                    window.getComputedStyle(icon).opacity);
        
        return true;
      } catch (err) {
        console.error('TPI: [DEBUG] Error injecting icon in title', err);
        return false;
      }
    }
    
    // Title icon injection disabled - only showing the large icon on the left
    // let titleInjected = false;
    // async function tryInjectTitle() {
    //   if (!titleInjected) {
    //     const result = await injectIconInTitle();
    //     if (result) {
    //       titleInjected = true;
    //     }
    //   }
    // }
    
    // Try immediately
    // tryInjectTitle();
    
    // Also try with delays in case element isn't ready
    // setTimeout(tryInjectTitle, 50);
    // setTimeout(tryInjectTitle, 100);
    // setTimeout(tryInjectTitle, 200);
    // setTimeout(tryInjectTitle, 500);
    // setTimeout(tryInjectTitle, 1000);
    
    // Try immediately for the .xnWuge replacement
    if (injectIcon()) {
      return;
    }
    
    // If parent container not found yet, use MutationObserver
    const observer = new MutationObserver(() => {
      // Try title injection on every mutation
      tryInjectTitle();
      
      // Try .xnWuge replacement
      if (injectIcon()) {
        observer.disconnect();
      }
    });
    
    observer.observe(popup, {
      childList: true,
      subtree: true
    });
    
    // Clean up observer after 5 seconds
    setTimeout(() => {
      observer.disconnect();
    }, 5000);
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

    const thickness = settings.outlineThickness || 0.5;
    const color = settings.outlineColor || '#ffffff';

    // Apply outline using multiple methods for better compatibility
    // Note: The pulsing glow animation is handled by CSS, so we only add the outline
    // The CSS animation will handle the multi-color glow effect
    eventElement.style.setProperty('border', `${thickness}px solid ${color}`, 'important');
    eventElement.style.setProperty('outline', `${thickness}px solid ${color}`, 'important');
    eventElement.style.setProperty('outline-offset', `-${thickness}px`, 'important');
    // Don't set box-shadow here - let CSS animation handle the pulsing glow
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
    console.log('TPI: [DEBUG] startObserving called');
    if (observer) {
      observer.disconnect();
    }

    observer = new MutationObserver((mutations) => {
      // Log when mutations are detected
      if (mutations.length > 0) {
        console.log('TPI: [DEBUG] MutationObserver triggered, mutations:', mutations.length);
      }
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
        // Check both addedNodes and the subtree of added nodes
        if (mutation.addedNodes.length > 0) {
          for (let node of mutation.addedNodes) {
            if (node.nodeType === 1) { // Element node
              // Check if this node itself is the popup
              let popupElement = null;
              if (node.classList && node.classList.contains('hMdQi')) {
                popupElement = node;
              } else {
                // Check if popup is in the subtree of this node
                popupElement = node.querySelector && node.querySelector('.hMdQi');
              }
              
              if (popupElement) {
                console.log('TPI: [DEBUG] POPUP DETECTED!', popupElement);
                // Popup opened - re-apply colors to all processed events
                setTimeout(() => {
                  console.log('TPI: [DEBUG] Inside setTimeout, loading settings...');
                  reapplyColorsToProcessedEvents();
                   
                  // Inject SVG icon where .xnWuge was
                  const popup = popupElement;
                  loadSettings().then(settings => {
                    console.log('TPI: [DEBUG] Settings loaded, injecting icon...', settings);
                    // Remove old icons FIRST, before injecting new ones
                    // This prevents race conditions
                    const existingIcons = popup.querySelectorAll('.tpi-popup-umbrella-icon, .tpi-umbrella-icon');
                    console.log('TPI: [DEBUG] Found', existingIcons.length, 'existing icons to check');
                    existingIcons.forEach(icon => {
                      // Don't remove title icon or xnWuge replacement
                      if (!icon.classList.contains('tpi-title-icon') && 
                          !icon.classList.contains('tpi-xnwuge-replacement')) {
                        icon.remove();
                      }
                    });
                    
                    // Now inject the new icons
                    console.log('TPI: [DEBUG] Calling injectIconInXnWugeLocation...');
                    injectIconInXnWugeLocation(popup, settings);
                    
                    // Hide "30 minutes before", "Link Pellow", and notification bell
                    hideReminderAndAttendee(popup);
                    
                    // Remove specific button element
                    removeSpecificButton(popup);
                  }).catch(err => {
                    console.error('TPI: [DEBUG] Error loading settings:', err);
                  });
                }, 100); // Small delay to ensure popup is fully rendered
              }
              
              // Check if any added nodes are likely calendar events
              if (node.hasAttribute && (node.hasAttribute('data-eventid') || 
                  node.querySelector && node.querySelector('[data-eventid]') ||
                  node.classList && (node.classList.contains('QZVPzb') || 
                  node.classList.contains('GTG3wb')))) {
                hasEventNodes = true;
              }
            }
          }
        }
        
        // Also check if popup class was added via attribute mutation
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          const target = mutation.target;
          if (target && target.classList && target.classList.contains('hMdQi')) {
            // Check if we haven't already processed this popup
            if (!target.hasAttribute('data-tpi-popup-processed')) {
              console.log('TPI: [DEBUG] POPUP DETECTED via class mutation!', target);
              target.setAttribute('data-tpi-popup-processed', 'true');
              setTimeout(() => {
                console.log('TPI: [DEBUG] Inside setTimeout (class mutation), loading settings...');
                reapplyColorsToProcessedEvents();
                 
                const popup = target;
                loadSettings().then(settings => {
                  console.log('TPI: [DEBUG] Settings loaded (class mutation), injecting icon...', settings);
                  const existingIcons = popup.querySelectorAll('.tpi-popup-umbrella-icon, .tpi-umbrella-icon');
                  console.log('TPI: [DEBUG] Found', existingIcons.length, 'existing icons to check (class mutation)');
                  existingIcons.forEach(icon => {
                    if (!icon.classList.contains('tpi-title-icon') && 
                        !icon.classList.contains('tpi-xnwuge-replacement')) {
                      icon.remove();
                    }
                  });
                  
                  console.log('TPI: [DEBUG] Calling injectIconInXnWugeLocation (class mutation)...');
                  injectIconInXnWugeLocation(popup, settings);
                  
                  // Hide "30 minutes before", "Link Pellow", and notification bell
                  hideReminderAndAttendee(popup);
                  
                  // Remove specific button element
                  removeSpecificButton(popup);
                }).catch(err => {
                  console.error('TPI: [DEBUG] Error loading settings (class mutation):', err);
                });
              }, 100);
            }
          }
        }
      });
      
      // Process events if needed
      if (shouldProcess || hasEventNodes || needsColorReapply) {
        // Debounce for other DOM changes
        clearTimeout(window.tpiProcessTimeout);
        window.tpiProcessTimeout = setTimeout(() => {
          processCalendarEvents();
        }, 200);
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
    console.log('TPI: [DEBUG] init() called - starting observer');
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

