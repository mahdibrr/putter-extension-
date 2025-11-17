import * as vscode from 'vscode';

export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
}

export interface PuterAPIRequest {
    method: string;
    params: any;
    requestId: string;
}

export interface PuterAPIResponse {
    requestId: string;
    success: boolean;
    data?: any;
    error?: string;
}

export class PuterAIService {
    private config: vscode.WorkspaceConfiguration;
    private conversationHistory: Map<string, ChatMessage[]> = new Map();
    private pendingRequests: Map<string, { resolve: (value: any) => void; reject: (error: any) => void }> = new Map();
    private webviewProvider?: vscode.WebviewView;
    private maxHistoryLength = 50;

    constructor() {
        this.config = vscode.workspace.getConfiguration('puterAI');
    }

    public setWebviewProvider(provider: vscode.WebviewView) {
        this.webviewProvider = provider;
    }

    public handleAPIResponse(response: PuterAPIResponse) {
        const pending = this.pendingRequests.get(response.requestId);
        if (pending) {
            if (response.success) {
                pending.resolve(response.data);
            } else {
                pending.reject(new Error(response.error || 'Unknown error'));
            }
            this.pendingRequests.delete(response.requestId);
        }
    }

    public addToHistory(conversationId: string, message: ChatMessage) {
        if (!this.conversationHistory.has(conversationId)) {
            this.conversationHistory.set(conversationId, []);
        }
        const history = this.conversationHistory.get(conversationId)!;
        history.push(message);

        // Limit history size
        if (history.length > this.maxHistoryLength) {
            history.shift();
        }
    }

    public getHistory(conversationId: string): ChatMessage[] {
        return this.conversationHistory.get(conversationId) || [];
    }

    public clearHistory(conversationId: string) {
        this.conversationHistory.delete(conversationId);
    }

