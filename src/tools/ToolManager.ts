import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { TerminalTools } from './TerminalTools';
import { GitTools } from './GitTools';

export class ToolManager {
    public async executeTool(toolCall: any): Promise<string> {
        try {
            switch (toolCall.tool) {
                case 'read_file':
                    return this.readFile(toolCall.path);
                case 'write_file':
                    return this.writeFile(toolCall.path, toolCall.content);
                case 'edit_file':
                    return this.writeFile(toolCall.path, toolCall.content); 
                case 'delete_file':
                    return await this.deleteFile(toolCall.path);
                case 'create_directory':
                    return this.createDirectory(toolCall.path);
                case 'list_directory':
                    return this.listDirectory(toolCall.path);
                case 'search_files':
                    return await this.searchFiles(toolCall.content, toolCall.path);
                case 'fetch_url':
                    return await this.fetchUrl(toolCall.path); // using path as url
                case 'execute_command':
                    return await TerminalTools.executeCommand(toolCall.command);
                case 'git_status':
                    return await GitTools.status();
                case 'git_diff':
                    return await GitTools.diff();
                default:
                    return `Unknown tool: ${toolCall.tool}`;
            }
        } catch (e: any) {
            return `Tool execution failed: ${e.message}`;
        }
    }

    private resolvePath(filePath: string): string {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) throw new Error('No workspace open');
        return path.resolve(workspaceFolders[0].uri.fsPath, filePath || '.');
    }

    private readFile(filePath: string): string {
        const fullPath = this.resolvePath(filePath);
        return fs.readFileSync(fullPath, 'utf-8');
    }

    private writeFile(filePath: string, content: string): string {
        const fullPath = this.resolvePath(filePath);
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, content, 'utf-8');
        return `Successfully wrote to ${filePath}`;
    }

    private editFile(filePath: string, instructions: string): string {
        // Advanced parsing would be needed here.
        // For now, this is a placeholder indicating success.
        return `Successfully applied edits to ${filePath} (Placeholder)`;
    }

    private async deleteFile(filePath: string): Promise<string> {
        const fullPath = this.resolvePath(filePath);
        
        const result = await vscode.window.showWarningMessage(
            `Agent wants to delete file: ${filePath}\nAllow?`,
            { modal: true },
            'Yes', 'No'
        );
        
        if (result === 'Yes') {
            fs.unlinkSync(fullPath);
            return `Successfully deleted ${filePath}`;
        } else {
            return "Permission denied by user.";
        }
    }

    private createDirectory(dirPath: string): string {
        const fullPath = this.resolvePath(dirPath);
        fs.mkdirSync(fullPath, { recursive: true });
        return `Successfully created directory ${dirPath}`;
    }

    private listDirectory(dirPath: string): string {
        const fullPath = this.resolvePath(dirPath);
        const files = fs.readdirSync(fullPath);
        return files.join('\n');
    }

    private async searchFiles(query: string, searchPath: string = '.'): Promise<string> {
        return await TerminalTools.executeCommand(`grep -rn "${query}" ${searchPath}`);
    }

    private async fetchUrl(url: string): Promise<string> {
        try {
            const response = await fetch(url);
            const text = await response.text();
            // Truncate to avoid exploding context limits
            return text.substring(0, 15000);
        } catch (e: any) {
            return `Failed to fetch URL: ${e.message}`;
        }
    }
}
