# Medium Article Downloader

A Chrome extension that downloads Medium articles as Markdown or PDF files with formatting, images, and metadata preserved.

## Features

- **Download as Markdown**: Save articles as clean, readable Markdown files
- **Download as PDF**: Generate PDF versions for offline reading or printing
- **Preserve Formatting**: Maintains headings, bold, italic, code blocks, and lists
- **Include Images**: All article images are preserved in the download
- **Save Metadata**: Captures article title, author, publish date, and URL
- **Works on All Medium Sites**: Compatible with medium.com and custom Medium publications
- **Clean Interface**: Simple, intuitive popup UI

## Installation

### From Source

1. Clone or download this repository:
   ```bash
   git clone <repository-url>
   cd medium-downloader
   ```

2. Open Chrome and navigate to `chrome://extensions/`

3. Enable **Developer mode** by clicking the toggle in the top right corner

4. Click **Load unpacked**

5. Select the extension directory containing `manifest.json`

6. The Medium Article Downloader icon should now appear in your Chrome toolbar

## Usage

1. **Navigate to a Medium article** you want to download
   - Works on medium.com and custom Medium publications
   - Compatible with both free and paywalled articles (if you have access)

2. **Click the extension icon** in your Chrome toolbar
   - The popup will open showing download options

3. **Choose your download format**:
   - Click **Download as Markdown** for a .md file
   - Click **Download as PDF** to generate and print/save as PDF

4. **Save the file**:
   - For Markdown: Choose save location in the download dialog
   - For PDF: Use the browser's print dialog to save as PDF

## Supported Content

The extension captures and preserves:

- Article title and subtitle
- Author name
- Publication date
- Main article content
- All formatting (headings, bold, italic, etc.)
- Code blocks with syntax highlighting
- Block quotes
- Bulleted and numbered lists
- Inline and block images
- Links

## File Structure

```
├── manifest.json       # Chrome extension configuration (Manifest V3)
├── popup.html         # Extension popup interface
├── popup.js           # Download logic and UI handling
├── content.js         # Article extraction script (runs on Medium pages)
├── styles.css         # Extension styling
├── icon16.png         # 16×16 extension icon
├── icon48.png         # 48×48 extension icon
├── icon128.png        # 128×128 extension icon
└── README.md          # This file
```

## How It Works

### Content Extraction

The extension uses a content script (`content.js`) that:

1. Detects if the current page is a Medium article
2. Extracts article metadata (title, author, date)
3. Parses the article content from the DOM
4. Converts HTML to clean Markdown format
5. Captures all images and their alt text

### Markdown Conversion

The extension converts HTML to Markdown with proper formatting:

- `<h1>` → `# Heading`
- `<h2>` → `## Heading`
- `<strong>` → `**bold**`
- `<em>` → `*italic*`
- `<code>` → `` `code` ``
- `<pre>` → ` ```code block``` `
- `<blockquote>` → `> quote`
- Lists, links, and images are properly formatted

### PDF Generation

For PDF downloads:

1. Creates a formatted HTML document with the article content
2. Opens in a new window with print-optimized CSS
3. Triggers the browser's print dialog
4. User can save as PDF using the print dialog

## Browser Compatibility

- Google Chrome (Manifest V3)
- Microsoft Edge (Chromium-based)
- Brave Browser
- Other Chromium-based browsers supporting Manifest V3

## Permissions

The extension requires the following permissions:

- **activeTab**: To access the current Medium article page
- **scripting**: To inject the content extraction script
- **downloads**: To save Markdown files to your computer
- **host_permissions**: To run on Medium.com and custom Medium domains

## Troubleshooting

### "This page doesn't appear to be a Medium article"

- Make sure you're on an actual Medium article page, not the homepage or profile page
- The extension works on article URLs containing actual content

### Download doesn't start

- Check that your browser allows downloads from extensions
- Ensure pop-ups are not blocked (for PDF downloads)
- Try reloading the Medium article and the extension

### Missing content or formatting

- Some heavily customized Medium publications may have different HTML structures
- Try refreshing the page and attempting the download again
- Report issues with specific articles so we can improve compatibility

## Privacy

This extension:

- Does NOT collect any user data
- Does NOT send article content to external servers
- Runs entirely locally in your browser
- Only accesses pages when you explicitly click the download button

## Contributing

Contributions are welcome! To contribute:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly on different Medium articles
5. Submit a pull request

### Areas for Improvement

- Better handling of Medium's custom embed types
- Support for downloading article series/collections
- Enhanced PDF styling options
- Support for other publishing platforms (Substack, WordPress, etc.)

## Known Limitations

- PDF generation relies on browser print functionality
- Very long articles may take a few seconds to process
- Some dynamic Medium features (hover effects, animations) are not preserved
- Member-only content requires you to be logged in to Medium

## License

MIT License - Feel free to use, modify, and distribute this extension.

## Credits

Created to help readers save and archive Medium articles for offline reading and research.

## Support

If you encounter any issues or have suggestions:

1. Check the Troubleshooting section above
2. Open an issue on the GitHub repository
3. Provide the URL of the article that caused the issue (if applicable)

---

**Enjoy downloading and reading Medium articles offline!**
