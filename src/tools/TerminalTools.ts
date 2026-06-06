import * as cp from 'child_process';
import * as vscode from 'vscode';

export class TerminalTools {
    public static async executeCommand(command: string): Promise<string> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            return "Error: No workspace open";
        }
        const cwd = workspaceFolders[0].uri.fsPath;

        // Security requirement: Ask user confirmation before deletion or git push
        const isDeletion = /\b(rm|del|rmdir|unlink)\b/i.test(command);
        const isGitPush = command.includes('git push');

        if (isDeletion || isGitPush) {
            const result = await vscode.window.showWarningMessage(
                `Agent wants to run a potentially dangerous command: ${command}\nAllow?`,
                { modal: true },
                'Yes', 'No'
            );
            if (result !== 'Yes') {
                return "Command execution rejected by user.";
            }
        }

        return new Promise((resolve) => {
            cp.exec(command, { cwd }, (error, stdout, stderr) => {
                if (error) {
                    resolve(`Error: ${error.message}\nStderr: ${stderr}`);
                } else {
                    resolve(stdout || "Command executed successfully with no output.");
                }
            });
        });
    }
}
