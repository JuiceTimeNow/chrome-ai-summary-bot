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

  // Load config and check for stored summary
  loadConfig();
  checkForStoredSummary();

  // Event listeners
  saveConfigBtn.addEventListener('click', saveConfig);
  summarizeBtn.addEventListener('click', summarizeArticle);
  clearBtn.addEventListener('click', clearSummary);

  // 1) Conditionally show stored summary only if URL matches
  async function checkForStoredSummary() {
    try {
      const { lastSummary, lastSummaryUrl } = await chrome.storage.local.get(['lastSummary', 'lastSummaryUrl']);
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (lastSummary && lastSummaryUrl === tab.url) {
        showSummary(lastSummary);
      }
    } catch (err) {
      console.error('Error checking stored summary:', err);
    }
  }

  // 2) Load saved configuration
  async function loadConfig() {
    try {
      const result = await chrome.storage.sync.get(['aiProvider','apiKey','summaryLength','summaryStyle']);
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

  // 5) Summarize article and persist summary with URL
  async function summarizeArticle() {
    clearPreviousResults();

    const { apiKey } = await chrome.storage.sync.get(['apiKey']);
    if (!apiKey) {
      showError('Please configure your API key first');
      return;
    }

    loading.style.display = 'block';
    summarizeBtn.disabled = true;

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const results = await chrome.scripting.executeScript({ target: { tabId: tab.id }, function: extractArticleContent });
      const articleText = results[0].result;
      if (!articleText || articleText.trim().length === 0) {
        throw new Error('No article content found on this page');
      }

      const config   = await chrome.storage.sync.get(['aiProvider','apiKey','summaryLength','summaryStyle']);
      const response = await chrome.runtime.sendMessage({ action: 'summarize', text: articleText, config });

      if (response.success) {
        showSummary(response.summary);
        await chrome.storage.local.set({ lastSummary: response.summary, lastSummaryUrl: tab.url });
      } else {
        throw new Error(response.error || 'Unknown error');
      }
    } catch (err) {
      showError(err.message);
    } finally {
      loading.style.display     = 'none';
      summarizeBtn.disabled     = false;
    }
  }

  // 6) Clear previous results from UI
  function clearPreviousResults() {
    summary.style.display      = 'none';
    error.style.display        = 'none';
    summaryContent.textContent = '';
    errorContent.textContent   = '';
  }

  // 7) Display summary with extra blank line before bullets
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

  // 9) Clear summary manually and remove stored data
  async function clearSummary() {
    clearPreviousResults();
    await chrome.storage.local.remove(['lastSummary','lastSummaryUrl']);
  }
});

// Content extraction function injected into the page
function extractArticleContent() {
  const selectors = ['article','[role="main"]','.post-content','.entry-content','.article-content','.content','main','#content','.story-body','.article-body'];
  let articleElement = null;
  for (const sel of selectors) {
    articleElement = document.querySelector(sel);
    if (articleElement) break;
  }
  if (!articleElement) articleElement = document.body;
  if (!articleElement) return '';
  articleElement.querySelectorAll('script,style,nav,header,footer,aside,.sidebar,.nav,.menu,.advertisement,.ads,.social-share,.comments').forEach(el => el.remove());
  let text = articleElement.innerText || articleElement.textContent || '';
  text = text.replace(/\s+/g, ' ').trim();
  if (text.length > 15000) text = text.substring(0, 15000) + '...';
  return text;
}
