// WCAG 2.2 Accessibility Checker - Main Logic

// Store current results
let currentResults = null;

// DOM Elements
const initialView = document.getElementById('initial-view');
const loadingView = document.getElementById('loading-view');
const errorView = document.getElementById('error-view');
const resultsView = document.getElementById('results-view');
const scanBtn = document.getElementById('scan-btn');
const retryBtn = document.getElementById('retry-btn');
const scanAgainBtn = document.getElementById('scan-again-btn');
const modalOverlay = document.getElementById('modal-overlay');
const modalClose = document.getElementById('modal-close');

// Event Listeners
scanBtn.addEventListener('click', runScan);
retryBtn.addEventListener('click', runScan);
scanAgainBtn.addEventListener('click', () => {
  showView('initial');
});

// Close modal
modalClose.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) {
    closeModal();
  }
});

// Export buttons
document.getElementById('export-json').addEventListener('click', () => exportReport('json'));
document.getElementById('export-csv').addEventListener('click', () => exportReport('csv'));
document.getElementById('export-txt').addEventListener('click', () => exportReport('txt'));

/**
 * Main scan function
 */
async function runScan() {
  showView('loading');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Inject the analysis script into the page
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: analyzeAccessibility,
    });

    if (results && results[0] && results[0].result) {
      currentResults = results[0].result;
      displayResults(currentResults);
      showView('results');
    } else {
      throw new Error('No results returned from analysis');
    }
  } catch (error) {
    console.error('Scan error:', error);
    document.getElementById('error-message').textContent =
      'An error occurred while scanning the page. Make sure you have permission to access this page.';
    showView('error');
  }
}

/**
 * Show/hide views
 */
function showView(view) {
  initialView.style.display = 'none';
  loadingView.style.display = 'none';
  errorView.style.display = 'none';
  resultsView.style.display = 'none';

  switch(view) {
    case 'initial':
      initialView.style.display = 'block';
      break;
    case 'loading':
      loadingView.style.display = 'block';
      break;
    case 'error':
      errorView.style.display = 'block';
      break;
    case 'results':
      resultsView.style.display = 'block';
      break;
  }
}

/**
 * Main accessibility analysis function (injected into page)
 * This function runs in the context of the target page
 */
