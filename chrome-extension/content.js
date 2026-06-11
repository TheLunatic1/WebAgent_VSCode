chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'execute_prompt') {
    console.log('WebAgent: Received execute_prompt', request);
    sendResponse({ status: 'received' }); // Prevents "message port closed" error
    
    handlePrompt(request.provider, request.prompt).catch(e => {
      console.error('WebAgent handlePrompt error:', e);
      chrome.runtime.sendMessage({ type: 'error', message: 'Content script error: ' + e.message });
    });
  }
});

async function handlePrompt(provider, prompt) {
  console.log(`WebAgent: Handling prompt for ${provider}`);
  let textarea, sendButtonSelector, messageSelector, isGeneratingCallback;

  if (provider === 'chatgpt') {
    textarea = document.querySelector('#prompt-textarea') || document.querySelector('[contenteditable="true"]');
    sendButtonSelector = '[data-testid="send-button"]';
    messageSelector = '[data-message-author-role="assistant"]';
    isGeneratingCallback = () => document.querySelector('[data-testid="stop-button"]') !== null || document.querySelector('.result-streaming') !== null;
  } else if (provider === 'gemini') {
    textarea = document.querySelector('rich-textarea') || document.querySelector('.rich-textarea') || document.querySelector('[contenteditable="true"]');
    sendButtonSelector = 'button[aria-label="Send message"], button[aria-label="Send"]';
    messageSelector = 'message-content';
    isGeneratingCallback = () => document.querySelector('loading-indicator') !== null;
  } else if (provider === 'grok') {
    textarea = document.querySelector('textarea[placeholder*="Grok"]') || document.querySelector('textarea');
    sendButtonSelector = 'button[aria-label="Grok something"], button svg path[d*="M2.01"]'; // Guessing standard send icons
    messageSelector = '.message, [class*="message"]'; // Fallback generic
    isGeneratingCallback = () => document.body.innerText.includes('Stop generating'); // Generic fallback
  } else if (provider === 'deepseek') {
    textarea = document.querySelector('#chat-input') || document.querySelector('textarea');
    sendButtonSelector = '.ds-send-btn, button[class*="send"]';
    messageSelector = '.ds-markdown, [class*="markdown"]';
    isGeneratingCallback = () => document.body.innerText.includes('Stop generating');
  } else {
    chrome.runtime.sendMessage({ type: 'error', message: 'Unknown provider' });
    return;
  }

  if (!textarea) {
    const errorMsg = 'Could not find input box on ' + provider;
    console.error('WebAgent:', errorMsg);
    chrome.runtime.sendMessage({ type: 'error', message: errorMsg });
    return;
  }

  console.log('WebAgent: Found textarea', textarea);

  // Focus and type
  textarea.focus();
  
  if (textarea.tagName.toLowerCase() === 'textarea' || textarea.tagName.toLowerCase() === 'input') {
    textarea.value = prompt;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  } else {
    // Content editable
    textarea.innerHTML = '';
    // ProseMirror in ChatGPT might need more than just execCommand
    document.execCommand('insertText', false, prompt);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  }

  console.log('WebAgent: Inserted text');

  await new Promise(r => setTimeout(r, 500));

  // Click send or press Enter
  const sendButton = document.querySelector(sendButtonSelector);
  console.log('WebAgent: Found send button', sendButton);
  if (sendButton && !sendButton.disabled) {
    console.log('WebAgent: Clicking send button');
    sendButton.click();
  } else {
    console.log('WebAgent: Pressing Enter fallback');
    // Fallback to Enter key
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
  }

  await new Promise(r => setTimeout(r, 1500)); // wait for generation to start

  console.log('WebAgent: Starting to stream response');
  streamResponse(messageSelector, isGeneratingCallback);
}

function streamResponse(messageSelector, isGeneratingCallback) {
  let lastText = '';
  let idleCount = 0;
  let isDone = false;

  const interval = setInterval(() => {
    try {
      const messages = document.querySelectorAll(messageSelector);
      if (messages.length > 0) {
        const latestMessage = messages[messages.length - 1];
        const text = latestMessage.innerText || latestMessage.textContent || '';
        
        if (text !== lastText) {
          chrome.runtime.sendMessage({ type: 'token', text: text });
          lastText = text;
          idleCount = 0;
        }
      }

      // Check if generation finished
      const isGenerating = isGeneratingCallback ? isGeneratingCallback() : false;
      
      if (!isGenerating) {
        idleCount++;
        if (idleCount > 15) { // ~1.5s of idle
          clearInterval(interval);
          if (!isDone) {
            isDone = true;
            console.log('WebAgent: Finished streaming');
            chrome.runtime.sendMessage({ type: 'done' });
          }
        }
      } else {
        idleCount = 0;
      }
    } catch (err) {
      console.error('WebAgent stream error:', err);
      clearInterval(interval);
      if (!isDone) {
        isDone = true;
        chrome.runtime.sendMessage({ type: 'error', message: 'Stream error: ' + err.message });
      }
    }
  }, 100);
}
