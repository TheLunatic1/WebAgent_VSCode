import * as vscode from 'vscode';
import { WebSocketServer, WebSocket } from 'ws';
import { EventEmitter } from 'events';

export class WebSocketManager extends EventEmitter {
    private static instance: WebSocketManager;
    private wss: WebSocketServer | null = null;
    private clients: Set<any> = new Set();
    
    private constructor() {
        super();
        this.initializeServer();
    }

    public static getInstance(): WebSocketManager {
        if (!WebSocketManager.instance) {
            WebSocketManager.instance = new WebSocketManager();
        }
        return WebSocketManager.instance;
    }

    private initializeServer() {
        try {
            this.wss = new WebSocketServer({ port: 8765 });
            
            this.wss.on('connection', (ws: any) => {
                console.log('Chrome Extension connected');
                this.clients.add(ws);

                ws.on('message', (message: any) => {
                    try {
                        const data = JSON.parse(message.toString());
                        if (data.type === 'token') {
                            this.emit('token', data.text);
                        } else if (data.type === 'status') {
                            this.emit('status', data.status);
                        } else if (data.type === 'done') {
                            this.emit('done');
                        } else if (data.type === 'error') {
                            this.emit('error', data.message);
                        }
                    } catch (e) {
                        console.error('Failed to parse WebSocket message', e);
                    }
                });

                ws.on('close', () => {
                    console.log('Chrome Extension disconnected');
                    this.clients.delete(ws);
                });
            });

            console.log('WebSocket server listening on port 8765');
        } catch (error) {
            console.error('Failed to start WebSocket server:', error);
            vscode.window.showErrorMessage('Failed to start WebAgent Bridge Server on port 8765.');
        }
    }

    public hasClients(): boolean {
        for (const client of this.clients) {
            if (client.readyState === 1) return true; // 1 is OPEN
        }
        return false;
    }

    public async *streamMessage(provider: string, prompt: string): AsyncGenerator<string> {
        if (!this.hasClients()) {
            throw new Error('No Chrome Extension connected. Please install the WebAgent Chrome extension and open your AI provider.');
        }

        const message = JSON.stringify({ type: 'prompt', provider, prompt });
        for (const client of this.clients) {
            if (client.readyState === 1) { // 1 is OPEN
                client.send(message);
            }
        }

        let isDone = false;
        let currentError: string | null = null;
        let tokenQueue: string[] = [];
        let resolveNext: (() => void) | null = null;

        const onToken = (text: string) => {
            tokenQueue.push(text);
            if (resolveNext) resolveNext();
        };

        const onDone = () => {
            isDone = true;
            if (resolveNext) resolveNext();
        };

        const onError = (msg: string) => {
            currentError = msg;
            isDone = true;
            if (resolveNext) resolveNext();
        };

        this.on('token', onToken);
        this.on('done', onDone);
        this.on('error', onError);

        try {
            while (!isDone || tokenQueue.length > 0) {
                if (tokenQueue.length > 0) {
                    yield tokenQueue.shift()!;
                } else if (!isDone) {
                    await new Promise<void>(resolve => { resolveNext = resolve; });
                    resolveNext = null;
                }
            }

            if (currentError) {
                throw new Error(currentError);
            }
        } finally {
            this.removeListener('token', onToken);
            this.removeListener('done', onDone);
            this.removeListener('error', onError);
        }
    }
}
