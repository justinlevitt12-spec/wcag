// Medium Article Downloader - Popup Script

// DOM Elements
const downloadMarkdownBtn = document.getElementById('download-markdown');
const downloadPdfBtn = document.getElementById('download-pdf');
const loadingDiv = document.getElementById('loading');
const successDiv = document.getElementById('success');
const errorDiv = document.getElementById('error');
const errorMessage = document.getElementById('error-message');
const notMediumDiv = document.getElementById('not-medium');
const controls = document.getElementById('controls');

// State
let currentTab = null;
let articleData = null;

// Initialize popup
async function init() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTab = tab;

    // Check if current page is a Medium article
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'checkMedium' });

    if (response && response.isMedium) {
      controls.style.display = 'flex';
      notMediumDiv.style.display = 'none';
    } else {
      controls.style.display = 'none';
      notMediumDiv.style.display = 'block';
    }
  } catch (error) {
    console.error('Init error:', error);
    controls.style.display = 'none';
    notMediumDiv.style.display = 'block';
  }
}

// Show/hide UI states
function showLoading() {
  loadingDiv.style.display = 'block';
  successDiv.style.display = 'none';
  errorDiv.style.display = 'none';
  downloadMarkdownBtn.disabled = true;
  downloadPdfBtn.disabled = true;
}

function showSuccess() {
  loadingDiv.style.display = 'none';
  successDiv.style.display = 'block';
  errorDiv.style.display = 'none';
  downloadMarkdownBtn.disabled = false;
  downloadPdfBtn.disabled = false;

  setTimeout(() => {
    successDiv.style.display = 'none';
  }, 3000);
}

function showError(message) {
  loadingDiv.style.display = 'none';
  successDiv.style.display = 'none';
  errorDiv.style.display = 'block';
  errorMessage.textContent = message;
  downloadMarkdownBtn.disabled = false;
  downloadPdfBtn.disabled = false;

  setTimeout(() => {
    errorDiv.style.display = 'none';
  }, 5000);
}

// Extract article data
async function extractArticleData() {
  if (articleData) {
    return articleData;
  }

  try {
    const response = await chrome.tabs.sendMessage(currentTab.id, { action: 'extractArticle' });

    if (response && response.success) {
      articleData = response.data;
      return articleData;
    } else {
      throw new Error(response.error || 'Failed to extract article data');
    }
  } catch (error) {
    throw new Error(`Could not extract article: ${error.message}`);
  }
}

// Download as Markdown
async function downloadMarkdown() {
  showLoading();

  try {
    const data = await extractArticleData();
    const filename = sanitizeFilename(data.metadata.title) + '.md';

    // Create blob and download
    const blob = new Blob([data.markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);

    await chrome.downloads.download({
      url: url,
      filename: filename,
      saveAs: true
    });

    URL.revokeObjectURL(url);
    showSuccess();
  } catch (error) {
    console.error('Markdown download error:', error);
    showError(error.message);
  }
}

// Download as PDF
async function downloadPdf() {
  showLoading();

  try {
    const data = await extractArticleData();
    const filename = sanitizeFilename(data.metadata.title) + '.pdf';

    // Generate HTML for PDF
    const htmlContent = generatePdfHtml(data);

    // Create a new window/tab to generate PDF
    const printWindow = window.open('', '_blank');
    printWindow.document.write(htmlContent);
    printWindow.document.close();

    // Wait for content to load
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
        showSuccess();
        setTimeout(() => {
          printWindow.close();
        }, 1000);
      }, 500);
    };

  } catch (error) {
    console.error('PDF download error:', error);
    showError(error.message);
  }
}

