import { TerminalTools } from './TerminalTools';

export class GitTools {
    public static async status(): Promise<string> {
        return await TerminalTools.executeCommand('git status');
    }

    public static async log(): Promise<string> {
        return await TerminalTools.executeCommand('git log -n 5');
    }

    public static async diff(): Promise<string> {
        return await TerminalTools.executeCommand('git diff');
    }

    // Agent handles other git commands via executeCommand explicitly
}
