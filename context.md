# Transparent Insurance — Agent Extension - Context Documentation

## Project Overview

**Name:** Transparent Insurance — Agent Extension  
**Type:** Chrome Extension (Manifest V3)  
**Target:** Google Calendar (calendar.google.com)  
**Purpose:** Customize Google Calendar events with Transparent Insurance branding and workflow enhancements

## Core Functionality

### 1. Event Color Customization
- **Random Colors:** Apply random colors to matching events
- **Gradient Colors:** Apply gradient colors based on event index
- **Custom Colors:** Apply a single custom color to all matching events
- **Filter Modes:**
  - All Events: Color all events
  - Filtered Events Only: Color only events matching keywords

### 2. Event Filtering
- **Keyword Matching:** Filter events by title or calendar name
- **Case Sensitivity:** Optional case-sensitive matching
- **Multiple Keywords:** Support for multiple keywords (one per line)

### 3. Event Outline
- **Display Modes:** All events or filtered events only
- **Customizable Thickness:** 0.5px to 4px
- **Custom Color:** User-defined outline color

### 4. Umbrella Icon Integration
- **Event Bar Icons:** Small umbrella icons next to event titles in calendar view
- **Display Modes:** All events or filtered events only
- **Custom SVG Support:** Users can provide custom SVG icons
- **Icon Color:** White or dark (configurable)

### 5. Text Color Customization
- **Custom Text Colors:** Change text color of calendar events
- **Display Modes:** All events or filtered events only

### 6. Element Picker (NEW)
- **Interactive Element Selection:** Click elements in event popup to modify them
- **Actions Available:**
  - **Hide:** Hide elements with CSS
  - **Remove:** Permanently remove elements from DOM
  - **Insert Text:** Replace element text with custom text
- **Persistent Modifications:** Changes persist across popup opens
- **Real-time Application:** Modifications apply immediately when actions change

## Current Architecture

### File Structure
```
TPI/
├── manifest.json          # Extension manifest (Manifest V3)
├── popup.html            # Extension popup UI
├── popup.js              # Popup logic and settings management
├── popup.css             # Popup styling
├── content.js            # Main content script (runs on calendar.google.com)
├── content.css           # Content script styles
├── UMBRELLA.svg          # Default umbrella icon
├── Transparent Insurance.png  # Brand image
└── icons/                # Extension icons (16px, 48px, 128px)
```

### Key Components

#### `manifest.json`
- **Permissions:** `storage`, `activeTab`
- **Host Permissions:** `https://calendar.google.com/*`
- **Content Scripts:** Injected into Google Calendar pages
- **Web Accessible Resources:** UMBRELLA.svg, Transparent Insurance.png

#### `popup.js`
- Settings management (load/save from Chrome storage)
- UI event handlers
- Element picker UI logic
- Communication with content script

#### `content.js`
- **Event Detection:** Finds calendar events using multiple selectors
- **Color Application:** Applies colors to matching events
- **Icon Injection:** Injects umbrella icons into event bars
- **Popup Modification:** Modifies event popup when opened
- **Element Picker:** Handles element selection and modification
- **MutationObserver:** Watches for DOM changes to re-apply modifications

#### `content.css`
- Styles for colored events
- Icon positioning
- **ISSUE:** Currently has aggressive global rules that override Google Calendar's native styles

## Current Issues

### 1. CSS Override Problem (CRITICAL)
**Problem:** The CSS file contains global rules targeting `.hMdQi` (all Google Calendar popups) with `!important` flags, which:
- Overrides Google Calendar's native styling
- Breaks visual consistency
- Causes conflicts with Google's dynamic styling

**Current CSS Rules Affecting All Popups:**
- Text color overrides
- Icon color overrides
- Layout modifications
- Border/outline removals
- Background color changes

**Solution Needed:**
- Scope CSS rules to only popups explicitly marked by the extension
- Add `tpi-popup` class to popups when we modify them
- Change selectors from `.hMdQi` to `.hMdQi.tpi-popup`
- Remove global overrides that aren't necessary

