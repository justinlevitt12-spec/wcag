// Content script for Medium Article Downloader
// Runs on Medium pages to extract article content

(function() {
  'use strict';

  // Function to check if current page is a Medium article
  function isMediumArticle() {
    const url = window.location.hostname;
    return url.includes('medium.com') ||
           document.querySelector('meta[property="al:android:app_name"][content*="Medium"]') !== null ||
           document.querySelector('article') !== null;
  }

  // Function to extract article metadata
  function extractMetadata() {
    const metadata = {
      title: '',
      author: '',
      publishDate: '',
      url: window.location.href,
      subtitle: ''
    };

    // Try to get title from meta tags or h1
    const titleMeta = document.querySelector('meta[property="og:title"]');
    const titleH1 = document.querySelector('article h1, h1[class*="title"]');
    metadata.title = titleMeta?.content || titleH1?.textContent?.trim() || document.title;

    // Get author
    const authorMeta = document.querySelector('meta[name="author"]');
    const authorLink = document.querySelector('a[rel="author"], a[data-testid="authorName"]');
    metadata.author = authorMeta?.content || authorLink?.textContent?.trim() || 'Unknown Author';

    // Get publish date
    const dateMeta = document.querySelector('meta[property="article:published_time"]');
    const dateElement = document.querySelector('time, [data-testid="storyPublishDate"]');
    metadata.publishDate = dateMeta?.content || dateElement?.getAttribute('datetime') || dateElement?.textContent?.trim() || '';

    // Get subtitle/description
    const subtitleMeta = document.querySelector('meta[property="og:description"]');
    const subtitleElement = document.querySelector('article h2, h2[class*="subtitle"]');
    metadata.subtitle = subtitleMeta?.content || subtitleElement?.textContent?.trim() || '';

    return metadata;
  }

  // Function to extract article content
  function extractArticleContent() {
    // Try multiple selectors for Medium's various layouts
    let articleElement = document.querySelector('article');

    // If no article tag, try to find the main content area by class patterns
    if (!articleElement) {
      // Try common Medium content selectors
      const possibleSelectors = [
        'main',
        '[role="main"]',
        'section[data-field="body"]',
        '.postArticle-content',
        '.section-content',
        'div[class*="postContent"]',
        'div[class*="article-content"]'
      ];

      for (const selector of possibleSelectors) {
        articleElement = document.querySelector(selector);
        if (articleElement && articleElement.textContent.trim().length > 200) {
          break;
        }
      }
    }

    if (!articleElement) {
      return null;
    }

    // For member-only articles, remove paywall overlays if present
    const paywallOverlays = articleElement.querySelectorAll('[class*="overlay"], [class*="paywall"], [class*="meter"]');
    paywallOverlays.forEach(overlay => {
      if (overlay.style.display !== 'none') {
        // Don't remove, just note it exists
      }
    });

    const content = {
      text: '',
      html: '',
      images: [],
      codeBlocks: []
    };

    // Clone the article to clean it up without modifying the page
    const cleanArticle = articleElement.cloneNode(true);

    // Remove unwanted elements from the clone
    const elementsToRemove = cleanArticle.querySelectorAll(
      'script, style, iframe[src*="youtube.com/subscribe"], .bio, .author-info, .follow-button, [class*="shareButton"], [class*="clap"], [data-action="show-user-card"], aside, nav'
    );
    elementsToRemove.forEach(el => el.remove());

    content.html = cleanArticle.innerHTML;
    content.text = cleanArticle.textContent.trim();

    // Extract images with better Medium-specific handling
    const images = cleanArticle.querySelectorAll('img');
    images.forEach((img, index) => {
      // Medium often uses data-src or lazy loading
      const src = img.src || img.getAttribute('data-src') || img.getAttribute('data-image-id');
      if (src && !src.includes('data:image')) {
        content.images.push({
          src: src,
          alt: img.alt || img.getAttribute('title') || `Image ${index + 1}`,
          width: img.naturalWidth || img.width,
          height: img.naturalHeight || img.height
        });
      }
    });

    // Extract code blocks
    const codeBlocks = cleanArticle.querySelectorAll('pre, code');
    codeBlocks.forEach((code, index) => {
      content.codeBlocks.push({
        code: code.textContent,
        language: code.className.match(/language-(\w+)/)?.[1] || '',
        index: index
      });
    });

    return content;
  }

  // Function to convert HTML to Markdown
  function htmlToMarkdown(html, metadata) {
    let markdown = '';

    // Add metadata header
    markdown += `# ${metadata.title}\n\n`;
    if (metadata.author) {
      markdown += `**Author:** ${metadata.author}\n\n`;
    }
    if (metadata.publishDate) {
      markdown += `**Published:** ${metadata.publishDate}\n\n`;
    }
    if (metadata.subtitle) {
      markdown += `*${metadata.subtitle}*\n\n`;
    }
    markdown += `**URL:** ${metadata.url}\n\n`;
    markdown += '---\n\n';

    // Create a temporary div to parse HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    // Process each element
    const processNode = (node, listLevel = 0) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent.trim();
        if (text) {
          markdown += text + ' ';
        }
        return;
      }

      if (node.nodeType !== Node.ELEMENT_NODE) return;

      const tag = node.tagName.toLowerCase();

      switch(tag) {
        case 'h1':
          markdown += '\n# ' + node.textContent.trim() + '\n\n';
          break;
        case 'h2':
          markdown += '\n## ' + node.textContent.trim() + '\n\n';
          break;
        case 'h3':
          markdown += '\n### ' + node.textContent.trim() + '\n\n';
          break;
        case 'h4':
          markdown += '\n#### ' + node.textContent.trim() + '\n\n';
          break;
        case 'h5':
          markdown += '\n##### ' + node.textContent.trim() + '\n\n';
          break;
        case 'h6':
          markdown += '\n###### ' + node.textContent.trim() + '\n\n';
          break;
        case 'p':
          node.childNodes.forEach(child => processNode(child));
          markdown += '\n\n';
          break;
        case 'strong':
        case 'b':
          markdown += '**' + node.textContent.trim() + '**';
          break;
        case 'em':
        case 'i':
          markdown += '*' + node.textContent.trim() + '*';
          break;
        case 'code':
          if (node.parentElement.tagName.toLowerCase() !== 'pre') {
            markdown += '`' + node.textContent.trim() + '`';
          }
          break;
        case 'pre':
          const codeElement = node.querySelector('code');
          const code = codeElement ? codeElement.textContent : node.textContent;
          const language = codeElement?.className.match(/language-(\w+)/)?.[1] || '';
          markdown += '\n```' + language + '\n' + code.trim() + '\n```\n\n';
          break;
        case 'blockquote':
          const lines = node.textContent.trim().split('\n');
          lines.forEach(line => {
            if (line.trim()) {
              markdown += '> ' + line.trim() + '\n';
            }
          });
          markdown += '\n';
          break;
        case 'ul':
          node.childNodes.forEach(child => {
            if (child.tagName?.toLowerCase() === 'li') {
              markdown += '  '.repeat(listLevel) + '- ';
              child.childNodes.forEach(c => processNode(c, listLevel + 1));
              markdown += '\n';
            }
          });
          markdown += '\n';
          break;
        case 'ol':
          let index = 1;
          node.childNodes.forEach(child => {
            if (child.tagName?.toLowerCase() === 'li') {
              markdown += '  '.repeat(listLevel) + `${index}. `;
              child.childNodes.forEach(c => processNode(c, listLevel + 1));
              markdown += '\n';
              index++;
            }
          });
          markdown += '\n';
          break;
        case 'a':
          const href = node.getAttribute('href');
          const text = node.textContent.trim();
          if (href) {
            markdown += `[${text}](${href})`;
          } else {
            markdown += text;
          }
          break;
        case 'img':
          const src = node.getAttribute('src');
          const alt = node.getAttribute('alt') || 'image';
          markdown += `\n![${alt}](${src})\n\n`;
          break;
        case 'figure':
          node.childNodes.forEach(child => processNode(child));
          markdown += '\n';
          break;
        case 'hr':
          markdown += '\n---\n\n';
          break;
        default:
          node.childNodes.forEach(child => processNode(child, listLevel));
      }
    };

    // Process the article content
    const article = tempDiv.querySelector('article') || tempDiv;
    article.childNodes.forEach(node => processNode(node));

    // Clean up extra whitespace
    markdown = markdown.replace(/\n{3,}/g, '\n\n').trim();

    return markdown;
  }

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'checkMedium') {
      sendResponse({ isMedium: isMediumArticle() });
    }

    if (request.action === 'extractArticle') {
      try {
        const metadata = extractMetadata();
        const content = extractArticleContent();

        if (!content) {
          sendResponse({
            success: false,
            error: 'Could not find article content on this page.'
          });
          return;
        }

        const markdown = htmlToMarkdown(content.html, metadata);

        sendResponse({
          success: true,
          data: {
            metadata,
            content,
            markdown
          }
        });
      } catch (error) {
        sendResponse({
          success: false,
          error: error.message
        });
      }
    }

    return true; // Keep the message channel open for async response
  });

})();
