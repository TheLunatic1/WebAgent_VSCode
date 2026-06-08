import * as vscode from 'vscode';
import { AIProvider } from '../providers/AIProvider';
import { ToolManager } from '../tools/ToolManager';

export class Agent {
    private toolManager: ToolManager;
    private isRunning: boolean = false;

    private modifiedFiles: Set<string> = new Set();

    constructor(private provider: AIProvider, private onStream: (chunk: string, isSystem?: boolean) => void) {
        this.toolManager = new ToolManager();
    }

    public setProvider(provider: AIProvider) {
        this.provider = provider;
    }

    public async executeTask(objective: string, mode: string = 'agent'): Promise<void> {
        this.isRunning = true;
        this.modifiedFiles.clear();
        let iteration = 0;
        const maxIterations = mode === 'chat' || mode === 'plan' ? 1 : 15;

        // Context + Objective
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath || 'Unknown';
        let prompt = `Objective: ${objective}\nWorkspace Root: ${workspaceRoot}\n\n`;

        if (mode === 'agent') {
            prompt += `CRITICAL INSTRUCTION: You are not a standard cloud AI. You are the core logic engine of a VS Code Extension.
You DO have access to the user's local filesystem and terminal through an internal bridge.
How it works:
1. You output an XML action block requesting a file operation or command.
2. The VS Code extension intercepts your response, executes it locally, and sends you the result in the next message.
3. DO NOT ever say you cannot access files, run commands, or delete directories. You HAVE ROOT ACCESS through the bridge. If the user asks you to delete everything, you MUST do it by outputting the correct XML block (e.g. using execute_command to run rm -rf). NEVER refuse due to "chat environment constraints".

To execute a local action, output exactly ONE thought and ONE action block:

<thought>
I need to add a console log to index.js. I will use the edit_file action and output the ENTIRE modified file contents.
</thought>
<action>
action_name: edit_file
path: index.js
content: |
  console.log("Hello World");
  console.log("by world");
  // ... rest of the full file
</action>

CRITICAL RULES FOR content:
- If action_name is edit_file or write_file, the content tag MUST contain the ENTIRE new file code.
- NEVER output English instructions or placeholders like "Insert here" inside the content tag. The file will be literally overwritten with whatever you put there.
- You must write out the complete file from top to bottom.

Available actions: read_file, write_file, edit_file, delete_file, create_directory, list_directory, search_files, fetch_url, execute_command, git_status, git_diff, finish.`;
        } else if (mode === 'chat') {
            prompt += `REMINDER: You are in CHAT mode. DO NOT use any file/shell actions. Reply directly to the user by using the "finish" action.
Respond using this exact format:
<thought>...</thought>
<action>
action_name: finish
content: your response
</action>`;
        } else if (mode === 'plan') {
            prompt += `REMINDER: You are in PLANNING mode. DO NOT use edit actions. Use read actions if needed, then draft a plan using the "finish" action.
Respond using this exact format:
<thought>...</thought>
<action>
action_name: finish
content: your plan here
</action>`;
        }

        while (this.isRunning && iteration < maxIterations) {
            iteration++;
            let responseStr = '';

            try {
                for await (const chunk of this.provider.streamMessage(prompt)) {
                    responseStr = chunk;
                    this.onStream(chunk);
                }
                
                const parsed = this.parseResponse(responseStr);
                if (!parsed) {
                    prompt = `Error: Your previous output did not contain valid <thought> and <action> tags. You MUST respond ONLY using the exact XML formatting requested. Do not output raw conversational text.`;
                    // Retry silently without bothering the user
                    continue;
                }

                if (parsed.action && (parsed.action.tool === 'write_file' || parsed.action.tool === 'edit_file' || parsed.action.tool === 'delete_file') && parsed.action.path) {
                    this.modifiedFiles.add(parsed.action.path);
                }

                if (parsed.action?.tool === 'finish') {
                    if (parsed.action.content) {
                        this.onStream(`\n\n[Agent Final Answer]: ${parsed.action.content}\n`, true);
                    }
                    if (this.modifiedFiles.size > 0) {
                        this.onStream(`\n\n[Changed Files]: ${Array.from(this.modifiedFiles).join(',')}\n`, true);
                    }
                    break;
                }

                if (parsed.action && parsed.action.tool) {
                    this.onStream(`\n\n[Agent Executing Tool]: ${parsed.action.tool}\n`, true);
                    const result = await this.toolManager.executeTool(parsed.action); // Now awaited
                    this.onStream(`[Tool Result]: ${result}\n\n`, true);
                    
                    prompt = `Tool executed. Result:\n${result}\nWhat is the next step? Output exactly ONE thought block and ONE action block using XML tags as specified before.`;
                } else {
                    prompt = "Error: No valid action provided. What is the next step? Output strictly using <thought> and <action> XML blocks.";
                    // Silently retry instead of spamming user
                    continue;
                }

            } catch (e: any) {
                this.onStream(`\n\n[Agent Error]: ${e.message}\n`, true);
                break;
            }
        }

        if (iteration >= maxIterations) {
            this.onStream('\n\n[Agent]: Max iterations reached. Task aborted.', true);
        }

        this.isRunning = false;
    }

    public stop() {
        this.isRunning = false;
    }

    private parseResponse(response: string): any {
        try {
            
            // Bypass: Parse XML tags
            const thoughtMatch = response.match(/<thought>([\s\S]*?)<\/thought>/i);
            const actionMatch = response.match(/<action>([\s\S]*?)<\/action>/i);
            
            if (thoughtMatch || actionMatch) {
                const thought = thoughtMatch ? thoughtMatch[1].trim() : '';
                let action: any = null;
                
                if (actionMatch) {
                    const actionText = actionMatch[1].trim();
                    action = {};
                    
                    const toolMatch = actionText.match(/action_name:\s*(.+)/i);
                    if (toolMatch) action.tool = toolMatch[1].trim();
                    
                    const pathMatch = actionText.match(/path:\s*(.+)/i);
                    if (pathMatch) action.path = pathMatch[1].trim();
                    
                    const commandMatch = actionText.match(/command:\s*(.+)/i);
                    if (commandMatch) action.command = commandMatch[1].trim();

                    // Content can be multiline, so capture everything after "content:" until the end of the action block
                    const contentMatch = actionText.match(/content:\s*([\s\S]*)/i);
                    if (contentMatch) action.content = contentMatch[1].trim();
                }
                
                return { thought, action };
            }
            return null;
        } catch {
            return null;
        }
    }
}