### 2. Umbrella Icon Not Appearing in Popup
**Problem:** The umbrella icon is not showing in the Google event popup menu next to the event title.

**Current Implementation:**
- Icons are injected into event bars (calendar view) successfully
- Popup modification attempts to style `.xnWuge` element with umbrella SVG background
- Icon injection into popup title area is not working

**Solution Needed:**
- Investigate popup title element structure
- Find correct selector for title area
- Inject icon element or apply background image correctly
- Ensure icon persists when popup content updates

### 3. Element Removal Persistence
**Status:** ✅ RESOLVED
- Implemented persistent removal observer
- Elements marked for removal are continuously monitored
- Re-removed if Google Calendar re-adds them

## Technical Details

### Event Detection Strategy
The extension uses multiple selectors to find calendar events:
- `[role="button"][data-eventid]` (primary)
- `.QZVPzb` containers
- Elements containing `.jSrjCf` (color indicators)
- Fallback selectors for different calendar views

### Settings Storage
- Uses `chrome.storage.sync` for persistence
- Settings object includes:
  - `enabled`: Master toggle
  - `filterMode`: 'all' or 'filtered'
  - `filterKeywords`: Newline-separated keywords
  - `colorMode`: 'random', 'gradient', or 'custom'
  - `outlineEnabled`, `outlineThickness`, `outlineColor`
  - `iconEnabled`, `iconWhite`, `customIconSvg`
  - `textColorEnabled`, `textColor`
  - `elementPickerEnabled`, `selectedElements`

### MutationObserver Usage
- **Main Observer:** Watches for new events and popup opens
- **Color Reapplication:** Re-applies colors if Google Calendar resets them
- **Popup Modification Observer:** Watches popup content changes
- **Element Removal Observer:** Continuously removes elements marked for removal

### Element Picker Implementation
1. **Activation:** User enables picker in popup, clicks "Start Picking"
2. **Selection Mode:** Hover highlights elements, click selects them
3. **Selector Generation:** Creates CSS selector for selected element
4. **Action Selection:** User chooses hide/remove/insertText
5. **Application:** Modifications applied immediately and persistently

## Google Calendar DOM Structure

### Event Popup Structure
- **Main Container:** `.hMdQi` (popup root)
- **Title Element:** `.UfeRlc` or `#rAECCd`
- **Date/Time:** `.AzuXid`
- **Color Indicator:** `.xnWuge` (inside `.zZj8Pb.EaVNbc`)
- **Description:** `span[jscontroller="BlntMb"]`
- **Notes Section:** `#xDetDlgAtm`
- **Attendees:** `.Fh4HL` divs

### Event Bar Structure
- **Main Container:** `[role="button"][data-eventid]`
- **Color Indicator:** `.QZVPzb > .jSrjCf`
- **Title:** `.I0UMhf` or `.KcY3wb`

## Development Notes

### Best Practices Applied
- ✅ Persistent removal system for elements
- ✅ Debounced mutation observers
- ✅ Multiple selector fallbacks
- ✅ Error handling and logging
- ✅ Settings persistence

### Areas for Improvement
- ⚠️ CSS scoping (reduce global overrides)
- ⚠️ Icon injection in popup title
- ⚠️ Reduce CSS specificity conflicts
- ⚠️ Better selector generation for element picker

## Next Steps

1. **Fix CSS Scoping:**
   - Apply patch to scope CSS rules to `.hMdQi.tpi-popup`
   - Add `tpi-popup` class in JavaScript when modifying popups
   - Remove global `.hMdQi` rules

2. **Fix Popup Icon:**
   - Investigate popup title element structure
   - Implement icon injection or background image
   - Test persistence across popup updates

3. **Testing:**
   - Verify all features work with scoped CSS
   - Test icon appearance in popup
   - Ensure no visual regressions

## Repository
- **GitHub:** https://github.com/linkpellow/Transparent-Extension
- **Status:** Active development

