import { AIProvider } from './AIProvider';
import { WebSocketManager } from '../browser/WebSocketManager';

export class GrokProvider implements AIProvider {
    async isConnected(): Promise<boolean> {
        return WebSocketManager.getInstance().hasClients();
    }

    async createConversation(): Promise<void> {
    }

    async resetConversation(): Promise<void> {
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
        yield* wsManager.streamMessage('grok', prompt);
    }
}
