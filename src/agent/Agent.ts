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
            prompt += `CRITICAL INSTRUCTION: You are an autonomous coding agent operating inside a VS Code Extension.
You DO have access to the user's local filesystem and terminal. 
To take an action, you MUST output a thought block, followed by an action block containing exactly ONE valid JSON object.

Format your response EXACTLY like this:

<thought>
I need to execute a terminal command to install dependencies.
</thought>
<action>
{
  "tool": "execute_command",
  "command": "npm install"
}
</action>

Another example:
<thought>
I need to write a new file.
</thought>
<action>
{
  "tool": "write_file",
  "path": "src/index.js",
  "content": "console.log('Hello World');\\n"
}
</action>

Available tools:
- {"tool": "read_file", "path": "string"}
- {"tool": "write_file", "path": "string", "content": "string"} (Overwrites the whole file)
- {"tool": "delete_file", "path": "string"}
- {"tool": "create_directory", "path": "string"}
- {"tool": "list_directory", "path": "string"}
- {"tool": "search_files", "path": "string", "content": "query"}
- {"tool": "execute_command", "command": "string"}
- {"tool": "git_status"}
- {"tool": "git_diff"}
- {"tool": "finish", "content": "final response to user"}

Rules:
1. ALWAYS use the <thought> and <action> tags.
2. The inside of the <action> tag MUST BE A VALID JSON OBJECT. Do NOT wrap the JSON in markdown code blocks (\`\`\`json). Just output raw JSON.
3. If writing/editing a file, provide the FULL file content in the "content" JSON field. Do not use placeholders.
4. Escape quotes and newlines in JSON correctly.`;
        } else if (mode === 'chat') {
            prompt += `REMINDER: You are in CHAT mode. Respond using this exact format:
<thought>...</thought>
<action>
{
  "tool": "finish",
  "content": "your conversational response"
}
</action>`;
        } else if (mode === 'plan') {
            prompt += `REMINDER: You are in PLANNING mode. Respond using this exact format:
<thought>...</thought>
<action>
{
  "tool": "finish",
  "content": "your detailed plan"
}
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
                if (!parsed || !parsed.action || !parsed.action.tool) {
                    prompt = `Error: Your previous output did not contain valid <thought> and <action> tags with a valid JSON object. You MUST respond ONLY using the exact XML and JSON formatting requested.`;
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
                    const result = await this.toolManager.executeTool(parsed.action);
                    this.onStream(`[Tool Result]: ${result}\n\n`, true);
                    
                    prompt = `Tool executed. Result:\n${result}\nWhat is the next step? Output exactly ONE thought block and ONE action block containing JSON.`;
                } else {
                    prompt = "Error: No valid action provided. What is the next step? Output strictly using <thought> and <action> blocks.";
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
            const thoughtMatch = response.match(/<thought>([\s\S]*?)<\/thought>/i);
            const actionMatch = response.match(/<action>([\s\S]*?)<\/action>/i);
            
            if (thoughtMatch || actionMatch) {
                const thought = thoughtMatch ? thoughtMatch[1].trim() : '';
                let action: any = null;
                
                if (actionMatch) {
                    let actionText = actionMatch[1].trim();
                    // If the AI accidentally wrapped the JSON in markdown inside the tag, strip it
                    actionText = actionText.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
                    
                    try {
                        action = JSON.parse(actionText);
                    } catch (e) {
                        console.error('Failed to parse Agent JSON action', e);
                    }
                }
                
                return { thought, action };
            }
            return null;
        } catch {
            return null;
        }
    }
}
