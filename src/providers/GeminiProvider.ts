import { AIProvider } from './AIProvider';
import { WebSocketManager } from '../browser/WebSocketManager';

export class GeminiProvider implements AIProvider {
    async isConnected(): Promise<boolean> {
        return WebSocketManager.getInstance().hasClients();
    }

    async createConversation(): Promise<void> {
        // Handled by the Chrome Extension
    }

    async resetConversation(): Promise<void> {
        // Handled by the Chrome Extension
    }

    async sendMessage(prompt: string): Promise<string> {
        let fullResponse = '';
        for await (const chunk of this.streamMessage(prompt)) {
            fullResponse += chunk;
        }
        return fullResponse;
    }

    async *streamMessage(prompt: string): AsyncGenerator<string> {
        const wsManager = WebSocketManager.getInstance();
        yield* wsManager.streamMessage('gemini', prompt);
    }
}