// Generate HTML for PDF export
function generatePdfHtml(data) {
  const { metadata, markdown } = data;

  // Convert Markdown to HTML
  const contentHtml = markdownToHtml(markdown);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(metadata.title)}</title>
  <style>
    @page {
      margin: 2.5cm;
      size: A4;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Charter', 'Georgia', 'Times New Roman', serif;
      font-size: 18px;
      line-height: 1.7;
      color: #1a1a1a;
      max-width: 700px;
      margin: 0 auto;
      padding: 40px 20px;
      background: white;
    }

    h1 {
      font-size: 42px;
      font-weight: 700;
      line-height: 1.15;
      margin-bottom: 16px;
      letter-spacing: -0.5px;
      color: #000;
    }

    h2 {
      font-size: 32px;
      font-weight: 700;
      line-height: 1.25;
      margin-top: 48px;
      margin-bottom: 20px;
      color: #000;
      page-break-after: avoid;
    }

    h3 {
      font-size: 24px;
      font-weight: 600;
      line-height: 1.3;
      margin-top: 36px;
      margin-bottom: 16px;
      color: #000;
      page-break-after: avoid;
    }

    h4 {
      font-size: 20px;
      font-weight: 600;
      line-height: 1.4;
      margin-top: 28px;
      margin-bottom: 12px;
      color: #000;
    }

    .metadata {
      color: #666;
      font-size: 15px;
      line-height: 1.6;
      margin-bottom: 32px;
      padding-bottom: 24px;
      border-bottom: 2px solid #e0e0e0;
    }

    .metadata div {
      margin-bottom: 6px;
    }

    .subtitle {
      font-size: 24px;
      font-style: italic;
      color: #666;
      margin-bottom: 24px;
      line-height: 1.4;
    }

    p {
      margin-bottom: 24px;
      text-align: justify;
      hyphens: auto;
      orphans: 3;
      widows: 3;
    }

    strong, b {
      font-weight: 700;
      color: #000;
    }

    em, i {
      font-style: italic;
    }

    img {
      max-width: 100%;
      height: auto;
      display: block;
      margin: 32px auto;
      page-break-inside: avoid;
      border-radius: 4px;
    }

    pre {
      background: #f8f8f8;
      border: 1px solid #e0e0e0;
      border-left: 4px solid #666;
      padding: 20px;
      border-radius: 4px;
      overflow-x: auto;
      font-size: 14px;
      line-height: 1.5;
      margin: 24px 0;
      page-break-inside: avoid;
      font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
    }

    code {
      background: #f0f0f0;
      padding: 3px 6px;
      border-radius: 3px;
      font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
      font-size: 15px;
      color: #d63384;
      border: 1px solid #e0e0e0;
    }

    pre code {
      background: none;
      padding: 0;
      border: none;
      color: #1a1a1a;
      font-size: 14px;
    }

    blockquote {
      border-left: 4px solid #ccc;
      margin: 24px 0;
      padding: 4px 0 4px 24px;
      color: #555;
      font-style: italic;
      background: #fafafa;
      page-break-inside: avoid;
    }

    blockquote p {
      margin-bottom: 12px;
    }

    a {
      color: #0066cc;
      text-decoration: underline;
      text-decoration-color: #0066cc;
      text-decoration-thickness: 1px;
    }

    ul, ol {
      margin: 20px 0 24px 0;
      padding-left: 40px;
    }

    li {
      margin-bottom: 12px;
      line-height: 1.6;
    }

    ul li {
      list-style-type: disc;
    }

    ol li {
      list-style-type: decimal;
    }

    hr {
      border: none;
      border-top: 2px solid #e0e0e0;
      margin: 40px 0;
    }

    /* Print-specific styles */
    @media print {
      body {
        font-size: 12pt;
      }

      h1 {
        font-size: 28pt;
      }

      h2 {
        font-size: 20pt;
      }

      h3 {
        font-size: 16pt;
      }

      a {
        color: #000;
        text-decoration: none;
      }

      a[href]:after {
        content: " (" attr(href) ")";
        font-size: 90%;
        color: #666;
      }

      pre, blockquote {
        page-break-inside: avoid;
      }

      h1, h2, h3, h4 {
        page-break-after: avoid;
      }

      img {
        page-break-inside: avoid;
        page-break-after: auto;
      }
    }
  </style>
</head>
<body>
  ${contentHtml}
