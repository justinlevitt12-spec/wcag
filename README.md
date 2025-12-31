# WCAG 2.2 Accessibility Checker

A professional Chrome extension that audits websites for WCAG 2.2 accessibility compliance.

## Features

### Comprehensive WCAG 2.2 Checks

**Level A (Critical Errors):**
- 1.1.1 Non-text Content - Images missing alt attributes
- 1.3.1 Info and Relationships - Form inputs without labels, tables without headers
- 1.4.1 Use of Color - Links distinguished only by color
- 2.1.1 Keyboard - Interactive elements not keyboard accessible
- 2.4.1 Bypass Blocks - Missing skip links or main landmarks
- 2.4.2 Page Titled - Missing or empty title tags
- 2.4.3 Focus Order - Positive tabindex values
- 2.4.4 Link Purpose - Generic link text
- 2.5.3 Label in Name (WCAG 2.2) - Visible text not in accessible name
- 3.1.1 Language of Page - Missing lang attribute
- 3.3.2 Labels or Instructions - Inputs using placeholder instead of label
- 4.1.1 Parsing - Duplicate ID attributes
- 4.1.2 Name, Role, Value - Iframes without title

**Level AA (Warnings):**
- 1.4.3 Contrast (Minimum) - Color contrast ratio calculation
- 2.4.7 Focus Visible - Elements with outline:none
- 2.4.11 Focus Not Obscured (WCAG 2.2) - Fixed/sticky elements
- 2.5.8 Target Size (WCAG 2.2) - Touch targets smaller than 24×24px

### Advanced Features

- **Element Highlighting System**: Click any "View All" button to see affected elements, then click "Highlight" to visually locate them on the page with animated overlays and arrows
- **Grading System**: A+ to F grades based on accessibility score
- **Export Reports**: Export findings as JSON, CSV, or TXT formats
- **Detailed Recommendations**: Get specific WCAG technique references and fix instructions
- **Modern UI**: Beautiful purple gradient design with smooth animations

## Installation

### From Source

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked"
5. Select the extension directory containing `manifest.json`

## Usage

1. **Navigate to any webpage** you want to audit
2. **Click the extension icon** in your toolbar
3. **Click "Scan This Page"** to start the analysis
4. **Review the results**:
   - View your accessibility grade (A+ to F)
   - See error and warning counts
   - Read WCAG level breakdown
   - Review top recommendations
5. **Explore issues**:
   - Click "View All" to see affected elements
   - Click "Highlight" to visually locate elements on the page
6. **Export reports** in JSON, CSV, or TXT format

## How It Works

### Contrast Calculation

The extension uses the proper WCAG luminance formula:

```
L = 0.2126 * R + 0.7152 * G + 0.0722 * B
Contrast Ratio = (L1 + 0.05) / (L2 + 0.05)
```

Requirements:
- Normal text: 4.5:1 minimum
- Large text (18pt+ or 14pt+ bold): 3:1 minimum

### Scoring Algorithm

- Start at 100%
- Deduct 10 points per error
- Deduct 3 points per warning
- Grade thresholds:
  - A+: 95-100%
  - A: 90-94%
  - B: 80-89%
  - C: 70-79%
  - D: 60-69%
  - F: Below 60%

### Element Highlighting

When you click "Highlight" on an element:
1. The page smoothly scrolls to the element
2. A pulsing colored overlay appears (red for errors, orange for warnings)
3. An animated arrow points to the element
4. The highlight automatically fades after 4 seconds

## File Structure

```
├── manifest.json       # Manifest V3 configuration
├── popup.html         # Extension popup interface
├── popup.js           # Main logic and WCAG checks
├── styles.css         # Modern styling with animations
├── icon16.png         # 16x16 icon
├── icon48.png         # 48x48 icon
└── icon128.png        # 128x128 icon
```

## Browser Compatibility

- Chrome (Manifest V3)
- Edge (Chromium-based)
- Other Chromium-based browsers

## WCAG Resources

- [WCAG 2.2 Guidelines](https://www.w3.org/WAI/WCAG22/quickref/)
- [WCAG 2.2 Techniques](https://www.w3.org/WAI/WCAG22/Techniques/)
- [Web Accessibility Initiative](https://www.w3.org/WAI/)

## Limitations

- Some checks require manual verification (e.g., alt text quality)
- Contrast calculations may not account for all edge cases (gradients, images)
- Does not check dynamic content added after page load
- Limited to visible elements at scan time

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## License

MIT License - Feel free to use and modify for your projects.

## Credits

Created with accessibility in mind. Built to help developers make the web more accessible for everyone.