function analyzeAccessibility() {
  const issues = [];

  // Initialize element storage for highlighting
  window.__a11yElements = {};
  let elementIdCounter = 0;

  /**
   * Helper function to store element reference and add data attribute
   */
  function storeElement(element) {
    const id = `a11y-${elementIdCounter++}`;
    window.__a11yElements[id] = element;
    element.setAttribute('data-a11y-id', id);
    return id;
  }

  /**
   * Helper function to calculate color luminance
   */
  function getLuminance(r, g, b) {
    const [rs, gs, bs] = [r, g, b].map(c => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  }

  /**
   * Helper function to calculate contrast ratio
   */
  function getContrastRatio(l1, l2) {
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  /**
   * Helper function to parse RGB color
   */
  function parseColor(colorStr) {
    if (!colorStr || colorStr === 'transparent' || colorStr === 'rgba(0, 0, 0, 0)') {
      return null;
    }

    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = colorStr;
    ctx.fillRect(0, 0, 1, 1);
    const imageData = ctx.getImageData(0, 0, 1, 1).data;

    return {
      r: imageData[0],
      g: imageData[1],
      b: imageData[2],
      a: imageData[3] / 255
    };
  }

  /**
   * Get effective background color (checking parent elements if transparent)
   */
  function getEffectiveBackgroundColor(element) {
    let current = element;
    let depth = 0;
    const maxDepth = 10;

    while (current && depth < maxDepth) {
      const bgColor = window.getComputedStyle(current).backgroundColor;
      const parsed = parseColor(bgColor);

      if (parsed && parsed.a > 0.5) {
        return parsed;
      }

      current = current.parentElement;
      depth++;
    }

    // Default to white background
    return { r: 255, g: 255, b: 255, a: 1 };
  }

  // ========================================
  // LEVEL A CHECKS (Critical Errors)
  // ========================================

  // 1.1.1 Non-text Content - Images missing alt attributes
  const imagesWithoutAlt = Array.from(document.querySelectorAll('img')).filter(img => {
    return !img.hasAttribute('alt');
  }).slice(0, 20);

  if (imagesWithoutAlt.length > 0) {
    issues.push({
      id: '1.1.1',
      title: '1.1.1 Non-text Content',
      description: `Found ${imagesWithoutAlt.length} image(s) without alt attributes. All images must have alt text to describe their content for screen reader users.`,
      type: 'error',
      level: 'A',
      wcagLevel: 'A',
      count: imagesWithoutAlt.length,
      fix: 'Add descriptive alt attributes to all images. Use alt="" for decorative images, or provide meaningful descriptions for informative images.',
      techniques: 'H37, G94, G95',
      elements: imagesWithoutAlt.map(img => ({
        id: storeElement(img),
        tag: 'img',
        className: img.className,
        issue: 'Missing alt attribute',
        preview: img.src.substring(0, 50)
      }))
    });
  }

  // 1.3.1 Info and Relationships - Form inputs without labels
  const inputsWithoutLabels = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea')).filter(input => {
    const id = input.id;
    const hasLabel = id && document.querySelector(`label[for="${id}"]`);
    const hasAriaLabel = input.hasAttribute('aria-label') || input.hasAttribute('aria-labelledby');
    const hasTitle = input.hasAttribute('title');

    return !hasLabel && !hasAriaLabel && !hasTitle;
  }).slice(0, 20);

  if (inputsWithoutLabels.length > 0) {
    issues.push({
      id: '1.3.1a',
      title: '1.3.1 Info and Relationships (Form Labels)',
      description: `Found ${inputsWithoutLabels.length} form input(s) without proper labels. All form fields must have associated labels for screen reader users.`,
      type: 'error',
      level: 'A',
      wcagLevel: 'A',
      count: inputsWithoutLabels.length,
      fix: 'Associate each form input with a <label> element using the "for" attribute, or add aria-label/aria-labelledby attributes.',
      techniques: 'H44, H65, G167',
      elements: inputsWithoutLabels.map(input => ({
        id: storeElement(input),
        tag: input.tagName.toLowerCase(),
        className: input.className,
        issue: 'Missing label association',
        preview: input.placeholder || input.name || ''
      }))
    });
  }

  // 1.3.1 Tables without proper headers
  const tablesWithoutHeaders = Array.from(document.querySelectorAll('table')).filter(table => {
    return !table.querySelector('th');
  }).slice(0, 15);

  if (tablesWithoutHeaders.length > 0) {
    issues.push({
      id: '1.3.1b',
      title: '1.3.1 Info and Relationships (Table Headers)',
      description: `Found ${tablesWithoutHeaders.length} table(s) without header cells (<th>). Data tables must use proper header cells for accessibility.`,
      type: 'error',
      level: 'A',
      wcagLevel: 'A',
      count: tablesWithoutHeaders.length,
      fix: 'Use <th> elements for table headers with appropriate scope attributes (row/col).',
      techniques: 'H51, H63',
      elements: tablesWithoutHeaders.map(table => ({
        id: storeElement(table),
        tag: 'table',
        className: table.className,
        issue: 'Missing <th> header cells',
        preview: 'Data table without headers'
      }))
    });
  }

  // 1.4.1 Use of Color - Links distinguished only by color
  const linksByColorOnly = Array.from(document.querySelectorAll('a')).filter(link => {
    if (!link.textContent.trim()) return false;

    const style = window.getComputedStyle(link);
    const parentStyle = link.parentElement ? window.getComputedStyle(link.parentElement) : null;

    if (!parentStyle) return false;

    const hasUnderline = style.textDecoration.includes('underline') ||
                        style.borderBottom !== 'none';
    const isBold = parseInt(style.fontWeight) >= 700;
    const colorDifferent = style.color !== parentStyle.color;

    return colorDifferent && !hasUnderline && !isBold;
  }).slice(0, 15);

  if (linksByColorOnly.length > 0) {
    issues.push({
      id: '1.4.1',
      title: '1.4.1 Use of Color',
      description: `Found ${linksByColorOnly.length} link(s) distinguished only by color. Links must have additional visual indicators like underlines.`,
      type: 'error',
      level: 'A',
      wcagLevel: 'A',
      count: linksByColorOnly.length,
      fix: 'Add underlines, bold text, or other non-color visual indicators to distinguish links from surrounding text.',
      techniques: 'G183, G182',
      elements: linksByColorOnly.map(link => ({
        id: storeElement(link),
        tag: 'a',
        className: link.className,
        issue: 'Link distinguished only by color',
        preview: link.textContent.trim().substring(0, 50)
      }))
    });
  }

  // 2.1.1 Keyboard - Interactive elements not keyboard accessible
  const nonKeyboardElements = Array.from(document.querySelectorAll('div[onclick], span[onclick]')).filter(el => {
    return !el.hasAttribute('tabindex') && !el.hasAttribute('role');
  }).slice(0, 15);

  if (nonKeyboardElements.length > 0) {
    issues.push({
      id: '2.1.1',
      title: '2.1.1 Keyboard Accessibility',
      description: `Found ${nonKeyboardElements.length} interactive element(s) (div/span with onclick) that are not keyboard accessible.`,
      type: 'error',
      level: 'A',
      wcagLevel: 'A',
      count: nonKeyboardElements.length,
      fix: 'Add tabindex="0" and proper ARIA roles (button, link, etc.) to make elements keyboard accessible. Also add keyboard event handlers.',
      techniques: 'G202, SCR35',
      elements: nonKeyboardElements.map(el => ({
        id: storeElement(el),
        tag: el.tagName.toLowerCase(),
        className: el.className,
        issue: 'Not keyboard accessible',
        preview: el.textContent.trim().substring(0, 50)
      }))
    });
  }

  // 2.4.1 Bypass Blocks - Missing skip links or main landmark
  const hasSkipLink = document.querySelector('a[href^="#"][href*="content"], a[href^="#"][href*="main"]');
  const hasMainLandmark = document.querySelector('main, [role="main"]');

  if (!hasSkipLink && !hasMainLandmark) {
    issues.push({
      id: '2.4.1',
      title: '2.4.1 Bypass Blocks',
      description: 'Page is missing skip navigation links or <main> landmark. Users need a way to bypass repetitive content.',
      type: 'error',
      level: 'A',
      wcagLevel: 'A',
      count: 1,
      fix: 'Add a skip link at the top of the page (e.g., <a href="#main">Skip to main content</a>) and/or use a <main> element to wrap the main content.',
      techniques: 'G1, G123, G124',
      elements: []
    });
  }

  // 2.4.2 Page Titled - Missing or empty title
  const pageTitle = document.querySelector('title');
  if (!pageTitle || !pageTitle.textContent.trim()) {
    issues.push({
      id: '2.4.2',
      title: '2.4.2 Page Titled',
      description: 'Page is missing a title or has an empty <title> tag. Every page must have a descriptive title.',
      type: 'error',
      level: 'A',
      wcagLevel: 'A',
      count: 1,
      fix: 'Add a descriptive <title> element in the <head> section that describes the page content or purpose.',
      techniques: 'G88, H25',
      elements: []
    });
  }

  // 2.4.3 Focus Order - Positive tabindex values
  const positiveTabindex = Array.from(document.querySelectorAll('[tabindex]')).filter(el => {
    const tabindex = parseInt(el.getAttribute('tabindex'));
    return tabindex > 0;
  }).slice(0, 15);

  if (positiveTabindex.length > 0) {
    issues.push({
      id: '2.4.3',
      title: '2.4.3 Focus Order',
      description: `Found ${positiveTabindex.length} element(s) with positive tabindex values. This disrupts natural tab order and should be avoided.`,
      type: 'error',
      level: 'A',
      wcagLevel: 'A',
      count: positiveTabindex.length,
      fix: 'Use tabindex="0" for elements that should be in the natural tab order, or tabindex="-1" for elements that should only be focusable programmatically. Avoid positive values.',
      techniques: 'G59, H4',
      elements: positiveTabindex.map(el => ({
        id: storeElement(el),
        tag: el.tagName.toLowerCase(),
        className: el.className,
        issue: `Positive tabindex="${el.getAttribute('tabindex')}"`,
        preview: el.textContent.trim().substring(0, 50)
      }))
    });
  }

  // 2.4.4 Link Purpose - Generic link text
  const genericLinks = Array.from(document.querySelectorAll('a')).filter(link => {
    const text = link.textContent.trim().toLowerCase();
    const genericTexts = ['click here', 'read more', 'more', 'link', 'here', 'this'];
    return genericTexts.includes(text) || !text;
  }).slice(0, 15);

  if (genericLinks.length > 0) {
    issues.push({
      id: '2.4.4',
      title: '2.4.4 Link Purpose',
      description: `Found ${genericLinks.length} link(s) with generic or empty text. Link text should be descriptive and indicate the link's purpose.`,
      type: 'error',
      level: 'A',
      wcagLevel: 'A',
      count: genericLinks.length,
      fix: 'Use descriptive link text that makes sense out of context. Instead of "click here", use "read our privacy policy" or similar descriptive text.',
      techniques: 'G91, H30, H24',
      elements: genericLinks.map(link => ({
        id: storeElement(link),
        tag: 'a',
        className: link.className,
        issue: 'Generic or empty link text',
        preview: link.textContent.trim() || link.href.substring(0, 50)
      }))
    });
  }

  // 2.5.3 Label in Name (WCAG 2.2) - Visible text not in accessible name
  const labelInNameIssues = Array.from(document.querySelectorAll('button, a, input[type="button"], input[type="submit"]')).filter(el => {
    const visibleText = el.textContent.trim().toLowerCase();
    const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();

    if (visibleText && ariaLabel && !ariaLabel.includes(visibleText)) {
      return true;
    }
    return false;
  }).slice(0, 15);

  if (labelInNameIssues.length > 0) {
    issues.push({
      id: '2.5.3',
      title: '2.5.3 Label in Name (WCAG 2.2)',
      description: `Found ${labelInNameIssues.length} element(s) where visible text is not included in the accessible name (aria-label).`,
      type: 'error',
      level: 'A',
      wcagLevel: 'A',
      count: labelInNameIssues.length,
      fix: 'Ensure that aria-label includes the visible text of the element. The accessible name should start with or contain the visible label.',
      techniques: 'G208, G211',
      elements: labelInNameIssues.map(el => ({
        id: storeElement(el),
        tag: el.tagName.toLowerCase(),
        className: el.className,
        issue: 'Visible text not in aria-label',
        preview: `Text: "${el.textContent.trim().substring(0, 30)}" / Label: "${el.getAttribute('aria-label')?.substring(0, 30)}"`
      }))
    });
  }

  // 3.1.1 Language of Page - Missing lang attribute
  const htmlElement = document.documentElement;
  if (!htmlElement.hasAttribute('lang')) {
    issues.push({
      id: '3.1.1',
      title: '3.1.1 Language of Page',
      description: 'The <html> element is missing the lang attribute. This helps screen readers pronounce content correctly.',
      type: 'error',
      level: 'A',
      wcagLevel: 'A',
      count: 1,
      fix: 'Add a lang attribute to the <html> element with the appropriate language code (e.g., lang="en" for English).',
      techniques: 'H57',
      elements: []
    });
  }

  // 3.2.6 Consistent Help (WCAG 2.2) - Basic check for help/support links
  const helpLinks = Array.from(document.querySelectorAll('a')).filter(link => {
    const text = link.textContent.toLowerCase();
    return text.includes('help') || text.includes('support') || text.includes('contact');
  });

  // Just informational - we can't really validate consistency without multiple pages

  // 3.3.2 Labels or Instructions - Inputs using placeholder instead of label
  const placeholderOnlyInputs = Array.from(document.querySelectorAll('input[placeholder], textarea[placeholder]')).filter(input => {
    const id = input.id;
    const hasLabel = id && document.querySelector(`label[for="${id}"]`);
    const hasAriaLabel = input.hasAttribute('aria-label') || input.hasAttribute('aria-labelledby');
    const hasPlaceholder = input.hasAttribute('placeholder');

    return hasPlaceholder && !hasLabel && !hasAriaLabel;
  }).slice(0, 15);

  if (placeholderOnlyInputs.length > 0) {
    issues.push({
      id: '3.3.2',
      title: '3.3.2 Labels or Instructions',
      description: `Found ${placeholderOnlyInputs.length} input(s) using placeholder as the only label. Placeholders disappear when typing and are not accessible to all users.`,
      type: 'error',
      level: 'A',
      wcagLevel: 'A',
      count: placeholderOnlyInputs.length,
      fix: 'Use proper <label> elements or aria-label in addition to placeholders. Placeholders should provide hints, not replace labels.',
      techniques: 'G131, G89, G184',
      elements: placeholderOnlyInputs.map(input => ({
        id: storeElement(input),
        tag: input.tagName.toLowerCase(),
        className: input.className,
        issue: 'Using placeholder instead of label',
        preview: input.placeholder || ''
      }))
    });
  }

  // 4.1.1 Parsing - Duplicate ID attributes
  const allIds = Array.from(document.querySelectorAll('[id]')).map(el => el.id);
  const duplicateIds = allIds.filter((id, index) => allIds.indexOf(id) !== index);
  const uniqueDuplicateIds = [...new Set(duplicateIds)];

  if (uniqueDuplicateIds.length > 0) {
    const duplicateElements = uniqueDuplicateIds.flatMap(id =>
      Array.from(document.querySelectorAll(`[id="${id}"]`))
    ).slice(0, 15);

    issues.push({
      id: '4.1.1',
      title: '4.1.1 Parsing',
      description: `Found ${uniqueDuplicateIds.length} duplicate ID attribute(s). IDs must be unique within a page.`,
      type: 'error',
      level: 'A',
      wcagLevel: 'A',
      count: duplicateElements.length,
      fix: 'Ensure all ID attributes are unique. Use classes for styling multiple elements with the same styles.',
      techniques: 'H93, H94',
      elements: duplicateElements.map(el => ({
        id: storeElement(el),
        tag: el.tagName.toLowerCase(),
        className: el.className,
        issue: `Duplicate ID: "${el.id}"`,
        preview: el.textContent.trim().substring(0, 50)
      }))
    });
  }

  // 4.1.2 Name, Role, Value - Iframes without title
  const iframesWithoutTitle = Array.from(document.querySelectorAll('iframe')).filter(iframe => {
    return !iframe.hasAttribute('title') || !iframe.title.trim();
  });

  if (iframesWithoutTitle.length > 0) {
    issues.push({
      id: '4.1.2',
      title: '4.1.2 Name, Role, Value',
      description: `Found ${iframesWithoutTitle.length} iframe(s) without title attributes. Iframes must have descriptive titles.`,
      type: 'error',
      level: 'A',
      wcagLevel: 'A',
      count: iframesWithoutTitle.length,
      fix: 'Add a title attribute to each iframe that describes its content or purpose.',
      techniques: 'H64',
      elements: iframesWithoutTitle.map(iframe => ({
        id: storeElement(iframe),
        tag: 'iframe',
        className: iframe.className,
        issue: 'Missing title attribute',
        preview: iframe.src.substring(0, 50)
      }))
    });
  }

  // ========================================
  // LEVEL AA CHECKS (Warnings)
  // ========================================

  // 1.4.3 Contrast (Minimum) - Color contrast ratio
  const textElements = Array.from(document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, a, button, span, div, li, td, th, label')).filter(el => {
    const text = el.textContent.trim();
    return text && text.length > 0 && window.getComputedStyle(el).display !== 'none';
  }).slice(0, 50); // Limit to 50 for performance

  const contrastIssues = [];

  textElements.forEach(el => {
    const style = window.getComputedStyle(el);
    const foreground = parseColor(style.color);
    const background = getEffectiveBackgroundColor(el);

    if (!foreground || !background) return;

    const fgLuminance = getLuminance(foreground.r, foreground.g, foreground.b);
    const bgLuminance = getLuminance(background.r, background.g, background.b);
    const ratio = getContrastRatio(fgLuminance, bgLuminance);

    const fontSize = parseFloat(style.fontSize);
    const fontWeight = parseInt(style.fontWeight);
    const isLargeText = fontSize >= 18 || (fontSize >= 14 && fontWeight >= 700);

    const requiredRatio = isLargeText ? 3 : 4.5;

    if (ratio < requiredRatio) {
      contrastIssues.push({
        element: el,
        ratio: ratio.toFixed(2),
        required: requiredRatio,
        isLargeText: isLargeText
      });
    }
  });

  if (contrastIssues.length > 0) {
    const limitedIssues = contrastIssues.slice(0, 20);
    issues.push({
      id: '1.4.3',
      title: '1.4.3 Contrast (Minimum)',
      description: `Found ${contrastIssues.length} element(s) with insufficient color contrast. Contrast ratio must be at least 4.5:1 for normal text and 3:1 for large text.`,
      type: 'warning',
      level: 'AA',
      wcagLevel: 'AA',
      count: contrastIssues.length,
      fix: 'Increase the contrast between text and background colors. Use darker text on light backgrounds or lighter text on dark backgrounds.',
      techniques: 'G18, G145, G174',
      elements: limitedIssues.map(item => ({
        id: storeElement(item.element),
        tag: item.element.tagName.toLowerCase(),
        className: item.element.className,
        issue: `Contrast ratio ${item.ratio}:1 (requires ${item.required}:1)`,
        preview: item.element.textContent.trim().substring(0, 50)
      }))
    });
  }

  // 2.4.7 Focus Visible - Elements with outline:none
  const outlineNoneElements = Array.from(document.querySelectorAll('a, button, input, select, textarea, [tabindex]')).filter(el => {
    const style = window.getComputedStyle(el);
    const hasOutlineNone = style.outline === 'none' || style.outlineWidth === '0px';

    // Check if there's alternative focus styling
    const hasBorderFocus = style.borderColor && style.borderWidth !== '0px';
    const hasBoxShadow = style.boxShadow && style.boxShadow !== 'none';
    const hasBackgroundColor = style.backgroundColor && style.backgroundColor !== 'transparent';

    return hasOutlineNone && !hasBorderFocus && !hasBoxShadow;
  }).slice(0, 15);

  if (outlineNoneElements.length > 0) {
    issues.push({
      id: '2.4.7',
      title: '2.4.7 Focus Visible',
      description: `Found ${outlineNoneElements.length} element(s) with outline:none and no alternative focus indicator. Keyboard users need visible focus indicators.`,
      type: 'warning',
      level: 'AA',
      wcagLevel: 'AA',
      count: outlineNoneElements.length,
      fix: 'Provide visible focus indicators. If removing outline, add alternative focus styles like border, box-shadow, or background-color changes.',
      techniques: 'G149, G165, G195',
      elements: outlineNoneElements.map(el => ({
        id: storeElement(el),
        tag: el.tagName.toLowerCase(),
        className: el.className,
        issue: 'outline:none without alternative focus style',
        preview: el.textContent.trim().substring(0, 50) || el.tagName
      }))
    });
  }

  // 2.4.11 Focus Not Obscured (WCAG 2.2) - Fixed/sticky elements
  const fixedElements = Array.from(document.querySelectorAll('*')).filter(el => {
    const style = window.getComputedStyle(el);
    return style.position === 'fixed' || style.position === 'sticky';
  }).slice(0, 15);

  if (fixedElements.length > 0) {
    issues.push({
      id: '2.4.11',
      title: '2.4.11 Focus Not Obscured (WCAG 2.2)',
      description: `Found ${fixedElements.length} fixed or sticky element(s). Ensure these don't obscure focused elements for keyboard users.`,
      type: 'warning',
      level: 'AA',
      wcagLevel: 'AA',
      count: fixedElements.length,
      fix: 'Ensure fixed/sticky elements (headers, footers, navigation) don\'t cover focused interactive elements. Use proper z-index management and scroll padding.',
      techniques: 'C43',
      elements: fixedElements.map(el => ({
        id: storeElement(el),
        tag: el.tagName.toLowerCase(),
        className: el.className,
        issue: `position: ${window.getComputedStyle(el).position}`,
        preview: el.textContent.trim().substring(0, 50) || 'Fixed/sticky element'
      }))
    });
  }

  // 2.5.8 Target Size (WCAG 2.2) - Touch targets smaller than 24x24px
  const interactiveElements = Array.from(document.querySelectorAll('button, a, input:not([type="hidden"]), select, textarea, [onclick], [tabindex]'));
  const smallTargets = interactiveElements.filter(el => {
    const rect = el.getBoundingClientRect();
    return (rect.width > 0 && rect.width < 24) || (rect.height > 0 && rect.height < 24);
  }).slice(0, 20);

  if (smallTargets.length > 0) {
    issues.push({
      id: '2.5.8',
      title: '2.5.8 Target Size (WCAG 2.2)',
      description: `Found ${smallTargets.length} interactive element(s) smaller than 24×24px. Minimum size is 24×24px, but 44×44px is recommended.`,
      type: 'warning',
      level: 'AA',
      wcagLevel: 'AA',
      count: smallTargets.length,
      fix: 'Increase the size of touch targets to at least 24×24 CSS pixels. Aim for 44×44px for better usability. Use padding to increase clickable area.',
      techniques: 'C42',
      elements: smallTargets.map(el => {
        const rect = el.getBoundingClientRect();
        return {
          id: storeElement(el),
          tag: el.tagName.toLowerCase(),
          className: el.className,
          issue: `Size: ${Math.round(rect.width)}×${Math.round(rect.height)}px`,
          preview: el.textContent.trim().substring(0, 50) || el.tagName
        };
      })
    });
  }

  // Calculate scores and return results
  const errors = issues.filter(i => i.type === 'error');
  const warnings = issues.filter(i => i.type === 'warning');

  let score = 100;
  score -= errors.length * 10;
  score -= warnings.length * 3;
  score = Math.max(0, score);

  let grade;
  if (score >= 95) grade = 'A+';
  else if (score >= 90) grade = 'A';
  else if (score >= 80) grade = 'B';
  else if (score >= 70) grade = 'C';
  else if (score >= 60) grade = 'D';
  else grade = 'F';

  const levelCounts = {
    A: issues.filter(i => i.wcagLevel === 'A').length,
    AA: issues.filter(i => i.wcagLevel === 'AA').length,
    AAA: 0
  };

  return {
    score,
    grade,
    errors: errors.length,
    warnings: warnings.length,
    total: issues.length,
    levelCounts,
    issues
  };
}

