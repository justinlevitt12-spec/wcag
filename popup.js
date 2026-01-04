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
  const { metadata, content } = data;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(metadata.title)}</title>
  <style>
    @page {
      margin: 2cm;
    }
    body {
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 16px;
      line-height: 1.6;
      color: #1a1a1a;
      max-width: 800px;
      margin: 0 auto;
    }
    h1 {
      font-size: 32px;
      font-weight: 700;
      margin-bottom: 8px;
      line-height: 1.2;
    }
    h2 {
      font-size: 24px;
      font-weight: 700;
      margin-top: 32px;
      margin-bottom: 16px;
    }
    h3 {
      font-size: 20px;
      font-weight: 600;
      margin-top: 24px;
      margin-bottom: 12px;
    }
    .metadata {
      color: #666;
      font-size: 14px;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid #ddd;
    }
    .subtitle {
      font-size: 20px;
      font-style: italic;
      color: #666;
      margin-bottom: 16px;
    }
    p {
      margin-bottom: 16px;
    }
    img {
      max-width: 100%;
      height: auto;
      display: block;
      margin: 24px auto;
    }
    pre {
      background: #f5f5f5;
      padding: 16px;
      border-radius: 4px;
      overflow-x: auto;
      font-size: 14px;
      line-height: 1.4;
    }
    code {
      background: #f5f5f5;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Courier New', monospace;
      font-size: 14px;
    }
    pre code {
      background: none;
      padding: 0;
    }
    blockquote {
      border-left: 4px solid #ddd;
      margin-left: 0;
      padding-left: 20px;
      color: #666;
      font-style: italic;
    }
    a {
      color: #0066cc;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
    ul, ol {
      margin-bottom: 16px;
      padding-left: 32px;
    }
    li {
      margin-bottom: 8px;
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(metadata.title)}</h1>

  ${metadata.subtitle ? `<div class="subtitle">${escapeHtml(metadata.subtitle)}</div>` : ''}

  <div class="metadata">
    ${metadata.author ? `<div><strong>Author:</strong> ${escapeHtml(metadata.author)}</div>` : ''}
    ${metadata.publishDate ? `<div><strong>Published:</strong> ${escapeHtml(metadata.publishDate)}</div>` : ''}
    <div><strong>URL:</strong> <a href="${escapeHtml(metadata.url)}">${escapeHtml(metadata.url)}</a></div>
  </div>

  ${content.html}
</body>
</html>
  `;
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