    public async getWorkspaceContext(): Promise<string> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            return 'No workspace open';
        }

        const editor = vscode.window.activeTextEditor;
        let context = `Workspace: ${workspaceFolders[0].name}\n`;

        if (editor) {
            context += `Active File: ${editor.document.fileName}\n`;
            context += `Language: ${editor.document.languageId}\n`;
            const selection = editor.selection;
            if (!selection.isEmpty) {
                context += `Selected Lines: ${selection.start.line + 1}-${selection.end.line + 1}\n`;
            }
        }

        return context;
    }

    public async analyzeCodeContext(code: string, language: string): Promise<string> {
        // Extract important context from code
        const lines = code.split('\n');
        const imports = lines.filter(line =>
            line.trim().startsWith('import ') ||
            line.trim().startsWith('from ') ||
            line.trim().startsWith('using ') ||
            line.trim().startsWith('#include')
        );

        let context = `Code Context (${language}):\n`;
        if (imports.length > 0) {
            context += `Dependencies: ${imports.slice(0, 5).join(', ')}\n`;
        }
        context += `Lines of code: ${lines.length}\n`;

        return context;
    }

    public async getFileTreeContext(maxDepth: number = 2): Promise<string> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return 'No workspace open';
        }

        try {
            const rootPath = workspaceFolders[0].uri;
            const files = await vscode.workspace.findFiles(
                '**/*',
                '**/node_modules/**,**/.git/**,**/dist/**,**/out/**,**/build/**',
                100 // Limit to 100 files
            );

            const fileTree: { [key: string]: string[] } = {};

            for (const file of files) {
                const relativePath = vscode.workspace.asRelativePath(file);
                const parts = relativePath.split('/');

                if (parts.length <= maxDepth) {
                    const dir = parts.slice(0, -1).join('/') || 'root';
                    if (!fileTree[dir]) {
                        fileTree[dir] = [];
                    }
                    fileTree[dir].push(parts[parts.length - 1]);
                }
            }

            let context = `File Tree (showing ${files.length} files, depth: ${maxDepth}):\n`;
            for (const [dir, fileList] of Object.entries(fileTree).slice(0, 10)) {
                context += `\n${dir}/\n`;
                fileList.slice(0, 5).forEach(file => {
                    context += `  - ${file}\n`;
                });
                if (fileList.length > 5) {
                    context += `  ... and ${fileList.length - 5} more files\n`;
                }
            }

            return context;
        } catch (error: any) {
            return `Error analyzing file tree: ${error.message}`;
        }
    }

    public async getRelevantFilesContext(query: string): Promise<string> {
        try {
            const files = await vscode.workspace.findFiles(
                '**/*.{ts,js,tsx,jsx,py,java,cpp,c,go,rs,php}',
                '**/node_modules/**,**/.git/**',
                20
            );

            const relevantFiles: string[] = [];
            for (const file of files) {
                const relativePath = vscode.workspace.asRelativePath(file);
                if (relativePath.toLowerCase().includes(query.toLowerCase()) ||
                    query.toLowerCase().split(' ').some(word =>
                        relativePath.toLowerCase().includes(word)
                    )) {
                    relevantFiles.push(relativePath);
                }
            }

            if (relevantFiles.length === 0) {
                return 'No relevant files found';
            }

            return `Relevant files for "${query}":\n${relevantFiles.slice(0, 10).map(f => `- ${f}`).join('\n')}`;
        } catch (error: any) {
            return `Error searching files: ${error.message}`;
        }
    }

    private getConfig() {
        return {
            model: this.config.get<string>('defaultModel', 'claude-sonnet-4-5'),
            temperature: this.config.get<number>('temperature', 0.7),
            maxTokens: this.config.get<number>('maxTokens', 2000),
            enableStreaming: this.config.get<boolean>('enableStreaming', true),
            enableAgentMode: this.config.get<boolean>('enableAgentMode', false),
            agentAutoApply: this.config.get<boolean>('agentAutoApply', false)
        };
    }

    isClaudeModel(model: string): boolean {
        return model.startsWith('claude-');
    }

    async chat(message: string, systemPrompt?: string): Promise<string> {
        const config = this.getConfig();
        const context = await this.getWorkspaceContext();
        const fullPrompt = systemPrompt ? `${systemPrompt}\n\nContext:\n${context}\n\nUser: ${message}` : message;

        try {
            return await this.callPuterAPI('chat', {
                prompt: fullPrompt,
                model: config.model,
                temperature: config.temperature,
                max_tokens: config.maxTokens
            });
        } catch (error: any) {
            throw new Error(`Puter AI Error: ${error.message}`);
        }
    }

    async explainCode(code: string, language: string): Promise<string> {
        const prompt = `Explain the following ${language} code in detail. Include:
1. What the code does
2. How it works
3. Any potential issues or improvements

Code:
\`\`\`${language}
${code}
\`\`\``;

        return await this.chat(prompt, "You are an expert programmer who explains code clearly and concisely.");
    }

    async generateCode(description: string, language: string): Promise<string> {
        const prompt = `Generate ${language} code for the following requirement:
${description}

Provide only the code without explanations. Make it clean, efficient, and well-structured.`;

        return await this.chat(prompt, `You are an expert ${language} programmer. Generate clean, production-ready code.`);
    }

    async agentModifyCode(instruction: string, code: string, language: string, filePath: string): Promise<{ 
        modifiedCode: string; 
        explanation: string;
        changesSummary: string;
    }> {
        const prompt = `You are a code modification agent. Modify the following ${language} code according to the user's instruction.

FILE: ${filePath}
INSTRUCTION: ${instruction}

CURRENT CODE:
\`\`\`${language}
${code}
\`\`\`

Respond in JSON format:
{
    "modifiedCode": "the complete modified code",
    "explanation": "what changes were made",
    "changesSummary": "brief summary of changes"
}`;

        const response = await this.chat(prompt, `You are an expert code modification agent. Always respond with valid JSON.`);
        
        try {
            // Extract JSON from response
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            
            // Fallback if JSON not found
            return {
                modifiedCode: code,
                explanation: "Could not parse agent response",
                changesSummary: "No changes made"
            };
        } catch (error) {
            throw new Error(`Failed to parse agent response: ${error}`);
        }
    }

    async refactorCode(code: string, language: string): Promise<string> {
        const prompt = `Refactor the following ${language} code to improve:
- Readability
- Performance
- Best practices
- Code structure

Original code:
\`\`\`${language}
${code}
\`\`\`

Provide only the refactored code without explanations.`;

        return await this.chat(prompt, `You are an expert ${language} programmer specializing in code refactoring.`);
    }

    async addComments(code: string, language: string): Promise<string> {
        const prompt = `Add meaningful comments to the following ${language} code. Include:
- Function/class descriptions
- Parameter explanations
- Complex logic explanations
- Return value descriptions

Code:
\`\`\`${language}
${code}
\`\`\`

Provide the code with comments added.`;

        return await this.chat(prompt, `You are an expert programmer who writes clear, helpful documentation.`);
    }

    async fixErrors(code: string, language: string): Promise<string> {
        const prompt = `Analyze and fix any errors, bugs, or issues in the following ${language} code:

\`\`\`${language}
${code}
\`\`\`

Provide the corrected code without explanations.`;

        return await this.chat(prompt, `You are an expert debugger and ${language} programmer.`);
    }

    async generateTests(code: string, language: string): Promise<string> {
        const prompt = `Generate comprehensive unit tests for the following ${language} code:

\`\`\`${language}
${code}
\`\`\`

Include:
- Test for normal cases
- Test for edge cases
- Test for error handling
Use appropriate testing framework for ${language}.`;

        return await this.chat(prompt, `You are an expert in ${language} and test-driven development.`);
    }

    private async callPuterAPI(method: string, params: any, retries = 3): Promise<string> {
        if (!this.webviewProvider) {
            throw new Error('Webview provider not initialized');
        }

        let lastError: Error | null = null;

        for (let attempt = 0; attempt < retries; attempt++) {
            try {
                const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

                const result = await new Promise<string>((resolve, reject) => {
                    // Set timeout for request
                    const timeout = setTimeout(() => {
                        this.pendingRequests.delete(requestId);
                        reject(new Error('Request timeout - AI service did not respond within 60 seconds'));
                    }, 60000); // 60 second timeout

                    // Store pending request with timeout cleanup
                    this.pendingRequests.set(requestId, {
                        resolve: (value: any) => {
                            clearTimeout(timeout);
                            resolve(value);
                        },
                        reject: (error: any) => {
                            clearTimeout(timeout);
                            reject(error);
                        }
                    });

                    // Send request to webview
                    this.webviewProvider!.webview.postMessage({
                        type: 'apiRequest',
                        requestId,
                        method,
                        params
                    });
                });

                return result;
            } catch (error: any) {
                lastError = error;

                // Don't retry on certain errors
                if (error.message.includes('not initialized') ||
                    error.message.includes('Invalid model') ||
                    error.message.includes('Authentication failed')) {
                    throw error;
                }

                // Wait before retrying (exponential backoff)
                if (attempt < retries - 1) {
                    await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
                }
            }
        }

        throw new Error(`Failed after ${retries} attempts: ${lastError?.message}`);
    }

    async chatWithStreaming(
        message: string,
        onChunk: (chunk: string) => void,
        systemPrompt?: string
    ): Promise<void> {
        const config = this.getConfig();

        if (!config.enableStreaming) {
            const response = await this.chat(message, systemPrompt);
            onChunk(response);
            return;
        }

        if (!this.webviewProvider) {
            throw new Error('Webview provider not initialized');
        }

        const context = await this.getWorkspaceContext();
        const fullPrompt = systemPrompt ? `${systemPrompt}\n\nContext:\n${context}\n\nUser: ${message}` : message;
        const requestId = `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        return new Promise((resolve, reject) => {
            // Create a message listener for streaming chunks
            const listener = (event: any) => {
                const msg = event.data;
                if (msg.type === 'streamChunk' && msg.requestId === requestId) {
                    onChunk(msg.chunk);
                } else if (msg.type === 'streamEnd' && msg.requestId === requestId) {
                    resolve();
                } else if (msg.type === 'streamError' && msg.requestId === requestId) {
                    reject(new Error(msg.error));
                }
            };

            // Send streaming request to webview
            this.webviewProvider!.webview.postMessage({
                type: 'streamRequest',
                requestId,
                prompt: fullPrompt,
                model: config.model,
                temperature: config.temperature,
                max_tokens: config.maxTokens
            });
        });
    }

    public async generateCodeWithContext(description: string, language: string): Promise<string> {
        const editor = vscode.window.activeTextEditor;
        let additionalContext = '';

        if (editor) {
            const surroundingCode = editor.document.getText();
            const codeContext = await this.analyzeCodeContext(surroundingCode, language);
            additionalContext = `\n\nExisting code context:\n${codeContext}`;
        }

        return this.generateCode(description + additionalContext, language);
    }

    public getConversationStats(conversationId: string): {
        messageCount: number;
        userMessages: number;
        aiMessages: number;
    } {
        const history = this.getHistory(conversationId);
        return {
            messageCount: history.length,
            userMessages: history.filter(m => m.role === 'user').length,
            aiMessages: history.filter(m => m.role === 'assistant').length
        };
    }
}