/**
 * Display results in the UI
 */
function displayResults(results) {
  // Update grade
  const gradeCircle = document.getElementById('grade-circle');
  const gradeLetter = document.getElementById('grade-letter');
  gradeLetter.textContent = results.grade;

  // Set grade color
  gradeCircle.className = 'grade-circle';
  if (results.grade === 'A+' || results.grade === 'A') {
    gradeCircle.classList.add('grade-a-plus');
  } else if (results.grade === 'B') {
    gradeCircle.classList.add('grade-b');
  } else if (results.grade === 'C') {
    gradeCircle.classList.add('grade-c');
  } else if (results.grade === 'D') {
    gradeCircle.classList.add('grade-d');
  } else {
    gradeCircle.classList.add('grade-f');
  }

  // Update stats
  document.getElementById('errors-count').textContent = results.errors;
  document.getElementById('warnings-count').textContent = results.warnings;
  document.getElementById('total-count').textContent = results.total;

  // Update level breakdown
  document.getElementById('level-a-count').textContent = results.levelCounts.A;
  document.getElementById('level-aa-count').textContent = results.levelCounts.AA;
  document.getElementById('level-aaa-count').textContent = results.levelCounts.AAA;

  // Display recommendations
  displayRecommendations(results);

  // Display issues
  displayIssues(results);
}

