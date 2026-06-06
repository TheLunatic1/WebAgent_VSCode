import * as vscode from 'vscode';
import { ChatPanelProvider } from './ui/ChatPanelProvider';

export function activate(context: vscode.ExtensionContext) {
    console.log('WebAgent is now active!');

    // Register Webview Sidebar
    const chatPanelProvider = new ChatPanelProvider(context.extensionUri, context);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(ChatPanelProvider.viewType, chatPanelProvider, {
            webviewOptions: { retainContextWhenHidden: true }
        })
    );

    // Register Start Chat Command
    let disposable = vscode.commands.registerCommand('webagent.startChat', () => {
        vscode.commands.executeCommand('workbench.view.extension.webagentContainer');
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {
    // Clean up resources, close browser sessions if necessary
}
