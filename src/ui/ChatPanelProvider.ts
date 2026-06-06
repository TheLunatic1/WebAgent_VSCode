import * as vscode from 'vscode';
import { ProviderManager } from '../providers/ProviderManager';
import { Agent } from '../agent/Agent';

export class ChatPanelProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'webagentSidebar';
    private _view?: vscode.WebviewView;
    private providerManager: ProviderManager;
    private agent?: Agent;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _context: vscode.ExtensionContext
    ) {
        this.providerManager = new ProviderManager(_context);
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'sendMessage':
                    await this.handleMessage(data.value, data.mode);
                    break;
                case 'changeProvider':
                    await this.providerManager.setProvider(data.value);
                    if (this.agent) {
                        const newProvider = this.providerManager.getCurrentProvider();
                        if (newProvider) {
                            this.agent.setProvider(newProvider);
                        }
                    }
                    webviewView.webview.postMessage({ type: 'providerChanged', value: data.value });
                    break;
                case 'openLogin':
                    const p = this.providerManager.getCurrentProvider();
                    if (p && p.createConversation) {
                        try {
                            await p.createConversation();
                        } catch (e: any) {
                            webviewView.webview.postMessage({ type: 'error', value: e.message });
                        }
                    }
                    break;
                case 'saveSettings':
                    const config = vscode.workspace.getConfiguration('webagent');
                    await config.update('ollamaUrl', data.settings.ollamaUrl, true);
                    await config.update('ollamaModel', data.settings.ollamaModel, true);
                    await config.update('customApiUrl', data.settings.customApiUrl, true);
                    await config.update('customApiKey', data.settings.customApiKey, true);
                    await config.update('customModel', data.settings.customModel, true);
                    vscode.window.showInformationMessage("WebAgent settings saved!");
                    break;
            }
        });
    }

    private async handleMessage(prompt: string, mode: string = 'agent') {
        if (!this._view) { return; }

        try {
            const provider = this.providerManager.getCurrentProvider();
            if (!provider) {
                throw new Error("No provider selected or provider is unavailable.");
            }

            if (!this.agent) {
                this.agent = new Agent(provider, (chunk, isSystem) => {
                    if (isSystem) {
                        this._view?.webview.postMessage({ type: 'systemMessage', value: chunk });
                    } else {
                        this._view?.webview.postMessage({ type: 'streamChunk', value: chunk });
                    }
                });
            } else {
                this.agent.setProvider(provider);
            }

            this._view.webview.postMessage({ type: 'streamStart' });
            
            // Gather context from the currently open file
            let contextStr = '';
            const activeEditor = vscode.window.activeTextEditor;
            if (activeEditor) {
                const doc = activeEditor.document;
                if (doc.uri.scheme === 'file') {
                    const relativePath = vscode.workspace.asRelativePath(doc.uri);
                    const content = doc.getText();
                    contextStr = `\n\n[System Context: The user currently has this file open in their editor:\nFile Path: ${relativePath}\nContents:\n\`\`\`\n${content}\n\`\`\`\n]`;
                }
            }

            // Execute Agent Task
            await this.agent.executeTask(prompt + contextStr, mode);

            this._view.webview.postMessage({ type: 'streamEnd' });
        } catch (error: any) {
            this._view.webview.postMessage({ type: 'error', value: error.message });
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const config = vscode.workspace.getConfiguration('webagent');
        const ollamaUrl = config.get<string>('ollamaUrl', 'http://localhost:11434');
        const ollamaModel = config.get<string>('ollamaModel', 'llama3');
        const customUrl = config.get<string>('customApiUrl', 'http://localhost:1234/v1/chat/completions');
        const customKey = config.get<string>('customApiKey', '');
        const customModel = config.get<string>('customModel', 'local-model');

        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>WebAgent Chat</title>
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    color: var(--vscode-editor-foreground);
                    background-color: transparent;
                    display: flex;
                    flex-direction: column;
                    height: 100vh;
                    margin: 0;
                    padding: 16px;
                    box-sizing: border-box;
                    font-size: var(--vscode-editor-font-size);
                    gap: 10px;
                }
                .provider-bar {
                    display: flex;
                    gap: 10px;
                    flex-wrap: wrap;
                    align-items: flex-end;
                    padding-bottom: 10px;
                    border-bottom: 1px solid var(--vscode-panel-border);
                }
                .provider-bar > div {
                    flex: 1;
                    min-width: 80px;
                }
                .provider-bar select {
                    width: 100%;
                }
                #settings-panel {
                    display: none;
                    flex-direction: column;
                    gap: 10px;
                    padding: 10px;
                    background: var(--vscode-editorWidget-background);
                    border: 1px solid var(--vscode-widget-border);
                    border-radius: 4px;
                    margin-bottom: 10px;
                }
                .setting-row {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }
                .setting-row input {
                    background: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border: 1px solid var(--vscode-input-border);
                    padding: 4px 6px;
                    border-radius: 2px;
                }
                #chat-history {
                    flex: 1;
                    overflow-y: auto;
                    display: flex;
                    flex-direction: column;
                    gap: 15px;
                    padding-right: 5px;
                }
                .message {
                    line-height: 1.5;
                    word-wrap: break-word;
                    color: var(--vscode-foreground);
                    padding: 0;
                    margin: 0;
                    background: transparent;
                    max-width: 90%;
                }
                .message.user {
                    font-weight: normal;
                    align-self: flex-end;
                    background-color: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                    border-radius: 8px;
                    padding: 10px 14px;
                }
                .message.user strong {
                    display: none; /* Hide 'You' title for cleaner look */
                }
                .message.ai {
                    font-weight: normal;
                    align-self: flex-start;
                }
                .system-log {
                    font-style: italic;
                    color: var(--vscode-descriptionForeground);
                    margin: 0;
                    padding: 0;
                    white-space: pre-wrap;
                }
                .final-answer {
                    white-space: pre-wrap;
                    margin-top: 5px;
                }
                details.thought-process {
                    margin: 0;
                    padding: 0;
                }
                details.thought-process summary {
                    cursor: pointer;
                    font-style: italic;
                    color: var(--vscode-descriptionForeground);
                    user-select: none;
                    margin: 0;
                    padding: 0;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .thought-content {
                    font-style: italic;
                    color: var(--vscode-descriptionForeground);
                    white-space: pre-wrap;
                    word-wrap: break-word;
                    word-break: break-word;
                    margin: 0;
                    padding: 0;
                }
                .action-box {
                    font-style: italic;
                    color: var(--vscode-descriptionForeground);
                    margin: 0;
                    padding: 0;
                }
                #input-container {
                    display: flex;
                    flex-direction: column;
                    gap: 5px;
                    padding: 10px;
                    border-top: 1px solid var(--vscode-panel-border);
                }
                textarea {
                    width: 100%;
                    resize: none;
                    box-sizing: border-box;
                    background: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 2px;
                    padding: 8px;
                    font-family: inherit;
                }
                button {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    border-radius: 2px;
                    padding: 8px;
                    cursor: pointer;
                    font-weight: 600;
                }
                button:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }
                select {
                    background: var(--vscode-dropdown-background);
                    color: var(--vscode-dropdown-foreground);
                    border: 1px solid var(--vscode-dropdown-border);
                    padding: 4px;
                    width: 100%;
                    margin-bottom: 5px;
                    border-radius: 2px;
                }
            </style>
        </head>
        <body>
            <div class="provider-bar">
                <div>
                    <label style="font-size: 0.8em; opacity: 0.8; display: block; margin-bottom: 2px;">Provider</label>
                    <select id="provider-select">
                        <option value="chatgpt">ChatGPT</option>
                        <option value="gemini">Gemini</option>
                        <option value="ollama">Ollama</option>
                        <option value="custom">Custom (OpenAI)</option>
                    </select>
                </div>
                <div>
                    <label style="font-size: 0.8em; opacity: 0.8; display: block; margin-bottom: 2px;">Mode</label>
                    <select id="mode-select">
                        <option value="agent">Agent</option>
                        <option value="chat">Chat</option>
                        <option value="plan">Plan</option>
                    </select>
                </div>
                <button id="open-browser-btn" style="padding: 4px 8px; font-size: 0.9em; height: 26px;">Browser</button>
                <button id="settings-btn" style="padding: 4px 8px; font-size: 0.9em; height: 26px;">⚙️</button>
            </div>
            <div id="settings-panel">
                <div class="setting-row">
                    <label>Ollama URL</label>
                    <input type="text" id="set-ollama-url" value="${ollamaUrl}" />
                </div>
                <div class="setting-row">
                    <label>Ollama Model</label>
                    <input type="text" id="set-ollama-model" value="${ollamaModel}" />
                </div>
                <div class="setting-row">
                    <label>Custom API URL</label>
                    <input type="text" id="set-custom-url" value="${customUrl}" />
                </div>
                <div class="setting-row">
                    <label>Custom API Key</label>
                    <input type="password" id="set-custom-key" value="${customKey}" />
                </div>
                <div class="setting-row">
                    <label>Custom Model</label>
                    <input type="text" id="set-custom-model" value="${customModel}" />
                </div>
                <button id="save-settings-btn" style="margin-top: 5px;">Save Settings</button>
            </div>
            <div id="chat-history"></div>
            <div id="input-container">
                <textarea id="prompt-input" rows="1" placeholder="Ask WebAgent..."></textarea>
                <button id="send-btn">Send</button>
            </div>

            <script>
                const vscode = acquireVsCodeApi();
                
                const chatHistory = document.getElementById('chat-history');
                const promptInput = document.getElementById('prompt-input');
                const sendBtn = document.getElementById('send-btn');
                const providerSelect = document.getElementById('provider-select');
                const modeSelect = document.getElementById('mode-select');
                const openBrowserBtn = document.getElementById('open-browser-btn');
                const settingsBtn = document.getElementById('settings-btn');
                const settingsPanel = document.getElementById('settings-panel');
                const saveSettingsBtn = document.getElementById('save-settings-btn');
                
                let currentMessageElement = null;

                settingsBtn.addEventListener('click', () => {
                    settingsPanel.style.display = settingsPanel.style.display === 'none' ? 'flex' : 'none';
                });

                saveSettingsBtn.addEventListener('click', () => {
                    vscode.postMessage({
                        type: 'saveSettings',
                        settings: {
                            ollamaUrl: document.getElementById('set-ollama-url').value,
                            ollamaModel: document.getElementById('set-ollama-model').value,
                            customApiUrl: document.getElementById('set-custom-url').value,
                            customApiKey: document.getElementById('set-custom-key').value,
                            customModel: document.getElementById('set-custom-model').value
                        }
                    });
                    settingsPanel.style.display = 'none';
                });

                promptInput.addEventListener('input', function() {
                    this.style.height = 'auto';
                    this.style.height = Math.min(this.scrollHeight, 150) + 'px';
                });

                function escapeHtml(unsafe) {
                    return (unsafe || '').toString()
                         .replace(/&/g, "&amp;")
                         .replace(/</g, "&lt;")
                         .replace(/>/g, "&gt;")
                         .replace(/"/g, "&quot;")
                         .replace(/'/g, "&#039;");
                }

                function parseMarkdown(text) {
                    return escapeHtml(text)
                        .replace(/\`\`\`([\\s\\S]*?)\`\`\`/g, '<pre style="background:var(--vscode-textCodeBlock-background);padding:8px;border-radius:4px;overflow-x:auto;"><code>$1</code></pre>')
                        .replace(/\`([^\`]+)\`/g, '<code style="background:var(--vscode-textCodeBlock-background);padding:2px 4px;border-radius:3px;">$1</code>')
                        .replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>')
                        .replace(/\\*(.*?)\\*/g, '<em>$1</em>')
                        .replace(/\\n/g, '<br/>');
                }

                function formatAgentMessage(rawText) {
                    let thoughtText = "Thinking...";
                    let actionText = "";

                    const thoughtMatch = rawText.match(/<thought>([\\s\\S]*?)(?:<\\/thought>|$)/i);
                    if (thoughtMatch) thoughtText = thoughtMatch[1].trim();

                    const actionMatch = rawText.match(/<action>([\\s\\S]*?)(?:<\\/action>|$)/i);
                    if (actionMatch) {
                        const actionContent = actionMatch[1];
                        const toolMatch = actionContent.match(/action_name:\\s*(.+)/i);
                        const pathMatch = actionContent.match(/path:\\s*(.+)/i);
                        if (toolMatch) {
                            const t = toolMatch[1].trim();
                            const p = pathMatch ? pathMatch[1].trim() : '';
                            actionText = \`<strong>\${t}</strong> \${p ? '(' + p + ')' : ''}\`;
                            if (t === 'finish') actionText = '<strong>Task Finished ✅</strong>';
                        } else {
                            actionText = "<em>Preparing action...</em>";
                        }
                    }

                    if (!thoughtMatch && !actionMatch && !rawText.includes('<thought>')) {
                        // Attempt JSON parsing as fallback for older messages
                        try {
                            const parsed = JSON.parse(rawText);
                            if (parsed.thought) thoughtText = parsed.thought;
                            if (parsed.action && parsed.action.tool) {
                                actionText = \`<strong>\${parsed.action.tool}</strong>\`;
                                if (parsed.action.tool === 'finish') actionText = '<strong>Task Finished ✅</strong>';
                            }
                            if (!parsed.thought && !parsed.action) return escapeHtml(rawText);
                        } catch (e) {
                            if (!rawText.includes('"thought"')) return escapeHtml(rawText);
                        }
                    }

                    let thoughtPreview = thoughtText.substring(0, 50).replace(/\\n/g, ' ');
                    if (thoughtText.length > 50) thoughtPreview += '...';

                    return \`
                        <details class="thought-process">
                            <summary>Thinking: \${escapeHtml(thoughtPreview)}</summary>
                            <div class="thought-content">\${escapeHtml(thoughtText)}</div>
                        </details>
                        \${actionText ? \`<div class="action-box">\${actionText}</div>\` : ''}
                    \`;
                }

                openBrowserBtn.addEventListener('click', () => {
                    vscode.postMessage({ type: 'openLogin' });
                });

                sendBtn.addEventListener('click', () => {
                    const text = promptInput.value.trim();
                    if (!text) return;

                    const userMsg = document.createElement('div');
                    userMsg.className = 'message user';
                    userMsg.textContent = text;
                    chatHistory.appendChild(userMsg);

                    vscode.postMessage({ type: 'sendMessage', value: text, mode: modeSelect.value });
                    promptInput.value = '';
                    promptInput.style.height = 'auto';
                });

                providerSelect.addEventListener('change', (e) => {
                    vscode.postMessage({ type: 'changeProvider', value: e.target.value });
                });

                window.addEventListener('message', event => {
                    const message = event.data;
                    switch (message.type) {
                        case 'streamStart':
                            // Let streamChunk handle creation
                            break;
                        case 'streamChunk':
                            const formatted = formatAgentMessage(message.value);
                            if (formatted.trim() !== '') {
                                if (!currentMessageElement) {
                                    currentMessageElement = document.createElement('div');
                                    currentMessageElement.className = 'message ai';
                                    chatHistory.appendChild(currentMessageElement);
                                }
                                currentMessageElement.innerHTML = formatted;
                                chatHistory.scrollTop = chatHistory.scrollHeight;
                            }
                            break;
                        case 'systemMessage':
                            const sysMsg = document.createElement('div');
                            const textContent = message.value.trim();
                            if (textContent.includes('[Agent Final Answer]')) {
                                sysMsg.className = 'message ai final-answer';
                                const rawAns = textContent.replace('[Agent Final Answer]:', '').trim();
                                sysMsg.innerHTML = parseMarkdown(rawAns);
                            } else if (textContent.startsWith('[Changed Files]:')) {
                                sysMsg.className = 'system-log';
                                const files = textContent.replace('[Changed Files]:', '').trim().split(',');
                                let html = '<div style="margin-top:10px; font-size: 0.9em; opacity: 0.8; font-style: normal;"><strong>Files Changed:</strong><ul style="margin:4px 0; padding-left:20px;">';
                                files.forEach(f => {
                                    if(f) html += \`<li>\${escapeHtml(f)}</li>\`;
                                });
                                html += '</ul></div>';
                                sysMsg.innerHTML = html;
                            } else if (textContent.startsWith('[Agent Executing Tool]:')) {
                                sysMsg.className = 'system-log';
                                const toolName = textContent.replace('[Agent Executing Tool]:', '').trim();
                                sysMsg.innerHTML = \`<details class="thought-process"><summary>Executing: \${escapeHtml(toolName)}</summary><div class="thought-content">\${escapeHtml(textContent)}</div></details>\`;
                            } else if (textContent.startsWith('[Tool Result]:')) {
                                sysMsg.className = 'system-log';
                                const resultText = textContent.replace('[Tool Result]:', '').trim();
                                let resultPreview = resultText.substring(0, 50).replace(/\\n/g, ' ');
                                if (resultText.length > 50) resultPreview += '...';
                                sysMsg.innerHTML = \`<details class="thought-process"><summary>Result: \${escapeHtml(resultPreview)}</summary><div class="thought-content">\${escapeHtml(resultText)}</div></details>\`;
                            } else {
                                sysMsg.className = 'system-log';
                                sysMsg.textContent = textContent;
                            }
                            chatHistory.appendChild(sysMsg);
                            currentMessageElement = null; // Next stream chunk starts fresh
                            chatHistory.scrollTop = chatHistory.scrollHeight;
                            break;
                        case 'streamEnd':
                            currentMessageElement = null;
                            break;
                        case 'error':
                            const errorMsg = document.createElement('div');
                            errorMsg.className = 'message ai';
                            errorMsg.style.color = 'red';
                            errorMsg.textContent = 'Error: ' + message.value;
                            chatHistory.appendChild(errorMsg);
                            chatHistory.scrollTop = chatHistory.scrollHeight;
                            break;
                        case 'providerChanged':
                            providerSelect.value = message.value;
                            break;
                    }
                });
            </script>
        </body>
        </html>`;
    }
}
