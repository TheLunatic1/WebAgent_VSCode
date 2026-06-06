# WebAgent VSCode

WebAgent VSCode is an autonomous AI coding agent extension that connects directly to your existing browser sessions for ChatGPT Web, Gemini Web, and local Ollama instances. By leveraging Playwright for browser automation, it requires **no API keys** while providing full access to consumer models like ChatGPT Plus, Gemini Advanced, and local Llama instances.

## Core Features
- **No API Keys Required**: Reuses your existing browser session.
- **Provider System**: Supports ChatGPT Web, Gemini Web, and Ollama.
- **Agent Loop**: Fully autonomous execution (THINK → ACT → OBSERVE).
- **Tools Capability**: Can read, edit, delete files, run terminal commands, and perform Git operations.
- **Safety**: Built-in approval dialogs for destructive actions.
- **Context Management**: Gathers project summary, file tree, and open tab information.

## Getting Started (Development)

### Requirements
- Node.js (v18+)
- Playwright browsers installed
- VS Code (v1.80+)

### Build Instructions
1. Install dependencies:
   ```bash
   npm install
   ```
2. Install Playwright browsers:
   ```bash
   npx playwright install chromium
   ```
3. Compile the extension:
   ```bash
   npm run compile
   ```
4. Press `F5` in VS Code to run the extension in the Extension Development Host.

### Usage
1. Open the WebAgent panel in the activity bar.
2. Select your provider (ChatGPT Web, Gemini Web, or Ollama).
3. If using ChatGPT or Gemini, a browser window will open automatically. Please log in if you haven't already.
4. Start chatting or give the agent a complex multi-step objective!

## Production Deployment Guide

### Packaging the Extension
1. Install VS Code Extension Manager (vsce):
   ```bash
   npm install -g @vscode/vsce
   ```
2. Package the extension into a `.vsix` file:
   ```bash
   vsce package
   ```
   *Note: Ensure all fields like publisher, icon, and repository are set in `package.json` before packaging.*

### Publishing to VS Code Marketplace
1. Obtain a Personal Access Token (PAT) from Azure DevOps.
2. Create a publisher on the [Visual Studio Code Marketplace](https://marketplace.visualstudio.com/manage).
3. Publish using `vsce`:
   ```bash
   vsce publish
   ```
   *Alternatively, upload the `.vsix` file directly through the Marketplace publisher portal.*

## Project Structure
- `src/agent`: Core Agent runtime loop and memory.
- `src/browser`: Playwright automation and context management.
- `src/providers`: LLM integrations (ChatGPT, Gemini, Ollama).
- `src/tools`: File system, Git, and terminal integrations.
- `src/ui`: ChatPanelProvider and VS Code Webview logic.