/**
 * Display top recommendations
 */
function displayRecommendations(results) {
  const recommendationsSection = document.getElementById('recommendations-section');
  const recommendationsList = document.getElementById('recommendations-list');

  // Get top 3 issues by count
  const topIssues = [...results.issues]
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  if (topIssues.length === 0) {
    recommendationsSection.style.display = 'none';
    return;
  }

  recommendationsSection.style.display = 'block';
  recommendationsList.innerHTML = topIssues.map(issue => {
    const emoji = issue.type === 'error' ? '🔴' : '🟠';
    return `<div class="recommendation-item">${emoji} ${issue.title}: ${issue.fix}</div>`;
  }).join('');
}

/**
 * Display all issues
 */
function displayIssues(results) {
  const issuesList = document.getElementById('issues-list');
  const noIssues = document.getElementById('no-issues');

  if (results.issues.length === 0) {
    issuesList.innerHTML = '';
    noIssues.style.display = 'block';
    return;
  }

  noIssues.style.display = 'none';
  issuesList.innerHTML = results.issues.map(issue => {
    const hasElements = issue.elements && issue.elements.length > 0;

    return `
      <div class="issue-card ${issue.type}">
        <div class="issue-header">
          <div class="issue-title">${issue.title}</div>
          <span class="issue-badge ${issue.type}">${issue.type}</span>
        </div>
        <div class="issue-description">${issue.description}</div>

        <div class="fix-section">
          <h4>How to Fix</h4>
          <p>${issue.fix}</p>
        </div>

        <div class="technique-refs">
          <strong>WCAG Techniques:</strong> ${issue.techniques}
        </div>

        <div class="issue-footer">
          <div class="element-count">${issue.count} affected element${issue.count !== 1 ? 's' : ''}</div>
          ${hasElements ? `<button class="view-elements-btn" data-issue-id="${issue.id}">👁️ View All (${issue.elements.length})</button>` : ''}
        </div>
      </div>
    `;
  }).join('');

  // Add event listeners for "View All" buttons
  document.querySelectorAll('.view-elements-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const issueId = e.target.getAttribute('data-issue-id');
      const issue = results.issues.find(i => i.id === issueId);
      if (issue) {
        showElementsModal(issue);
      }
    });
  });
}

