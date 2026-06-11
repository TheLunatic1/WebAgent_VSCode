import * as vscode from 'vscode';
import { AIProvider } from './AIProvider';
import { ChatGPTProvider } from './ChatGPTProvider';
import { GeminiProvider } from './GeminiProvider';
import { GrokProvider } from './GrokProvider';
import { DeepSeekProvider } from './DeepSeekProvider';
import { OllamaProvider } from './OllamaProvider';
import { CustomProvider } from './CustomProvider';

export class ProviderManager {
    private currentProvider: AIProvider | null = null;
    private currentProviderName: string = '';

    constructor(private context: vscode.ExtensionContext) {
        const config = vscode.workspace.getConfiguration('webagent');
        const defaultProvider = config.get<string>('defaultProvider', 'chatgpt');
        this.setProvider(defaultProvider);
    }

    public async setProvider(providerName: string): Promise<void> {
        if (this.currentProviderName === providerName && this.currentProvider) {
            return;
        }

        switch (providerName) {
            case 'chatgpt':
                this.currentProvider = new ChatGPTProvider();
                break;
            case 'gemini':
                this.currentProvider = new GeminiProvider();
                break;
            case 'grok':
                this.currentProvider = new GrokProvider();
                break;
            case 'deepseek':
                this.currentProvider = new DeepSeekProvider();
                break;
            case 'ollama':
                const config = vscode.workspace.getConfiguration('webagent');
                const url = config.get<string>('ollamaUrl', 'http://localhost:11434');
                const model = config.get<string>('ollamaModel', 'llama3');
                this.currentProvider = new OllamaProvider(url, model);
                break;
            case 'custom':
                const customConfig = vscode.workspace.getConfiguration('webagent');
                const customUrl = customConfig.get<string>('customApiUrl', 'http://localhost:1234/v1/chat/completions');
                const customKey = customConfig.get<string>('customApiKey', '');
                const customModel = customConfig.get<string>('customModel', 'local-model');
                this.currentProvider = new CustomProvider(customUrl, customKey, customModel);
                break;
            default:
                this.currentProvider = new ChatGPTProvider();
                providerName = 'chatgpt';
                break;
        }

        this.currentProviderName = providerName;
    }

    public getCurrentProvider(): AIProvider | null {
        return this.currentProvider;
    }

    public getCurrentProviderName(): string {
        return this.currentProviderName;
    }
}