</body>
</html>
  `;
}

// Convert Markdown to HTML
function markdownToHtml(markdown) {
  let html = '';
  const lines = markdown.split('\n');
  let inCodeBlock = false;
  let codeBlockContent = '';
  let inList = false;
  let listType = '';

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Handle code blocks
    if (line.trim().startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBlockContent = '';
      } else {
        html += `<pre><code>${escapeHtml(codeBlockContent)}</code></pre>\n`;
        inCodeBlock = false;
        codeBlockContent = '';
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent += line + '\n';
      continue;
    }

    // Handle headings
    if (line.startsWith('# ')) {
      if (inList) { html += listType === 'ul' ? '</ul>' : '</ol>'; inList = false; }
      html += `<h1>${escapeHtml(line.substring(2))}</h1>\n`;
    } else if (line.startsWith('## ')) {
      if (inList) { html += listType === 'ul' ? '</ul>' : '</ol>'; inList = false; }
      html += `<h2>${escapeHtml(line.substring(3))}</h2>\n`;
    } else if (line.startsWith('### ')) {
      if (inList) { html += listType === 'ul' ? '</ul>' : '</ol>'; inList = false; }
      html += `<h3>${escapeHtml(line.substring(4))}</h3>\n`;
    } else if (line.startsWith('#### ')) {
      if (inList) { html += listType === 'ul' ? '</ul>' : '</ol>'; inList = false; }
      html += `<h4>${escapeHtml(line.substring(5))}</h4>\n`;
    }
    // Handle horizontal rules
    else if (line.trim() === '---' || line.trim() === '***') {
      if (inList) { html += listType === 'ul' ? '</ul>' : '</ol>'; inList = false; }
      html += '<hr>\n';
    }
    // Handle blockquotes
    else if (line.trim().startsWith('> ')) {
      if (inList) { html += listType === 'ul' ? '</ul>' : '</ol>'; inList = false; }
      html += `<blockquote><p>${processInlineMarkdown(line.substring(2))}</p></blockquote>\n`;
    }
    // Handle unordered lists
    else if (line.trim().startsWith('- ')) {
      if (!inList || listType !== 'ul') {
        if (inList) html += '</ol>';
        html += '<ul>\n';
        inList = true;
        listType = 'ul';
      }
      html += `<li>${processInlineMarkdown(line.trim().substring(2))}</li>\n`;
    }
    // Handle ordered lists
    else if (/^\d+\.\s/.test(line.trim())) {
      if (!inList || listType !== 'ol') {
        if (inList) html += '</ul>';
        html += '<ol>\n';
        inList = true;
        listType = 'ol';
      }
      html += `<li>${processInlineMarkdown(line.trim().replace(/^\d+\.\s/, ''))}</li>\n`;
    }
    // Handle images
    else if (line.trim().startsWith('![')) {
      if (inList) { html += listType === 'ul' ? '</ul>' : '</ol>'; inList = false; }
      const match = line.match(/!\[(.*?)\]\((.*?)\)/);
      if (match) {
        html += `<img src="${escapeHtml(match[2])}" alt="${escapeHtml(match[1])}">\n`;
      }
    }
    // Handle paragraphs
    else if (line.trim()) {
      if (inList) { html += listType === 'ul' ? '</ul>' : '</ol>'; inList = false; }
      html += `<p>${processInlineMarkdown(line)}</p>\n`;
    }
    // Handle empty lines
    else {
      if (inList) { html += listType === 'ul' ? '</ul>' : '</ol>'; inList = false; }
    }
  }

  // Close any open lists
  if (inList) {
    html += listType === 'ul' ? '</ul>' : '</ol>';
  }

  return html;
}

// Process inline markdown (bold, italic, code, links)
function processInlineMarkdown(text) {
  // Links [text](url)
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Bold **text**
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // Italic *text*
  text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // Inline code `code`
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');

  return escapeHtml(text)
    .replace(/&lt;strong&gt;/g, '<strong>').replace(/&lt;\/strong&gt;/g, '</strong>')
    .replace(/&lt;em&gt;/g, '<em>').replace(/&lt;\/em&gt;/g, '</em>')
    .replace(/&lt;code&gt;/g, '<code>').replace(/&lt;\/code&gt;/g, '</code>')
    .replace(/&lt;a href="([^"]+)"&gt;/g, '<a href="$1">').replace(/&lt;\/a&gt;/g, '</a>');
}

// Sanitize filename
function sanitizeFilename(filename) {
  return filename
    .replace(/[^a-z0-9]/gi, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 100) || 'medium_article';
}

// Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Event Listeners
downloadMarkdownBtn.addEventListener('click', downloadMarkdown);
downloadPdfBtn.addEventListener('click', downloadPdf);

// Initialize on load
init();