/**
 * Show modal with element details
 */
function showElementsModal(issue) {
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');

  modalTitle.textContent = `${issue.title} - Affected Elements`;

  modalBody.innerHTML = issue.elements.map((el, index) => `
    <div class="element-item">
      <div class="element-header">
        <div class="element-number">${index + 1}</div>
        <div class="element-tag">&lt;${el.tag}${el.className ? '.' + el.className.split(' ')[0] : ''}&gt;</div>
      </div>
      <div class="element-issue">${el.issue}</div>
      ${el.preview ? `<div class="element-preview">"${el.preview}"</div>` : ''}
      <button class="highlight-btn" data-element-id="${el.id}">🔍 Highlight</button>
    </div>
  `).join('');

  // Add event listeners for highlight buttons
  document.querySelectorAll('.highlight-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const elementId = e.target.getAttribute('data-element-id');
      await highlightElement(elementId, e.target);
    });
  });

  modalOverlay.style.display = 'flex';
}

/**
 * Close modal
 */
function closeModal() {
  modalOverlay.style.display = 'none';
}

/**
 * Highlight element on the page
 */
async function highlightElement(elementId, button) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (id) => {
        const element = window.__a11yElements?.[id];
        if (!element) {
          console.warn('Element not found:', id);
          return;
        }

        // Scroll element into view
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Wait a bit for scroll to complete
        setTimeout(() => {
          const rect = element.getBoundingClientRect();

          // Create overlay
          const overlay = document.createElement('div');
          overlay.style.cssText = `
            position: fixed;
            top: ${rect.top}px;
            left: ${rect.left}px;
            width: ${rect.width}px;
            height: ${rect.height}px;
            background: rgba(229, 62, 62, 0.3);
            border: 3px solid #e53e3e;
            z-index: 2147483647;
            pointer-events: none;
            animation: a11yPulse 1.5s infinite;
            border-radius: 4px;
          `;

          // Create arrow
          const arrow = document.createElement('div');
          arrow.style.cssText = `
            position: fixed;
            top: ${rect.top - 40}px;
            left: ${rect.left + rect.width / 2 - 15}px;
            width: 0;
            height: 0;
            border-left: 15px solid transparent;
            border-right: 15px solid transparent;
            border-top: 30px solid #e53e3e;
            z-index: 2147483647;
            pointer-events: none;
            animation: a11yBounce 1s infinite;
          `;

          // Add animations if not already present
          if (!document.getElementById('a11y-animations')) {
            const style = document.createElement('style');
            style.id = 'a11y-animations';
            style.textContent = `
              @keyframes a11yPulse {
                0%, 100% { opacity: 0.8; }
                50% { opacity: 0.5; }
              }
              @keyframes a11yBounce {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-10px); }
              }
              @keyframes a11yFadeOut {
                from { opacity: 1; }
                to { opacity: 0; }
              }
            `;
            document.head.appendChild(style);
          }

          document.body.appendChild(overlay);
          document.body.appendChild(arrow);

          // Remove after 4 seconds with fade out
          setTimeout(() => {
            overlay.style.animation = 'a11yFadeOut 0.5s forwards';
            arrow.style.animation = 'a11yFadeOut 0.5s forwards';
            setTimeout(() => {
              overlay.remove();
              arrow.remove();
            }, 500);
          }, 4000);
        }, 500);
      },
      args: [elementId]
    });

    // Update button to show confirmation
    const originalText = button.textContent;
    button.textContent = '✓ Highlighted';
    button.classList.add('highlighted');

    setTimeout(() => {
      button.textContent = originalText;
      button.classList.remove('highlighted');
    }, 2000);

  } catch (error) {
    console.error('Error highlighting element:', error);
  }
}

