# TPI - Google Calendar Color Changer

A Chrome extension that allows you to change the colors of Google Calendar events.

## Features

- **Random Colors**: Automatically assign random colors to calendar events
- **Gradient Colors**: Apply a beautiful gradient color scheme
- **Event Color**: Set a single color for all events
- **Easy Toggle**: Enable/disable color changes with a simple switch
- **Real-time Updates**: Changes apply immediately to your calendar

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in the top right)
3. Click "Load unpacked"
4. Select the `TPI` folder
5. The extension icon should appear in your Chrome toolbar

## Usage

1. Navigate to [Google Calendar](https://calendar.google.com)
2. Click the TPI extension icon in your Chrome toolbar
3. Configure your preferences:
   - Toggle "Enable Color Changes" on/off
   - Choose a color mode (Random, Gradient, or Custom)
   - If using Custom mode, select your preferred color
4. Click "Apply Changes" to update your calendar events

## Color Modes

- **Random Colors**: Each event gets a randomly selected color from a predefined palette
- **Gradient Colors**: Events are colored using a gradient algorithm for a cohesive look
- **Event Color**: All events use the same color you specify

## Files Structure

```
TPI/
├── manifest.json       # Extension configuration
├── content.js         # Main script that modifies calendar colors
├── content.css        # Additional styles
├── popup.html         # Extension popup UI
├── popup.css          # Popup styles
├── popup.js           # Popup functionality
├── icons/             # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md          # This file
```

## Creating Icons

If the icons folder is empty, you can:

1. Create simple colored square icons (16x16, 48x48, 128x128 pixels)
2. Use the icon generator at `icon-generator.html` (if provided)
3. Use any image editor to create PNG files with the required dimensions

The icons should represent the extension's purpose (calendar/color theme).

## Permissions

This extension requires:
- **Storage**: To save your color preferences
- **Active Tab**: To interact with Google Calendar pages
- **Host Permission**: Access to `calendar.google.com`

## Privacy

This extension:
- Only runs on Google Calendar pages
- Stores settings locally in Chrome's sync storage
- Does not collect or transmit any personal data
- Does not access your calendar data beyond visual styling

## Troubleshooting

- **Colors not changing**: Make sure the extension is enabled and you've clicked "Apply Changes"
- **Changes not persisting**: Check that Chrome sync is enabled
- **Extension not loading**: Verify all files are present and manifest.json is valid

## Development

To modify the extension:
1. Make your changes to the relevant files
2. Go to `chrome://extensions/`
3. Click the refresh icon on the TPI extension card
4. Reload the Google Calendar page

## License

This extension is provided as-is for personal use.

