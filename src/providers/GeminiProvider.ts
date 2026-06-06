import { AIProvider } from './AIProvider';
import { BrowserManager } from '../browser/BrowserManager';
import { Page } from 'playwright';

export class GeminiProvider implements AIProvider {
    private page: Page | null = null;

    async isConnected(): Promise<boolean> {
        try {
            const browser = BrowserManager.getInstance();
            this.page = await browser.getPage('gemini.google.com');
            if (this.page.isClosed()) return false;
            
            if (!this.page.url().includes('gemini.google.com')) {
                await this.page.evaluate(() => { window.location.href = 'https://gemini.google.com/app'; });
                await this.page.waitForLoadState('domcontentloaded', { timeout: 30000 });
            }
            // Wait for input area using robust selector
            await this.page.waitForSelector('rich-textarea, .rich-textarea, [contenteditable="true"]', { timeout: 10000 });
            return true;
        } catch (e) {
            return false;
        }
    }

    async createConversation(): Promise<void> {
        try {
            const browser = BrowserManager.getInstance();
            this.page = await browser.getPage('gemini.google.com');
            await this.page.evaluate(() => { window.location.href = 'https://gemini.google.com/app'; });
            await this.page.waitForLoadState('domcontentloaded', { timeout: 30000 });
            await this.page.bringToFront();
        } catch (e: any) {
            throw new Error("Failed to open Gemini: " + e.message);
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
            if (!connected) throw new Error("Gemini is not connected or logged in.");
        }

        if (!this.page) throw new Error("Page not initialized.");

        // Fill prompt and send
        const inputSelector = 'rich-textarea, .rich-textarea, [contenteditable="true"]';
        const inputArea = this.page.locator(inputSelector).first();
        await inputArea.click();
        await this.page.waitForTimeout(200);
        // Using fill is safer for Angular state sync than insertText
        await inputArea.fill(prompt);
        await this.page.waitForTimeout(500);
        
        // Try to click the send button directly, fallback to Enter
        const sendBtn = this.page.locator('button[aria-label="Send message"], button[aria-label="Send"], .send-button').first();
        if (await sendBtn.isVisible().catch(() => false)) {
            await sendBtn.click();
        } else {
            await this.page.keyboard.press('Enter');
        }

        let lastText = '';
        let isGenerating = true;
        let idleCount = 0;

        await this.page.waitForTimeout(1500);

        while (isGenerating) {
            const messages = await this.page.$$('message-content');
            if (messages.length === 0) continue;

            const latestMessage = messages[messages.length - 1];
            const text = await latestMessage.textContent() || '';

            if (text !== lastText) {
                yield text;
                lastText = text;
                idleCount = 0; // Reset idle count since text is still changing
            }

            // In Gemini, check for the loading indicator
            const isGeneratingElement = await this.page.$('loading-indicator');
            
            if (!isGeneratingElement) {
                idleCount++;
                if (idleCount > 15) { // 1.5 seconds of no generating indicators
                    isGenerating = false;
                }
            } else {
                idleCount = 0;
            }

            await this.page.waitForTimeout(100);
        }

        // Final check
        const messagesFinal = await this.page.$$('message-content');
        if (messagesFinal.length > 0) {
            const latestMessage = messagesFinal[messagesFinal.length - 1];
            const text = await latestMessage.textContent() || '';
            if (text !== lastText) {
                yield text;
            }
        }
    }
}
