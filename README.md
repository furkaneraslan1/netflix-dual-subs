# Netflix Dual Subtitles

A Chrome extension that displays dual subtitles on Netflix - showing both the original subtitles and a real-time translation.

## Features

- **Real-time translation** of Netflix subtitles
- **Multiple translation services**: Google Translate (free), DeepL (API key), LibreTranslate
- **Customizable appearance**: Font sizes, colors, and positions
- **Position options**: Original on bottom with translated above, or vice versa
- **Translation caching**: Reduces API calls for repeated subtitles
- **16 supported languages**: Turkish, English, Spanish, French, German, and more

## Installation

### From Source (Developer Mode)

1. **Download or clone this repository**

2. **Open Chrome Extensions page**
   - Go to `chrome://extensions/`
   - Or click Menu → More Tools → Extensions

3. **Enable Developer Mode**
   - Toggle the "Developer mode" switch in the top right corner

4. **Load the extension**
   - Click "Load unpacked"
   - Select the `netflix-dual-subs` folder

5. **Done!** 
   - You should see the Netflix Dual Subtitles icon in your toolbar

## Usage

1. **Go to Netflix** and start playing any show or movie

2. **Enable subtitles** in the Netflix player (any language)

3. **Click the extension icon** to configure:
   - Enable/disable dual subtitles
   - Choose your target translation language
   - Select a translation service
   - Customize subtitle appearance

4. **Enjoy!** The translated subtitles will appear alongside the original

## Configuration Options

### Translation Services

| Service | API Key Required | Notes |
|---------|------------------|-------|
| Google Translate | No | Free, may have rate limits |
| DeepL | Yes | Higher quality, requires [free API key](https://www.deepl.com/pro-api) |
| LibreTranslate | No | Free/self-hosted option |

### Subtitle Positions

- **Original: Bottom, Translated: Above** - Default, works best for most content
- **Original: Top, Translated: Below** - For content with lower-third graphics
- **Original: Above, Translated: Bottom** - If you prefer the translation at bottom
- **Stacked (Both Bottom)** - Both subtitles stacked at bottom

### Customization

- **Font Size**: Adjust original and translated subtitle sizes (12-32px)
- **Colors**: Choose colors for both subtitle tracks

## Troubleshooting

### Subtitles not appearing?
1. Make sure Netflix's built-in subtitles are enabled
2. Check that the extension is enabled (toggle in popup)
3. Refresh the Netflix page

### Translation not working?
1. Check your internet connection
2. If using DeepL, verify your API key is correct
3. Try switching to Google Translate

### Subtitles overlapping?
- Try a different position option in the extension settings

## Technical Details

- Uses Netflix's built-in subtitle track as the source
- Monitors DOM changes to detect subtitle updates
- Translations are cached to reduce API calls
- Works with Netflix's SPA navigation

## Privacy

- No data is collected or stored externally
- Translations are processed through the selected translation service
- All settings are stored locally in Chrome's sync storage

## License

MIT License - Feel free to modify and distribute!

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.
