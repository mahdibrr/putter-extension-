import * as vscode from 'vscode';
import { PuterAIService } from './puterAIService';

export class PuterChatViewProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _aiService: PuterAIService
    ) {}

    public sendMessage(type: string, data: any) {
        if (this._view) {
            this._view.webview.postMessage({ type, ...data });
        }
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri],
            enableCommandUris: true
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Set webview provider in AI service
        this._aiService.setWebviewProvider(webviewView);

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(async (data: any) => {
            console.log('[Puter AI] Received message from webview:', data.type, data);
            switch (data.type) {
                case 'chat':
                    await this.handleChatMessage(data.message, data.model);
                    break;
                case 'insertCode':
                    this.insertCodeAtCursor(data.code);
                    break;
                case 'agentModify':
                    await this.handleAgentModify(data.instruction);
                    break;
                case 'apiResponse':
                    this._aiService.handleAPIResponse(data.response);
                    break;
                case 'clearHistory':
                    this._aiService.clearHistory(data.conversationId || 'default');
                    break;
                case 'getHistory':
                    const history = this._aiService.getHistory(data.conversationId || 'default');
                    this.sendMessage('historyResponse', { history });
                    break;
                case 'openExternal':
                    // Open URL in external browser for Puter authentication
                    console.log('[Puter AI] Received openExternal message with URL:', data.url);
                    if (data.url) {
                        try {
                            console.log('[Puter AI] Opening external URL:', data.url);
                            await vscode.env.openExternal(vscode.Uri.parse(data.url));
                            vscode.window.showInformationMessage(
                                '🌐 Browser opened for Puter authentication. Please sign in, then reload VSCode (Ctrl+R or Cmd+R)'
                            );
                            console.log('[Puter AI] Successfully opened browser');
                        } catch (error) {
                            console.error('[Puter AI] Failed to open browser:', error);
                            vscode.window.showErrorMessage(`Failed to open browser: ${error}`);
                        }
                    } else {
                        console.log('[Puter AI] No URL provided in openExternal message');
                    }
                    break;
            }
        });
    }

    private async handleChatMessage(message: string, model?: string) {
        if (!this._view) {
            return;
        }

        try {
            // Show loading state
            this._view.webview.postMessage({
                type: 'loading',
                loading: true
            });

            // Since Puter.js runs in browser, we'll let the webview handle the actual API call
            // and just receive the result back
            this._view.webview.postMessage({
                type: 'processChat',
                message: message,
                model: model
            });

        } catch (error: any) {
            this._view.webview.postMessage({
                type: 'error',
                error: error.message
            });
        }
    }

    private async handleAgentModify(instruction: string) {
        if (!this._view) {
            return;
        }

        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            this._view.webview.postMessage({
                type: 'error',
                error: 'No active editor found'
            });
            return;
        }

        const config = vscode.workspace.getConfiguration('puterAI');
        if (!config.get<boolean>('enableAgentMode', false)) {
            this._view.webview.postMessage({
                type: 'error',
                error: 'Agent Mode is disabled. Enable it in settings.'
            });
            return;
        }

        const code = editor.document.getText();
        const language = editor.document.languageId;
        const filePath = editor.document.fileName;

        try {
            const result = await this._aiService.agentModifyCode(instruction, code, language, filePath);
            
            // Apply changes
            await editor.edit((editBuilder: vscode.TextEditorEdit) => {
                const fullRange = new vscode.Range(
                    editor.document.positionAt(0),
                    editor.document.positionAt(editor.document.getText().length)
                );
                editBuilder.replace(fullRange, result.modifiedCode);
            });

            this._view.webview.postMessage({
                type: 'agentSuccess',
                summary: result.changesSummary,
                explanation: result.explanation
            });

            vscode.window.showInformationMessage(`✅ ${result.changesSummary}`);
        } catch (error: any) {
            this._view.webview.postMessage({
                type: 'error',
                error: error.message
            });
        }
    }

    private insertCodeAtCursor(code: string) {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            editor.edit((editBuilder: vscode.TextEditorEdit) => {
                editBuilder.insert(editor.selection.active, code);
            });
        }
    }

    private getNonce() {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        const nonce = this.getNonce();

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src https://js.puter.com https: 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline' ${webview.cspSource}; connect-src https://api.puter.com https://puter.com https://js.puter.com https://*.puter.com wss://*.puter.com; frame-src https://puter.com https://*.puter.com; img-src https: data:; frame-ancestors 'self';">
    <title>Puter AI Chat</title>
    <script>
        window.puterLoaded = false;
        window.puterLoadError = null;

        // Acquire VSCode API early
        const vscodeApi = acquireVsCodeApi();

        // Override window.open to intercept Puter auth popups
        // VSCode webviews can't open popups, so we open in external browser
        const originalOpen = window.open;
        window.open = function(url, target, features) {
            console.log('[Webview] Intercepted window.open call to:', url);
            console.log('[Webview] URL includes puter.com?', url && url.includes('puter.com'));
            console.log('[Webview] URL includes request_auth?', url && url.includes('request_auth'));

            // If it's a Puter auth URL, send to extension to open in browser
            if (url && (url.includes('puter.com') || url.includes('request_auth'))) {
                console.log('[Webview] Sending openExternal message to extension');
                const message = {
                    type: 'openExternal',
                    url: url
                };
                console.log('[Webview] Message:', JSON.stringify(message));
                vscodeApi.postMessage(message);
                console.log('[Webview] Message sent successfully');

                // Return a fake window object to prevent errors
                return {
                    closed: false,
                    close: () => {},
                    focus: () => {},
                    blur: () => {},
                    location: { href: url }
                };
            }

            // For other URLs, try original behavior
            console.log('[Webview] Not a Puter URL, using original window.open');
            return originalOpen.call(window, url, target, features);
        };
    </script>
    <script src="https://js.puter.com/v2/" onload="window.puterLoaded = true; console.log('Puter script loaded');" onerror="window.puterLoadError = 'Failed to load script'; console.error('Puter script failed to load');"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 10px;
            height: 100vh;
            display: flex;
            flex-direction: column;
        }
        
        #chat-container {
            flex: 1;
            overflow-y: auto;
            margin-bottom: 10px;
            padding: 10px;
        }
        
        .message {
            margin-bottom: 15px;
            padding: 10px;
            border-radius: 5px;
        }
        
        .user-message {
            background-color: var(--vscode-input-background);
            border-left: 3px solid var(--vscode-button-background);
        }
        
        .ai-message {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border-left: 3px solid var(--vscode-focusBorder);
        }
        
        .message-header {
            font-weight: bold;
            margin-bottom: 5px;
            color: var(--vscode-textLink-foreground);
        }
        
        .message-content {
            white-space: pre-wrap;
            word-wrap: break-word;
            line-height: 1.5;
        }
        
        .message-content code {
            background-color: var(--vscode-textCodeBlock-background);
            padding: 2px 4px;
            border-radius: 3px;
            font-family: var(--vscode-editor-font-family);
        }
        
        .message-content pre {
            background-color: var(--vscode-textCodeBlock-background);
            padding: 10px;
            border-radius: 5px;
            overflow-x: auto;
            margin: 10px 0;
        }
        
        #input-container {
            display: flex;
            gap: 5px;
            padding-top: 10px;
            border-top: 1px solid var(--vscode-panel-border);
        }
        
        #message-input {
            flex: 1;
            padding: 8px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 3px;
            font-family: var(--vscode-font-family);
            resize: none;
        }
        
        #send-button {
            padding: 8px 15px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 3px;
            cursor: pointer;
            font-weight: bold;
        }
        
        #send-button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        
        #send-button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        
        .loading {
            text-align: center;
            padding: 10px;
            color: var(--vscode-descriptionForeground);
        }
        
        .spinner {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 3px solid var(--vscode-panel-border);
            border-top: 3px solid var(--vscode-button-background);
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        .code-actions {
            margin-top: 5px;
        }
        
        .code-action-btn {
            padding: 4px 8px;
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            border-radius: 3px;
            cursor: pointer;
            font-size: 11px;
            margin-right: 5px;
        }
        
        .code-action-btn:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }

        .welcome {
            text-align: center;
            padding: 20px;
            color: var(--vscode-descriptionForeground);
        }

        .welcome h2 {
            color: var(--vscode-foreground);
            margin-bottom: 10px;
        }
    </style>
