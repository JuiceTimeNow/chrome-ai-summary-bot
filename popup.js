// popup.js

document.addEventListener('DOMContentLoaded', function() {
  const summarizeBtn   = document.getElementById('summarizeBtn');
  const clearBtn       = document.getElementById('clearBtn');
  const saveConfigBtn  = document.getElementById('saveConfig');
  const loading        = document.getElementById('loading');
  const summary        = document.getElementById('summary');
  const error          = document.getElementById('error');
  const summaryContent = document.getElementById('summaryContent');
  const errorContent   = document.getElementById('errorContent');
  const configStatus   = document.getElementById('configStatus');

  // Preserve line breaks
  summaryContent.style.whiteSpace = 'pre-wrap';

  // Load config and show stored summary for this URL
  loadConfig();
  checkForStoredSummary();

  // Event listeners
  saveConfigBtn.addEventListener('click', saveConfig);
  summarizeBtn.addEventListener('click', summarizeArticle);
  clearBtn.addEventListener('click', clearSummary);

  // 1) Show stored summary if not expired (24h TTL)
  async function checkForStoredSummary() {
    try {
      const { summaryCache = {} } = await chrome.storage.local.get(['summaryCache']);
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const entry = summaryCache[tab.url];
      if (entry) {
        const now = Date.now();
        const age = now - entry.ts;
        const TTL = 24 * 60 * 60 * 1000; // 24 hours in ms
        if (age < TTL) {
          showSummary(entry.text);
        } else {
          // expired: remove and update storage
          delete summaryCache[tab.url];
          await chrome.storage.local.set({ summaryCache });
        }
      }
    } catch (err) {
      console.error('Error checking stored summary:', err);
    }
  }

  // 2) Load saved configuration
  async function loadConfig() {
    try {
      const result = await chrome.storage.sync.get([
        'aiProvider', 'apiKey', 'summaryLength', 'summaryStyle'
      ]);
      if (result.aiProvider)    document.getElementById('aiProvider').value    = result.aiProvider;
      if (result.apiKey)         document.getElementById('apiKey').value         = result.apiKey;
      if (result.summaryLength)  document.getElementById('summaryLength').value  = result.summaryLength;
      if (result.summaryStyle)   document.getElementById('summaryStyle').value   = result.summaryStyle;
    } catch (err) {
      console.error('Error loading config:', err);
    }
  }

  // 3) Save configuration
  async function saveConfig() {
    const aiProvider    = document.getElementById('aiProvider').value;
    const apiKey        = document.getElementById('apiKey').value;
    const summaryLength = document.getElementById('summaryLength').value;
    const summaryStyle  = document.getElementById('summaryStyle').value;

    if (!apiKey) {
      showConfigStatus('Please enter an API key', 'error');
      return;
    }

    try {
      await chrome.storage.sync.set({ aiProvider, apiKey, summaryLength, summaryStyle });
      showConfigStatus('Configuration saved successfully!', 'success');
    } catch (err) {
      showConfigStatus('Error saving configuration', 'error');
      console.error('Error saving config:', err);
    }
  }

  // 4) Show configuration status messages
  function showConfigStatus(message, type) {
    configStatus.textContent   = message;
    configStatus.className     = `status ${type}`;
    configStatus.style.display = 'block';
    setTimeout(() => { configStatus.style.display = 'none'; }, 3000);
  }

  // 5) Summarize article and update cache
  async function summarizeArticle() {
    clearPreviousResults();

    // Read current settings directly from UI
    const aiProviderVal   = document.getElementById('aiProvider').value;
    const apiKeyVal       = document.getElementById('apiKey').value;
    const summaryLengthVal= document.getElementById('summaryLength').value;
    const summaryStyleVal = document.getElementById('summaryStyle').value;

    // Validate API key
    if (!apiKeyVal) {
      showError('Please configure your API key first');
      return;
    }

    // Persist settings so they stick on next popup open
    await chrome.storage.sync.set({
      aiProvider: aiProviderVal,
      apiKey: apiKeyVal,
      summaryLength: summaryLengthVal,
      summaryStyle: summaryStyleVal
    });

    loading.style.display = 'block';
    summarizeBtn.disabled = true;

    try {
      // Extract article text
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: extractArticleContent
      });
      const articleText = results[0].result;
      if (!articleText || articleText.trim().length === 0) {
        throw new Error('No article content found on this page');
      }

      // Build config from current UI selections
      const config = {
        aiProvider:   aiProviderVal,
        apiKey:       apiKeyVal,
        summaryLength:summaryLengthVal,
        summaryStyle: summaryStyleVal
      };

      // Send to background script
      const response = await chrome.runtime.sendMessage({ action: 'summarize', text: articleText, config });

      if (response.success) {
        showSummary(response.summary);
        // cache result with timestamp
        const { summaryCache = {} } = await chrome.storage.local.get(['summaryCache']);
        summaryCache[tab.url] = { text: response.summary, ts: Date.now() };
        await chrome.storage.local.set({ summaryCache });
      } else {
        throw new Error(response.error || 'Unknown error');
      }
    } catch (err) {
      showError(err.message);
    } finally {
      loading.style.display = 'none';
      summarizeBtn.disabled = false;
    }
  }

  // 6) Clear previous results from UI
  function clearPreviousResults() {
    summary.style.display          = 'none';
    error.style.display            = 'none';
    summaryContent.textContent     = '';
    errorContent.textContent       = '';
  }

  // 7) Display summary with blank line before each bullet
  function showSummary(summaryText) {
    const formatted = summaryText.replace(/(^|\n)(- )/g, '$1\n$2');
    summaryContent.textContent = formatted;
    summary.style.display      = 'block';
  }

  // 8) Display error
  function showError(errorMessage) {
    errorContent.textContent = errorMessage;
    error.style.display      = 'block';
  }

  // 9) Clear summary for current URL and update cache
  async function clearSummary() {
    clearPreviousResults();
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const { summaryCache = {} } = await chrome.storage.local.get(['summaryCache']);
    delete summaryCache[tab.url];
    await chrome.storage.local.set({ summaryCache });
  }
});

// Content extraction function injected into the page
function extractArticleContent() {
  const selectors = [
    'article', '[role="main"]', '.post-content', '.entry-content',
    '.article-content', '.content', 'main', '#content', '.story-body', '.article-body'
  ];
  let articleElement = null;
  for (const sel of selectors) {
    articleElement = document.querySelector(sel);
    if (articleElement) break;
  }
  if (!articleElement) articleElement = document.body;
  if (!articleElement) return '';
  articleElement.querySelectorAll(
    'script, style, nav, header, footer, aside, .sidebar, .nav, .menu,' +
    ' .advertisement, .ads, .social-share, .comments'
  ).forEach(el => el.remove());
  let text = articleElement.innerText || articleElement.textContent || '';
  text = text.replace(/\s+/g, ' ').trim();
  if (text.length > 15000) text = text.substring(0, 15000) + '...';
  return text;
}
