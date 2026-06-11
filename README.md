# WebAgent VSCode (Beta)

WebAgent VSCode is an autonomous AI coding agent extension that connects directly to your existing browser sessions for **ChatGPT, Gemini, Grok, and DeepSeek**. 

Instead of relying on fragile browser automation or requiring expensive API keys, WebAgent uses a lightweight **Chrome Extension Bridge** to communicate seamlessly with your active web AI sessions. It acts as your autonomous co-pilot, capable of reading files, writing code, running terminal commands, and managing your workspace.

## 🚧 Important: Beta Status
WebAgent is currently in **Public Beta**. To use the web AI providers (ChatGPT, Gemini, Grok, DeepSeek), **you must manually install the companion Chrome Extension.**

## Core Features
- **No API Keys Required**: Reuses your existing browser session and Plus/Advanced subscriptions.
- **Provider System**: Supports ChatGPT, Gemini, Grok, DeepSeek, and local Ollama models.
- **Agent Loop**: Fully autonomous execution (THINK → ACT → OBSERVE) with strict JSON tool usage.
- **Tools Capability**: Can read, edit, delete files, and run terminal commands.
- **Safety First**: Built-in approval dialogs for destructive actions.

---

## 🛠️ Setup Instructions

To use WebAgent, you need to set up both the VS Code Extension and the Chrome Companion Extension.

### Part 1: Install the Chrome Companion Extension
Because WebAgent controls your web sessions, it requires a secure Chrome Extension Bridge to send prompts and read responses.

1. Clone or download this repository.
2. Open Google Chrome (or Edge/Brave) and navigate to `chrome://extensions`.
3. Enable **Developer mode** (toggle in the top right corner).
4. Click **Load unpacked** and select the `chrome-extension` folder located inside this repository.
5. **CRITICAL**: Refresh any open ChatGPT, Gemini, Grok, or DeepSeek tabs you already have open so the extension can inject its script.

### Part 2: Run the VS Code Extension
*(Note: If you downloaded this from the VS Code Marketplace, you can skip to step 3).*

1. Install dependencies:
   ```bash
   npm install
   ```
2. Press `F5` in VS Code to compile and launch the Extension Development Host.
3. Open the WebAgent panel in the activity bar.
4. Select your provider in the settings (e.g., ChatGPT, Gemini).
5. Ensure your chosen AI provider is open in a Chrome tab and logged in.
6. Type a prompt like: *"Write a python script that prints the fibonacci sequence and save it to my workspace"* and watch it work!

---

## Project Structure
- `src/agent`: Core Agent runtime loop and strict JSON-based prompt parsing.
- `src/browser`: WebSocket server managing the connection to the Chrome Extension.
- `src/providers`: Integration layers routing messages to the WebSocket or local instances.
- `src/tools`: File system and terminal integrations.
- `chrome-extension/`: The companion Manifest V3 browser extension acting as the bridge.

## Contributing
We welcome contributions! Feel free to submit Pull Requests to add more providers, improve DOM selectors in the Chrome extension, or enhance the VS Code UI.
