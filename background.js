// Background script - handles API calls and cross-origin requests

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'summarize') {
    handleSummarization(request.text, request.config)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep the message channel open for async response
  }
});

async function handleSummarization(text, config) {
  try {
    if (!config.apiKey) {
      throw new Error('API key not configured');
    }

    const { aiProvider, apiKey, summaryLength, summaryStyle } = config;
    
    let summary;
    if (aiProvider === 'openai') {
      summary = await callOpenAI(text, apiKey, summaryLength, summaryStyle);
    } else if (aiProvider === 'anthropic') {
      summary = await callAnthropic(text, apiKey, summaryLength, summaryStyle);
    } else {
      throw new Error('Unsupported AI provider');
    }

    return { success: true, summary: summary };
  } catch (error) {
    console.error('Summarization error:', error);
    return { success: false, error: error.message };
  }
}

async function callOpenAI(text, apiKey, summaryLength, summaryStyle) {
  const lengthPrompt = {
    short: 'in 2-3 sentences',
    medium: 'in one paragraph',
    long: 'in 2-3 paragraphs'
  };

  const stylePrompt = {
    bullet: 'as bullet points',
    paragraph: 'as a cohesive paragraph',
    key_points: 'highlighting the key points'
  };

  const prompt = `Please summarize the following article ${lengthPrompt[summaryLength]} ${stylePrompt[summaryStyle]}:\n\n${text}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that summarizes articles clearly and concisely.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 500,
      temperature: 0.3
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`OpenAI API error: ${response.status} ${errorData.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content.trim();
}

async function callAnthropic(text, apiKey, summaryLength, summaryStyle) {
  const lengthPrompt = {
    short: 'in 2-3 sentences',
    medium: 'in one paragraph',
    long: 'in 2-3 paragraphs'
  };

  const stylePrompt = {
    bullet: 'as bullet points',
    paragraph: 'as a cohesive paragraph',
    key_points: 'highlighting the key points'
  };

  const prompt = `Please summarize the following article ${lengthPrompt[summaryLength]} ${stylePrompt[summaryStyle]}:\n\n${text}`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
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
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Anthropic API error: ${response.status} ${errorData.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return data.content[0].text.trim();
}

// Handle extension installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('AI Article Summarizer extension installed');
});

// Optional: Add context menu item
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'summarize-selection',
    title: 'Summarize selected text',
    contexts: ['selection']
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'summarize-selection') {
    try {
      const config = await chrome.storage.sync.get(['aiProvider', 'apiKey', 'summaryLength', 'summaryStyle']);
      
      if (!config.apiKey) {
        // Open the extension popup to configure
        chrome.action.openPopup();
        return;
      }

      const result = await handleSummarization(info.selectionText, config);
      
      if (result.success) {
        // You could show a notification or inject the summary into the page
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icon48.png',
          title: 'Summary Ready',
          message: 'Click the extension icon to view the summary'
        });
        
        // Store the summary temporarily
        await chrome.storage.local.set({ lastSummary: result.summary });
      } else {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icon48.png',
          title: 'Summarization Failed',
          message: result.error
        });
      }
    } catch (error) {
      console.error('Context menu summarization error:', error);
    }
  }
});