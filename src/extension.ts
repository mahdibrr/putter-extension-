import * as vscode from 'vscode';
import { PuterChatViewProvider } from './chatViewProvider';
import { PuterAIService } from './puterAIService';

export function activate(context: vscode.ExtensionContext) {
    console.log('Puter AI Agent is now active!');

    // Initialize Puter AI Service
    const aiService = new PuterAIService();

    // Register Chat Sidebar
    const chatProvider = new PuterChatViewProvider(context.extensionUri, aiService);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            'puter-ai-chat',
            chatProvider
        )
    );

    // Register Commands
    
    // Explain Code
    context.subscriptions.push(
        vscode.commands.registerCommand('puter-ai.explainCode', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active editor found');
                return;
            }

            const selection = editor.selection;
            const selectedText = editor.document.getText(selection);
            
            if (!selectedText) {
                vscode.window.showWarningMessage('Please select some code first');
                return;
            }

            const language = editor.document.languageId;
            
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Explaining code...",
                cancellable: false
            }, async () => {
                try {
                    const explanation = await aiService.explainCode(selectedText, language);
                    
                    // Show in new document
                    const doc = await vscode.workspace.openTextDocument({
                        content: `# Code Explanation\n\n## Original Code (${language}):\n\`\`\`${language}\n${selectedText}\n\`\`\`\n\n## Explanation:\n${explanation}`,
                        language: 'markdown'
                    });
                    await vscode.window.showTextDocument(doc);
                } catch (error: any) {
                    vscode.window.showErrorMessage(`Error: ${error.message}`);
                }
            });
        })
    );

    // Generate Code
    context.subscriptions.push(
        vscode.commands.registerCommand('puter-ai.generateCode', async () => {
            const description = await vscode.window.showInputBox({
                prompt: 'Describe what code you want to generate',
                placeHolder: 'e.g., Create a function that sorts an array of objects by date'
            });

            if (!description) {
                return;
            }

            const editor = vscode.window.activeTextEditor;
            const language = editor?.document.languageId || 'javascript';

            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Generating code...",
                cancellable: false
            }, async () => {
                try {
                    const code = await aiService.generateCode(description, language);
                    
                    if (editor) {
                        editor.edit(editBuilder => {
                            editBuilder.insert(editor.selection.active, code);
                        });
                    } else {
                        const doc = await vscode.workspace.openTextDocument({
                            content: code,
                            language: language
                        });
                        await vscode.window.showTextDocument(doc);
                    }
                } catch (error: any) {
                    vscode.window.showErrorMessage(`Error: ${error.message}`);
                }
            });
        })
    );

    // Refactor Code
    context.subscriptions.push(
        vscode.commands.registerCommand('puter-ai.refactorCode', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active editor found');
                return;
            }

            const selection = editor.selection;
            const selectedText = editor.document.getText(selection);
            
            if (!selectedText) {
                vscode.window.showWarningMessage('Please select some code first');
                return;
            }

            const language = editor.document.languageId;

            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Refactoring code...",
                cancellable: false
            }, async () => {
                try {
                    const refactoredCode = await aiService.refactorCode(selectedText, language);
                    
                    editor.edit(editBuilder => {
                        editBuilder.replace(selection, refactoredCode);
                    });
                    
                    vscode.window.showInformationMessage('Code refactored successfully!');
                } catch (error: any) {
                    vscode.window.showErrorMessage(`Error: ${error.message}`);
                }
            });
        })
    );

    // Add Comments
    context.subscriptions.push(
        vscode.commands.registerCommand('puter-ai.addComments', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active editor found');
                return;
            }

            const selection = editor.selection;
            const selectedText = editor.document.getText(selection);
            
            if (!selectedText) {
                vscode.window.showWarningMessage('Please select some code first');
                return;
            }

            const language = editor.document.languageId;

            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Adding comments...",
                cancellable: false
            }, async () => {
                try {
                    const commentedCode = await aiService.addComments(selectedText, language);
                    
                    editor.edit(editBuilder => {
                        editBuilder.replace(selection, commentedCode);
                    });
                    
                    vscode.window.showInformationMessage('Comments added successfully!');
                } catch (error: any) {
                    vscode.window.showErrorMessage(`Error: ${error.message}`);
                }
            });
        })
    );

    // Fix Errors
    context.subscriptions.push(
        vscode.commands.registerCommand('puter-ai.fixErrors', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active editor found');
                return;
            }

            const selection = editor.selection;
            const selectedText = editor.document.getText(selection);
            
            if (!selectedText) {
                vscode.window.showWarningMessage('Please select some code first');
                return;
            }

            const language = editor.document.languageId;

            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Fixing errors...",
                cancellable: false
            }, async () => {
                try {
                    const fixedCode = await aiService.fixErrors(selectedText, language);
                    
                    editor.edit(editBuilder => {
                        editBuilder.replace(selection, fixedCode);
                    });
                    
                    vscode.window.showInformationMessage('Code fixed successfully!');
                } catch (error: any) {
                    vscode.window.showErrorMessage(`Error: ${error.message}`);
                }
            });
        })
    );

    // Generate Tests
    context.subscriptions.push(
        vscode.commands.registerCommand('puter-ai.generateTests', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active editor found');
                return;
            }

            const selection = editor.selection;
            const selectedText = editor.document.getText(selection);
            
            if (!selectedText) {
                vscode.window.showWarningMessage('Please select some code first');
                return;
            }

            const language = editor.document.languageId;

            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Generating tests...",
                cancellable: false
            }, async () => {
                try {
                    const tests = await aiService.generateTests(selectedText, language);
                    
                    // Create new test file
                    const doc = await vscode.workspace.openTextDocument({
                        content: tests,
                        language: language
                    });
                    await vscode.window.showTextDocument(doc);
                    
                    vscode.window.showInformationMessage('Tests generated successfully!');
                } catch (error: any) {
                    vscode.window.showErrorMessage(`Error: ${error.message}`);
                }
            });
        })
    );

    // Open Chat
    context.subscriptions.push(
        vscode.commands.registerCommand('puter-ai.openChat', () => {
            vscode.commands.executeCommand('puter-ai-chat.focus');
        })
    );

    // Agent Mode
    context.subscriptions.push(
        vscode.commands.registerCommand('puter-ai.agentMode', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active editor found');
                return;
            }

            const config = vscode.workspace.getConfiguration('puterAI');
            if (!config.get<boolean>('enableAgentMode', false)) {
                const enable = await vscode.window.showWarningMessage(
                    'Agent Mode is disabled. Enable it to allow AI to modify your code directly.',
                    'Enable Agent Mode',
                    'Cancel'
                );
                
                if (enable === 'Enable Agent Mode') {
                    await config.update('enableAgentMode', true, vscode.ConfigurationTarget.Global);
                } else {
                    return;
                }
            }

            const instruction = await vscode.window.showInputBox({
                prompt: 'What changes do you want the agent to make?',
                placeHolder: 'e.g., Add error handling, refactor to use async/await, add TypeScript types'
            });

            if (!instruction) {
                return;
            }

            const selection = editor.selection;
            const selectedText = editor.document.getText(selection);
            const fullText = selectedText || editor.document.getText();
            const language = editor.document.languageId;
            const filePath = editor.document.fileName;

            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Agent is analyzing and modifying code...",
                cancellable: false
            }, async () => {
                try {
                    const result = await aiService.agentModifyCode(instruction, fullText, language, filePath);
                    
                    // Show preview of changes
                    const autoApply = config.get<boolean>('agentAutoApply', false);
                    
                    if (!autoApply) {
                        const action = await vscode.window.showInformationMessage(
                            `Agent Changes: ${result.changesSummary}\n\n${result.explanation}`,
                            'Apply Changes',
                            'Preview Diff',
                            'Cancel'
                        );
                        
                        if (action === 'Preview Diff') {
                            // Show diff
                            const originalDoc = await vscode.workspace.openTextDocument({
                                content: fullText,
                                language: language
                            });
                            
                            const modifiedDoc = await vscode.workspace.openTextDocument({
                                content: result.modifiedCode,
                                language: language
                            });
                            
                            await vscode.commands.executeCommand('vscode.diff', 
                                originalDoc.uri, 
                                modifiedDoc.uri, 
                                'Agent Changes Preview'
                            );
                            
                            const apply = await vscode.window.showInformationMessage(
                                'Apply these changes?',
                                'Apply',
                                'Cancel'
                            );
                            
                            if (apply !== 'Apply') {
                                return;
                            }
                        } else if (action !== 'Apply Changes') {
                            return;
                        }
                    }
                    
                    // Apply changes
                    await editor.edit((editBuilder: vscode.TextEditorEdit) => {
                        if (selectedText) {
                            editBuilder.replace(selection, result.modifiedCode);
                        } else {
                            const fullRange = new vscode.Range(
                                editor.document.positionAt(0),
                                editor.document.positionAt(editor.document.getText().length)
                            );
                            editBuilder.replace(fullRange, result.modifiedCode);
                        }
                    });
                    
                    vscode.window.showInformationMessage(`✅ Agent applied changes: ${result.changesSummary}`);
                    
                } catch (error: any) {
                    vscode.window.showErrorMessage(`Agent Error: ${error.message}`);
                }
            });
        })
    );

    // Toggle Agent Mode
    context.subscriptions.push(
        vscode.commands.registerCommand('puter-ai.toggleAgentMode', async () => {
            const config = vscode.workspace.getConfiguration('puterAI');
            const currentValue = config.get<boolean>('enableAgentMode', false);
            await config.update('enableAgentMode', !currentValue, vscode.ConfigurationTarget.Global);
            
            vscode.window.showInformationMessage(
                `Agent Mode ${!currentValue ? 'enabled ✅' : 'disabled ❌'}`
            );
        })
    );

    vscode.window.showInformationMessage('Puter AI Agent is ready! 🚀 (Now with Claude & Agent Mode)');
}

export function deactivate() {}
