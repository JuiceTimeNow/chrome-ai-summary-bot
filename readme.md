# AI Article Summarizer Chrome Extension

A Chrome extension that uses AI to summarize articles on web pages.

## Features

- Summarize articles using OpenAI or Anthropic AI models
- Configurable summary length (short, medium, long)
- Multiple summary styles (bullet points, paragraph, key points)
- Right-click context menu for selected text
- Secure API key storage

## Installation

1. **Download the files**: Save all the provided files in a single folder:
   - `manifest.json`
   - `popup.html`
   - `popup.js`
   - `content.js`
   - `background.js`

2. **Add icons** (optional): Create or download icon files:
   - `icon16.png` (16x16 pixels)
   - `icon48.png` (48x48 pixels)  
   - `icon128.png` (128x128 pixels)

3. **Load the extension**:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the folder containing your extension files

## Setup

1. **Get an API key**:
   - For OpenAI: Visit https://platform.openai.com/api-keys
   - For Anthropic: Visit https://console.anthropic.com/

2. **Configure the extension**:
   - Click the extension icon in your browser toolbar
   - Select your AI provider (OpenAI or Anthropic)
   - Enter your API key
   - Choose your preferred summary settings
   - Click "Save Configuration"

## Usage

### Method 1: Extension Popup
1. Navigate to any article page
2. Click the extension icon
3. Click "Summarize This Article"
4. View the generated summary

### Method 2: Context Menu
1. Select text on any webpage
2. Right-click and select "Summarize selected text"
3. Click the extension icon to view the summary

## Customization

You can modify the extension by editing:

- **Article detection**: Update the selectors in `content.js` to better detect articles on specific websites
- **Summary prompts**: Modify the prompts in `background.js` to change how summaries are generated
- **UI styling**: Update the CSS in `popup.html` to change the appearance
- **API providers**: Add support for other AI APIs by modifying `background.js`

## Troubleshooting

- **"No article content found"**: The extension couldn't detect article content on the page. Try selecting text manually and using the context menu.
- **API errors**: Check that your API key is valid and you have sufficient credits/quota.
- **Extension not loading**: Make sure all files are in the same folder and the manifest.json is valid.

## Privacy & Security

- API keys are stored locally in Chrome's sync storage
- Article content is sent to your chosen AI provider for summarization
- No data is stored or transmitted elsewhere
- The extension only runs when you explicitly trigger it

## API Costs

Both OpenAI and Anthropic charge per API usage:
- OpenAI GPT-3.5-turbo: ~$0.002 per 1K tokens
- Anthropic Claude: ~$0.003 per 1K tokens

A typical article summary costs less than $0.01.

## Development

This extension uses Manifest V3 and modern Chrome extension APIs:
- `chrome.storage` for configuration
- `chrome.scripting` for content extraction
- `chrome.runtime` for background processing
- `chrome.contextMenus` for right-click functionality