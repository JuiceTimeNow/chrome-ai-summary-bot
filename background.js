// Background script - handles API calls, context menus & notifications

// 1) Handle messages from popup/content
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'summarize') {
    handleSummarization(request.text, request.config)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // async response
  }
});

// 2) Summarization dispatcher
async function handleSummarization(text, config) {
  try {
    if (!config.apiKey) {
      throw new Error('API key not configured');
    }
    const { aiProvider, apiKey, summaryLength, summaryStyle } = config;

    if (aiProvider === 'openai') {
      const summary = await callOpenAI(text, apiKey, summaryLength, summaryStyle);
      return { success: true, summary };
    } 
    else if (aiProvider === 'anthropic') {
      const summary = await callAnthropic(text, apiKey, summaryLength, summaryStyle);
      return { success: true, summary };
    } 
    else {
      throw new Error('Unsupported AI provider');
    }
  } 
  catch (error) {
    console.error('Summarization error:', error);
    return { success: false, error: error.message };
  }
}

// 3) OpenAI API call
async function callOpenAI(text, apiKey, summaryLength, summaryStyle) {
  const lengthPrompt = { short: 'using about 50 to 100 words', medium: 'using about 100 to 200 words ', long: 'using about 300 to 600 words' };
  const stylePrompt  = { bullet: 'formatted as bullet points', paragraph: 'formatted as a cohesive paragraph', key_points: 'highlighting the key points' };

  const prompt = `Please summarize the following article ${lengthPrompt[summaryLength]} ${stylePrompt[summaryStyle]}:\n\n${text}`;
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are a helpful assistant that summarizes articles clearly and concisely.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 600,
      temperature: 0.3
    })
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(`OpenAI API error: ${resp.status} ${err.error?.message || resp.statusText}`);
  }
  const data = await resp.json();
  return data.choices[0].message.content.trim();
}

// 4) Anthropic API call
async function callAnthropic(text, apiKey, summaryLength, summaryStyle) {
  const lengthPrompt = { short: 'in 2-3 sentences', medium: 'in one paragraph', long: 'in 2-3 paragraphs' };
  const stylePrompt  = { bullet: 'as bullet points', paragraph: 'as a cohesive paragraph', key_points: 'highlighting the key points' };

  const prompt = `Please summarize the following article ${lengthPrompt[summaryLength]} ${stylePrompt[summaryStyle]}:\n\n${text}`;
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-3-sonnet-20240229',
      max_tokens: 500,
      system: 'You are a helpful assistant that summarizes articles clearly and concisely.',
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(`Anthropic API error: ${resp.status} ${err.error?.message || resp.statusText}`);
  }
  const data = await resp.json();
  return data.content[0].text.trim();
}

// 5) Create the context‑menu when extension is installed
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'summarize-selection',
    title: 'Summarize selected text',
    contexts: ['selection']
  });
});

// 6) Immediately register the click handler at top level
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'summarize-selection') return;

  try {
    const config = await chrome.storage.sync.get(['aiProvider','apiKey','summaryLength','summaryStyle']);
    if (!config.apiKey) {
      return chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon48.png',
        title: 'Missing API key',
        message: 'Please configure your API key in the popup'
      });
    }

    const result = await handleSummarization(info.selectionText, config);
    if (result.success) {
      await chrome.storage.local.set({ lastSummary: result.summary });
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon48.png',
        title: 'Summary Ready',
        message: 'Click the extension icon to view your summary'
      });
    } else {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon48.png',
        title: 'Summarization Failed',
        message: result.error
      });
    }
  } 
  catch (err) {
    console.error('Context‑menu error:', err);
  }
});
