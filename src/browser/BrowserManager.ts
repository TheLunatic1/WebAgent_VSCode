import { BrowserContext, Page, chromium } from 'playwright';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

import * as vscode from 'vscode';

export class BrowserManager {
    private static instance: BrowserManager;
    private context: BrowserContext | null = null;
    
    private constructor() {}

    public static getInstance(): BrowserManager {
        if (!BrowserManager.instance) {
            BrowserManager.instance = new BrowserManager();
        }
        return BrowserManager.instance;
    }

    private getDefaultChromeUserDataDir(): string {
        const platform = os.platform();
        if (platform === 'win32') {
            return path.join(os.homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'User Data');
        } else if (platform === 'darwin') {
            return path.join(os.homedir(), 'Library', 'Application Support', 'Google', 'Chrome');
        } else {
            return path.join(os.homedir(), '.config', 'google-chrome');
        }
    }

    public async getContext(): Promise<BrowserContext> {
        if (this.context) {
            try {
                this.context.pages(); // Will throw if context is closed
            } catch (e) {
                this.context = null;
            }
        }

        if (this.context) {
            return this.context;
        }

        try {
            // 1. Try to connect to user's existing Chrome if debugging port is open
            const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
            this.context = browser.contexts()[0];
            if (!this.context) {
                this.context = await browser.newContext();
            }
            browser.on('disconnected', () => { this.context = null; });
            return this.context;
        } catch (e: any) {
            console.log("CDP connection failed: ", e.message);
        }

        // 2. If CDP failed, try to natively spawn Chrome with the debugging port
        let chromePath = '';
        const platform = os.platform();
        if (platform === 'win32') {
            chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
            if (!fs.existsSync(chromePath)) {
                chromePath = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
            }
        } else if (platform === 'darwin') {
            chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
        } else {
            chromePath = '/usr/bin/google-chrome';
        }

        if (fs.existsSync(chromePath)) {
            const cp = require('child_process');
            const userDataDir = path.join(os.homedir(), '.webagent-browser-profile');
            if (!fs.existsSync(userDataDir)) {
                fs.mkdirSync(userDataDir, { recursive: true });
            }

            vscode.window.showInformationMessage("Starting WebAgent dedicated browser...");
            const child = cp.spawn(chromePath, [
                `--user-data-dir=${userDataDir}`,
                '--remote-debugging-port=9222', 
                '--no-first-run',
                '--no-default-browser-check',
                '--restore-last-session'
            ], {
                detached: true,
                stdio: 'ignore'
            });
            child.unref();

            // Wait for Chrome to spin up
            await new Promise(resolve => setTimeout(resolve, 3500));

            try {
                const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
                this.context = browser.contexts()[0];
                if (!this.context) {
                    this.context = await browser.newContext();
                }
                browser.on('disconnected', () => { this.context = null; });
                return this.context;
            } catch (err: any) {
                vscode.window.showErrorMessage("Could not connect to Chrome. Make sure ALL Chrome windows are fully closed before running.");
                throw new Error("Chrome profile locked. Close all Chrome windows and try again.");
            }
        }

        throw new Error("Could not find Google Chrome installation.");
    }

    public async getPage(urlDomain: string): Promise<Page> {
        const context = await this.getContext();
        const pages = context.pages();
        
        // Find existing page matching domain
        for (const page of pages) {
            if (page.url().includes(urlDomain)) {
                return page;
            }
        }

        // Create new page if not found
        const newPage = await context.newPage();
        return newPage;
    }

    public async close() {
        if (this.context) {
            await this.context.close();
            this.context = null;
        }
    }
}