</head>
<body>
        <div id="chat-container">
        <div class="welcome">
            <h2>🚀 Puter AI Agent</h2>
            <p>Ask me anything about code!<br>I can help you write, explain, refactor, and debug code.</p>
            <p style="margin-top: 10px; font-size: 11px;">
                <strong>Agent Mode:</strong> I can directly modify your code!<br>
                <strong>Models:</strong> Claude Sonnet 4.5, Opus 4.1, Haiku 4.5, GPT-5
            </p>
            <div id="auth-container" style="margin-top: 15px; display: none;">
                <button id="sign-in-btn" style="padding: 8px 16px; background-color: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; border-radius: 3px; cursor: pointer; font-weight: bold;">
                    🔐 Sign in with Puter
                </button>
                <p style="margin-top: 8px; font-size: 10px; color: var(--vscode-descriptionForeground);">
                    Free AI access - no credit card required
                </p>
            </div>
        </div>
    </div>
    
    <div style="padding: 5px; border-bottom: 1px solid var(--vscode-panel-border);">
        <select id="model-selector" style="width: 100%; padding: 5px; background-color: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 3px; margin-bottom: 5px;">
            <option value="claude-sonnet-4-5">Claude Sonnet 4.5</option>
            <option value="claude-opus-4-1">Claude Opus 4.1</option>
            <option value="claude-haiku-4-5">Claude Haiku 4.5</option>
            <option value="claude-sonnet-4">Claude Sonnet 4</option>
            <option value="claude-opus-4">Claude Opus 4</option>
            <option value="gpt-5">GPT-5</option>
            <option value="gpt-5-nano">GPT-5 Nano</option>
            <option value="gpt-4o">GPT-4o</option>
        </select>
        <div style="display: flex; gap: 5px;">
            <button id="clear-history-btn" style="flex: 1; padding: 4px; background-color: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: none; border-radius: 3px; cursor: pointer; font-size: 11px;">
                Clear History
            </button>
            <button id="show-stats-btn" style="flex: 1; padding: 4px; background-color: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: none; border-radius: 3px; cursor: pointer; font-size: 11px;">
                Show Stats
            </button>
        </div>
    </div>
    
    <div id="input-container">
        <textarea 
            id="message-input" 
            placeholder="Ask me anything or use 'Agent: modify...' to change code..."
            rows="2"
        ></textarea>
        <button id="send-button">Send</button>
    </div>    <script nonce="${nonce}">
        const vscode = vscodeApi; // Use the already acquired API
        const chatContainer = document.getElementById('chat-container');
        const messageInput = document.getElementById('message-input');
        const sendButton = document.getElementById('send-button');
        const modelSelector = document.getElementById('model-selector');
        const clearHistoryBtn = document.getElementById('clear-history-btn');
        const showStatsBtn = document.getElementById('show-stats-btn');

        let isProcessing = false;
        let conversationId = 'default';
        let puterReady = false;

        // Wait for Puter to load with retries
        async function checkPuterReady() {
            const maxAttempts = 10;
            let attempts = 0;

            while (attempts < maxAttempts) {
                if (window.puterLoadError) {
                    addMessage('System', '⚠️ Failed to load Puter.js from CDN. Please check your internet connection and reload the window.', 'ai-message');
                    sendButton.disabled = true;
                    return;
                }

                if (window.puterLoaded && typeof puter !== 'undefined' && typeof puter.ai !== 'undefined') {
                    console.log('✅ Puter.js loaded and AI module available');

                    try {
                        // Check authentication status
                        puterReady = true;
                        const welcomeDiv = chatContainer.querySelector('.welcome');
                        if (welcomeDiv) {
                            welcomeDiv.innerHTML = '<h2>🚀 Puter AI Agent</h2><p>Ready! Ask me anything about code.<br><small style="color: var(--vscode-descriptionForeground);">Powered by Puter.js AI - Free with Puter account</small></p><p style="margin-top: 10px; font-size: 11px; color: var(--vscode-descriptionForeground);"><strong>💡 First time?</strong> When you send your first message, your browser will open for Puter sign-in. After signing in, reload VSCode (Ctrl+R or Cmd+R) and try again.</p>';
                        }
                        console.log('✅ AI ready to use');
                    } catch (e) {
                        console.error('Error initializing AI:', e);
                        addMessage('System', '⚠️ Error initializing AI. Please reload the window.', 'ai-message');
                    }
                    return;
                }

                attempts++;
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            // Timeout after max attempts
            addMessage('System', '⚠️ Puter.js is taking too long to load. Please check your internet connection and reload the window.', 'ai-message');
            sendButton.disabled = true;
        }

        function setupSignInButton() {
            // No sign-in button handler needed - Puter.js works without authentication
        }

        // Start checking when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', checkPuterReady);
        } else {
            checkPuterReady();
        }

        // Clear history handler
        clearHistoryBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to clear the chat history?')) {
                chatContainer.innerHTML = '<div class="welcome"><h2>🚀 Puter AI Agent</h2><p>Chat history cleared. Start a new conversation!</p></div>';
                vscode.postMessage({ type: 'clearHistory', conversationId });
            }
        });

        // Show stats handler
        showStatsBtn.addEventListener('click', () => {
            vscode.postMessage({ type: 'getHistory', conversationId });
        });
        
        // Handle send button click
        sendButton.addEventListener('click', sendMessage);
        
        // Handle Enter key (Shift+Enter for new line)
        messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        
        async function sendMessage() {
            const message = messageInput.value.trim();
            if (!message || isProcessing) return;

            // Check if Puter is ready
            if (!puterReady && !message.toLowerCase().startsWith('agent:')) {
                addMessage('System', '⚠️ Puter.js is not ready yet. Please wait a moment and try again.', 'ai-message');
                return;
            }

            // Check if this is an agent command
            const isAgentCommand = message.toLowerCase().startsWith('agent:');

            // Add user message to chat
            addMessage('You', message, 'user-message');
            messageInput.value = '';

            isProcessing = true;
            sendButton.disabled = true;

            // Show loading
            const loadingId = addLoadingMessage();

            try {
                if (isAgentCommand) {
                    // Agent mode - modify code directly
                    const instruction = message.substring(6).trim();
                    removeMessage(loadingId);
                    addMessage('Agent', 'Analyzing and modifying your code...', 'ai-message');
                    
                    vscode.postMessage({ 
                        type: 'agentModify', 
                        instruction: instruction 
                    });
                } else {
                    // Normal chat
                    const selectedModel = modelSelector.value;
                    const isClaudeModel = selectedModel.startsWith('claude-');
                    
                    console.log('Sending message to Puter AI:', message, 'Model:', selectedModel);
                    
                    // Call Puter AI without test mode - it will handle auth automatically
                    const response = await puter.ai.chat(message, { 
                        model: selectedModel,
                        temperature: 0.7,
                        max_tokens: 2000
                    });
                    
                    console.log('Received response from Puter AI:', response);
                    
                    // Remove loading message
                    removeMessage(loadingId);
                    
                    // Handle different response formats (Claude vs GPT)
                    let responseText;
                    if (isClaudeModel && response.message && response.message.content) {
                        // Claude format
                        if (Array.isArray(response.message.content)) {
                            responseText = response.message.content[0].text || response.message.content[0];
                        } else {
                            responseText = response.message.content;
                        }
                    } else if (typeof response === 'string') {
                        // GPT format - direct string
                        responseText = response;
                    } else if (response.message && response.message.content) {
                        if (Array.isArray(response.message.content)) {
                            responseText = response.message.content[0].text || response.message.content[0];
                        } else {
                            responseText = response.message.content;
                        }
                    } else {
                        console.log('Response structure:', JSON.stringify(response));
                        responseText = JSON.stringify(response, null, 2);
                    }
                    
                    console.log('Extracted response text:', responseText);
                    
                    // Add AI response
                    addMessage(selectedModel.startsWith('claude') ? 'Claude' : 'GPT', responseText, 'ai-message');
                }
                
            } catch (error) {
                removeMessage(loadingId);
                let errorMessage = error.message || 'Unknown error occurred';

                // Provide helpful error messages
                if (error.message && error.message.includes('401')) {
                    errorMessage = '🔐 Authentication required. Puter should open your browser for authentication. Please:\n1. Complete the sign-in in your browser\n2. Come back to VSCode and reload the window (Ctrl+R or Cmd+R)\n3. Try sending your message again\n\nIf no browser window opened, visit https://puter.com to sign in first.';
                } else if (error.message && error.message.includes('429')) {
                    errorMessage = '⏱️ Rate limit exceeded. Please wait a moment before trying again.';
                } else if (error.message && error.message.includes('network') || error.message && error.message.includes('fetch')) {
                    errorMessage = '🌐 Network error. Please check your internet connection and try again.';
                }

                addMessage('Error', errorMessage, 'ai-message');
            } finally {
                isProcessing = false;
                sendButton.disabled = false;
                messageInput.focus();
            }
        }
        
        // Listen for messages from extension
        window.addEventListener('message', async event => {
            const message = event.data;
            switch (message.type) {
                case 'agentSuccess':
                    addMessage('Agent', \`✅ \${message.summary}\\n\\n\${message.explanation}\`, 'ai-message');
                    isProcessing = false;
                    sendButton.disabled = false;
                    break;
                case 'error':
                    addMessage('Error', message.error, 'ai-message');
                    isProcessing = false;
                    sendButton.disabled = false;
                    break;
                case 'apiRequest':
                    await handleAPIRequest(message.requestId, message.method, message.params);
                    break;
                case 'streamRequest':
                    await handleStreamRequest(message.requestId, message.prompt, message.model, message.temperature, message.max_tokens);
                    break;
                case 'historyResponse':
                    showHistoryStats(message.history);
                    break;
            }
        });

        function showHistoryStats(history) {
            if (!history || history.length === 0) {
                addMessage('System', 'No conversation history yet', 'ai-message');
                return;
            }

            const userCount = history.filter(m => m.role === 'user').length;
            const aiCount = history.filter(m => m.role === 'assistant').length;
            const statsMessage = \`📊 Conversation Stats:\\n\\nTotal messages: \${history.length}\\nUser messages: \${userCount}\\nAI responses: \${aiCount}\\n\\nLast activity: \${new Date(history[history.length - 1].timestamp).toLocaleString()}\`;

            addMessage('System', statsMessage, 'ai-message');
        }

        async function handleAPIRequest(requestId, method, params) {
            try {
                // Check if puter is available
                if (typeof puter === 'undefined' || typeof puter.ai === 'undefined') {
                    throw new Error('Puter.js AI module not available. Please reload the window.');
                }

                const response = await puter.ai.chat(params.prompt, {
                    model: params.model,
                    temperature: params.temperature,
                    max_tokens: params.max_tokens
                });

                let responseText;
                const isClaudeModel = params.model.startsWith('claude-');

                if (isClaudeModel && response.message && response.message.content) {
                    responseText = response.message.content[0].text;
                } else if (typeof response === 'string') {
                    responseText = response;
                } else if (response.message && response.message.content) {
                    responseText = response.message.content[0].text;
                } else {
                    responseText = JSON.stringify(response);
                }

                vscode.postMessage({
                    type: 'apiResponse',
                    response: {
                        requestId,
                        success: true,
                        data: responseText
                    }
                });
            } catch (error) {
                let errorMessage = error.message || 'Unknown error occurred';

                // Provide helpful error messages
                if (error.message && error.message.includes('401')) {
                    errorMessage = '🔐 Authentication required. Puter should open your browser for authentication. Please:\n1. Complete the sign-in in your browser\n2. Come back to VSCode and reload the window (Ctrl+R or Cmd+R)\n3. Try sending your message again\n\nIf no browser window opened, visit https://puter.com to sign in first.';
                } else if (error.message && error.message.includes('429')) {
                    errorMessage = 'Rate limit exceeded. Please wait a moment before trying again.';
                } else if (error.message && error.message.includes('network')) {
                    errorMessage = 'Network error. Please check your internet connection.';
                }

                vscode.postMessage({
                    type: 'apiResponse',
                    response: {
                        requestId,
                        success: false,
                        error: errorMessage
                    }
                });
            }
        }

        async function handleStreamRequest(requestId, prompt, model, temperature, max_tokens) {
            try {
                const stream = await puter.ai.chat(prompt, {
                    model: model,
                    temperature: temperature,
                    max_tokens: max_tokens,
                    stream: true
                });

                if (stream && typeof stream[Symbol.asyncIterator] === 'function') {
                    for await (const chunk of stream) {
                        let chunkText = '';
                        if (typeof chunk === 'string') {
                            chunkText = chunk;
                        } else if (chunk.message && chunk.message.content) {
                            chunkText = chunk.message.content[0].text;
                        }

                        vscode.postMessage({
                            type: 'streamChunk',
                            requestId,
                            chunk: chunkText
                        });
                    }
                    vscode.postMessage({ type: 'streamEnd', requestId });
                } else {
                    // Fallback to non-streaming
                    const response = stream;
                    let responseText = '';
                    if (typeof response === 'string') {
                        responseText = response;
                    } else if (response.message && response.message.content) {
                        responseText = response.message.content[0].text;
                    }
                    vscode.postMessage({ type: 'streamChunk', requestId, chunk: responseText });
                    vscode.postMessage({ type: 'streamEnd', requestId });
                }
            } catch (error) {
                vscode.postMessage({
                    type: 'streamError',
                    requestId,
                    error: error.message
                });
            }
        }
        
        function addMessage(sender, content, className) {
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message ' + className;
            messageDiv.id = 'msg-' + Date.now();
            
            const header = document.createElement('div');
            header.className = 'message-header';
            header.textContent = sender;
            
            const contentDiv = document.createElement('div');
            contentDiv.className = 'message-content';
            
            // Simple code block detection
            if (content.includes('\`\`\`')) {
                contentDiv.innerHTML = formatCodeBlocks(content);
            } else {
                contentDiv.textContent = content;
            }
            
            messageDiv.appendChild(header);
            messageDiv.appendChild(contentDiv);
            
            // Add code actions if message contains code
            if (className === 'ai-message' && content.includes('\`\`\`')) {
                const actions = document.createElement('div');
                actions.className = 'code-actions';
                
                const insertBtn = document.createElement('button');
                insertBtn.className = 'code-action-btn';
                insertBtn.textContent = 'Insert at Cursor';
                insertBtn.onclick = () => {
                    const code = extractCode(content);
                    vscode.postMessage({ type: 'insertCode', code: code });
                };
                
                actions.appendChild(insertBtn);
                messageDiv.appendChild(actions);
            }
            
            chatContainer.appendChild(messageDiv);
            chatContainer.scrollTop = chatContainer.scrollHeight;
            
            return messageDiv.id;
        }
        
        function addLoadingMessage() {
            const loadingDiv = document.createElement('div');
            loadingDiv.className = 'loading';
            loadingDiv.id = 'loading-' + Date.now();
            loadingDiv.innerHTML = '<div class="spinner"></div> Thinking...';
            chatContainer.appendChild(loadingDiv);
            chatContainer.scrollTop = chatContainer.scrollHeight;
            return loadingDiv.id;
        }
        
        function removeMessage(id) {
            const element = document.getElementById(id);
            if (element) {
                element.remove();
            }
        }
        
        function formatCodeBlocks(text) {
            return text.replace(/\`\`\`(\\w+)?\\n?([\\s\\S]*?)\`\`\`/g, (match, lang, code) => {
                return \`<pre><code>\${escapeHtml(code.trim())}</code></pre>\`;
            });
        }
        
        function extractCode(text) {
            const match = text.match(/\`\`\`(?:\\w+)?\\n?([\\s\\S]*?)\`\`\`/);
            return match ? match[1].trim() : text;
        }
        
        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
        
        // Focus input on load
        messageInput.focus();
    </script>
</body>
</html>`;
    }
}
