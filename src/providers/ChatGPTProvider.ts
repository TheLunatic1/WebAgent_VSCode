import { AIProvider } from './AIProvider';
import { BrowserManager } from '../browser/BrowserManager';
import { Page } from 'playwright';

export class ChatGPTProvider implements AIProvider {
    private page: Page | null = null;

    async isConnected(): Promise<boolean> {
        try {
            const browser = BrowserManager.getInstance();
            this.page = await browser.getPage('chatgpt.com');
            if (this.page.isClosed()) return false;
            
            if (!this.page.url().includes('chatgpt.com')) {
                await this.page.evaluate(() => { window.location.href = 'https://chatgpt.com'; });
                await this.page.waitForLoadState('domcontentloaded', { timeout: 30000 });
            }
            // Wait for input area to be ready
            await this.page.waitForSelector('#prompt-textarea, [contenteditable="true"]', { timeout: 10000 });
            return true;
        } catch (e) {
            return false;
        }
    }

    async createConversation(): Promise<void> {
        try {
            const browser = BrowserManager.getInstance();
            this.page = await browser.getPage('chatgpt.com');
            await this.page.evaluate(() => { window.location.href = 'https://chatgpt.com'; });
            await this.page.waitForLoadState('domcontentloaded', { timeout: 30000 });
            await this.page.bringToFront();
        } catch (e: any) {
            throw new Error("Failed to open ChatGPT: " + e.message);
        }
    }

    async resetConversation(): Promise<void> {
        await this.createConversation();
    }

    async sendMessage(prompt: string): Promise<string> {
        let fullResponse = '';
        for await (const chunk of this.streamMessage(prompt)) {
            fullResponse += chunk;
        }
        return fullResponse;
    }

    async *streamMessage(prompt: string): AsyncGenerator<string> {
        if (!this.page || this.page.isClosed()) {
            const connected = await this.isConnected();
            if (!connected) throw new Error("ChatGPT is not connected or logged in.");
        }

        if (!this.page) throw new Error("Page not initialized.");

        // Fill prompt and send
        const inputSelector = '#prompt-textarea, [contenteditable="true"]';
        const inputArea = this.page.locator(inputSelector).first();
        await inputArea.click();
        await this.page.waitForTimeout(200);
        await inputArea.fill(prompt);
        await this.page.waitForTimeout(500);
        
        // Try to click the send button directly, fallback to Enter
        const sendBtn = this.page.locator('[data-testid="send-button"], button[aria-label="Send message"]').first();
        if (await sendBtn.isVisible().catch(() => false)) {
            await sendBtn.click();
        } else {
            await this.page.keyboard.press('Enter');
        }

        // Logic to monitor streaming response
        // Playwright logic to find the latest assistant message and yield differences
        let lastText = '';
        let isGenerating = true;
        let idleCount = 0;

        // Give it a moment to start generating
        await this.page.waitForTimeout(1500);

        while (isGenerating) {
            const messages = await this.page.$$('[data-message-author-role="assistant"]');
            if (messages.length === 0) continue;

            const latestMessage = messages[messages.length - 1];
            const text = await latestMessage.textContent() || '';

            if (text !== lastText) {
                yield text;
                lastText = text;
                idleCount = 0; // Reset idle count since text is still changing
            }

            // Check if generation stopped
            // 1. Look for stop button
            const stopButton = await this.page.$('button[aria-label="Stop generating"]');
            
            // 2. Look for streaming class on message
            const isStreamingClass = await latestMessage.evaluate(el => el.className.includes('result-streaming') || el.className.includes('generating'));
            
            if (!stopButton && !isStreamingClass) {
                idleCount++;
                if (idleCount > 15) { // 1.5 seconds of no generating indicators
                    isGenerating = false;
                }
            } else {
                idleCount = 0;
            }

            await this.page.waitForTimeout(100);
        }

        // Final check for missed text
        const messagesFinal = await this.page.$$('[data-message-author-role="assistant"]');
        if (messagesFinal.length > 0) {
            const latestMessage = messagesFinal[messagesFinal.length - 1];
            const text = await latestMessage.textContent() || '';
            if (text !== lastText) {
                yield text;
            }
        }
    }
}
