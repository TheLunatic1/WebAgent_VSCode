import { AIProvider } from './AIProvider';

export class CustomProvider implements AIProvider {
    private url: string;
    private apiKey: string;
    private model: string;
    private conversationHistory: any[] = [];

    constructor(url: string, apiKey: string, model: string) {
        this.url = url;
        this.apiKey = apiKey;
        this.model = model;
    }

    async isConnected(): Promise<boolean> {
        return true;
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

        const headers: Record<string, string> = {
            'Content-Type': 'application/json'
        };
        if (this.apiKey) {
            headers['Authorization'] = `Bearer ${this.apiKey}`;
        }

        const response = await fetch(this.url, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                model: this.model,
                messages: this.conversationHistory,
                stream: true
            })
        });

        if (!response.body) {
            throw new Error('No response body from Custom Provider');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let aiResponse = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n').filter(line => line.trim() && line.trim() !== 'data: [DONE]');
            
            for (const line of lines) {
                try {
                    let jsonStr = line;
                    if (jsonStr.startsWith('data: ')) {
                        jsonStr = jsonStr.substring(6);
                    }
                    const parsed = JSON.parse(jsonStr);
                    if (parsed.choices && parsed.choices[0]?.delta?.content) {
                        aiResponse += parsed.choices[0].delta.content;
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