/**
 * Export report in different formats
 */
function exportReport(format) {
  if (!currentResults) return;

  let content, filename, mimeType;

  switch(format) {
    case 'json':
      content = JSON.stringify(currentResults, null, 2);
      filename = 'wcag-report.json';
      mimeType = 'application/json';
      break;

    case 'csv':
      const csvRows = [
        ['Type', 'WCAG', 'Level', 'Title', 'Description', 'Count', 'Fix']
      ];

      currentResults.issues.forEach(issue => {
        csvRows.push([
          issue.type,
          issue.id,
          issue.wcagLevel,
          issue.title,
          issue.description.replace(/"/g, '""'),
          issue.count,
          issue.fix.replace(/"/g, '""')
        ]);
      });

      content = csvRows.map(row =>
        row.map(cell => `"${cell}"`).join(',')
      ).join('\n');

      filename = 'wcag-report.csv';
      mimeType = 'text/csv';
      break;

    case 'txt':
      let txt = 'WCAG 2.2 ACCESSIBILITY REPORT\n';
      txt += '================================\n\n';
      txt += `Grade: ${currentResults.grade}\n`;
      txt += `Score: ${currentResults.score}/100\n\n`;
      txt += `Errors: ${currentResults.errors}\n`;
      txt += `Warnings: ${currentResults.warnings}\n`;
      txt += `Total Issues: ${currentResults.total}\n\n`;
      txt += `WCAG Level Breakdown:\n`;
      txt += `  Level A: ${currentResults.levelCounts.A}\n`;
      txt += `  Level AA: ${currentResults.levelCounts.AA}\n`;
      txt += `  Level AAA: ${currentResults.levelCounts.AAA}\n\n`;
      txt += '================================\n\n';

      currentResults.issues.forEach((issue, index) => {
        txt += `${index + 1}. ${issue.title}\n`;
        txt += `   Type: ${issue.type.toUpperCase()}\n`;
        txt += `   WCAG Level: ${issue.wcagLevel}\n`;
        txt += `   Count: ${issue.count} element(s)\n\n`;
        txt += `   Description:\n   ${issue.description}\n\n`;
        txt += `   How to Fix:\n   ${issue.fix}\n\n`;
        txt += `   WCAG Techniques: ${issue.techniques}\n\n`;
        txt += '---\n\n';
      });

      content = txt;
      filename = 'wcag-report.txt';
      mimeType = 'text/plain';
      break;
  }

  // Create download link
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
