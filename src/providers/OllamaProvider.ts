import { AIProvider } from './AIProvider';
import * as http from 'http';

export class OllamaProvider implements AIProvider {
    private url: string;
    private model: string;
    private conversationHistory: any[] = [];

    constructor(url: string = 'http://localhost:11434', model: string = 'llama3') {
        this.url = url;
        this.model = model;
    }

    async isConnected(): Promise<boolean> {
        try {
            const response = await fetch(`${this.url}/api/tags`);
            return response.ok;
        } catch (e) {
            return false;
        }
    }

    async createConversation(): Promise<void> {
        this.conversationHistory = [];
    }

    async resetConversation(): Promise<void> {
        this.conversationHistory = [];
    }

    async sendMessage(prompt: string): Promise<string> {
        let fullResponse = '';
        for await (const chunk of this.streamMessage(prompt)) {
            fullResponse += chunk;
        }
        return fullResponse;
    }

    async *streamMessage(prompt: string): AsyncGenerator<string> {
        this.conversationHistory.push({ role: 'user', content: prompt });

        const response = await fetch(`${this.url}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: this.model,
                messages: this.conversationHistory,
                stream: true
            })
        });

        if (!response.body) {
            throw new Error('No response body from Ollama');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let aiResponse = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n').filter(line => line.trim());
            
            for (const line of lines) {
                try {
                    const parsed = JSON.parse(line);
                    if (parsed.message?.content) {
                        aiResponse += parsed.message.content;
                        yield aiResponse;
                    }
                } catch (e) {
                    // Ignore parse errors on incomplete chunks
                }
            }
        }

        this.conversationHistory.push({ role: 'assistant', content: aiResponse });
    }
}
