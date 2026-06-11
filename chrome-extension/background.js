let socket = null;
let pingInterval = null;

function connectWebSocket() {
  if (socket && socket.readyState !== WebSocket.CLOSED) return;

  socket = new WebSocket('ws://localhost:8765');

  socket.onopen = () => {
    console.log('Connected to WebAgent VS Code Extension');
    
    // Keep service worker alive by pinging every 20 seconds
    if (pingInterval) clearInterval(pingInterval);
    pingInterval = setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'ping' }));
      }
    }, 20000);
  };

  socket.onmessage = async (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'prompt') {
        const provider = data.provider;
        const prompt = data.prompt;
        
        let urlPattern = ['*://chatgpt.com/*', '*://*.chatgpt.com/*'];
        if (provider === 'gemini') urlPattern = '*://gemini.google.com/*';
        if (provider === 'grok') urlPattern = '*://grok.com/*';
        if (provider === 'deepseek') urlPattern = '*://chat.deepseek.com/*';

        const tabs = await chrome.tabs.query({ url: urlPattern });
        
        if (tabs.length === 0) {
          socket.send(JSON.stringify({ type: 'error', message: `No active tab found for provider: ${provider}` }));
          return;
        }

        const activeTab = tabs[0];
        
        // Forward prompt to content script
        chrome.tabs.sendMessage(activeTab.id, { type: 'execute_prompt', provider, prompt }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('Content script not reachable:', chrome.runtime.lastError.message);
            socket.send(JSON.stringify({ 
              type: 'error', 
              message: 'Could not communicate with the ' + provider + ' page. Please REFRESH the AI browser tab and try again.' 
            }));
          }
        });
      }
    } catch (e) {
      console.error('WebSocket message handling error:', e);
    }
  };

  socket.onclose = () => {
    console.log('WebSocket connection closed. Retrying in 5 seconds...');
    if (pingInterval) clearInterval(pingInterval);
    setTimeout(connectWebSocket, 5000);
  };
}

connectWebSocket();

// Listen for messages from content scripts to forward back to VS Code
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    if (request.type === 'token') {
      socket.send(JSON.stringify({ type: 'token', text: request.text }));
    } else if (request.type === 'done') {
      socket.send(JSON.stringify({ type: 'done' }));
    } else if (request.type === 'error') {
      socket.send(JSON.stringify({ type: 'error', message: request.message }));
    }
  }
});
