// Content script - runs on web pages
// This script can be used for additional functionality if needed

// Listen for messages from popup or background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getArticleText') {
    const articleText = extractArticleContent();
    sendResponse({ text: articleText });
  }
});

function extractArticleContent() {
  // Try multiple selectors to find article content
  const selectors = [
    'article',
    '[role="main"]',
    '.post-content',
    '.entry-content',
    '.article-content',
    '.content',
    'main',
    '#content',
    '.story-body',
    '.article-body',
    '.post-body',
    '.entry-body'
  ];

  let articleElement = null;
  
  for (const selector of selectors) {
    articleElement = document.querySelector(selector);
    if (articleElement) break;
  }

  // If no specific article element found, try to get paragraphs
  if (!articleElement) {
    const paragraphs = document.querySelectorAll('p');
    if (paragraphs.length > 3) {
      // Create a temporary container
      articleElement = document.createElement('div');
      paragraphs.forEach(p => {
        if (p.textContent.trim().length > 50) {
          articleElement.appendChild(p.cloneNode(true));
        }
      });
    }
  }

  // Last resort - use body but this might be noisy
  if (!articleElement) {
    articleElement = document.body;
  }

  if (!articleElement) {
    return '';
  }

  // Clone the element to avoid modifying the original
  const clonedElement = articleElement.cloneNode(true);

  // Remove script, style, nav, header, footer, and other non-content elements
  const elementsToRemove = clonedElement.querySelectorAll(
    'script, style, nav, header, footer, aside, .sidebar, .nav, .menu, .advertisement, .ads, .social-share, .comments, .related-posts, .author-bio, .tags, .categories, .breadcrumbs, .share-buttons, .social-buttons, .newsletter-signup, .popup, .modal, .overlay'
  );
  
  elementsToRemove.forEach(el => el.remove());

  // Get text content
  let text = clonedElement.innerText || clonedElement.textContent || '';
  
  // Clean up the text
  text = text
    .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
    .replace(/\n\s*\n/g, '\n') // Remove multiple newlines
    .trim();
  
  // Remove very short lines (likely navigation or UI elements)
  const lines = text.split('\n');
  const meaningfulLines = lines.filter(line => line.trim().length > 20);
  text = meaningfulLines.join('\n');

  // Limit text length (APIs usually have token limits)
  if (text.length > 15000) {
    text = text.substring(0, 15000) + '...';
  }

  return text;
}

// Optional: Add visual indicator when extension is active
function addExtensionIndicator() {
  if (document.getElementById('ai-summarizer-indicator')) {
    return; // Already added
  }

  const indicator = document.createElement('div');
  indicator.id = 'ai-summarizer-indicator';
  indicator.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background-color: #4CAF50;
    color: white;
    padding: 5px 10px;
    border-radius: 15px;
    font-size: 12px;
    z-index: 10000;
    font-family: Arial, sans-serif;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    opacity: 0.8;
  `;
  indicator.textContent = 'AI Summarizer Ready';
  
  document.body.appendChild(indicator);
  
  // Hide after 3 seconds
  setTimeout(() => {
    if (indicator.parentNode) {
      indicator.parentNode.removeChild(indicator);
    }
  }, 3000);
}

// Add indicator when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', addExtensionIndicator);
} else {
  addExtensionIndicator();
}