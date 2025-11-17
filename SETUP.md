# 🚀 Puter AI Agent - Setup Instructions

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Visual Studio Code (v1.85.0 or higher)

## Installation Steps

### 1. Install Dependencies

Open the terminal in the extension folder and run:

\`\`\`bash
npm install
\`\`\`

This will install all required dependencies including TypeScript and VS Code extension APIs.

### 2. Compile TypeScript

Compile the TypeScript source code:

\`\`\`bash
npm run compile
\`\`\`

Or watch for changes during development:

\`\`\`bash
npm run watch
\`\`\`

### 3. Run the Extension

1. Open the extension folder in VS Code
2. Press **F5** to launch the Extension Development Host
3. A new VS Code window will open with your extension loaded

### 4. Test the Extension

In the Extension Development Host window:

1. **Open Chat Sidebar**: Click the Puter AI icon in the activity bar
2. **Test Commands**: 
   - Open any code file
   - Select some code
   - Right-click and try "Explain Code" or other AI commands
3. **Use Command Palette**: Press `Ctrl+Shift+P` and search for "Puter AI"

## Building for Production

### Create VSIX Package

To create a distributable .vsix file:

\`\`\`bash
# Install vsce (VS Code Extension Manager) globally
npm install -g @vscode/vsce

# Package the extension
vsce package
\`\`\`

This creates a `.vsix` file that can be installed in VS Code or published to the marketplace.

### Install VSIX Locally

\`\`\`bash
# Install the packaged extension
code --install-extension puter-ai-agent-1.0.0.vsix
\`\`\`

Or in VS Code:
1. Open Extensions view (`Ctrl+Shift+X`)
2. Click "..." menu → "Install from VSIX..."
3. Select your `.vsix` file

## Publishing to Marketplace

### 1. Create Publisher Account

Visit [Visual Studio Marketplace](https://marketplace.visualstudio.com/) and create a publisher account.

### 2. Get Personal Access Token

1. Go to [Azure DevOps](https://dev.azure.com/)
2. Create a Personal Access Token with "Marketplace (Manage)" scope

### 3. Login to vsce

\`\`\`bash
vsce login your-publisher-name
\`\`\`

### 4. Publish Extension

\`\`\`bash
vsce publish
\`\`\`

Or publish a specific version:

\`\`\`bash
vsce publish 1.0.1
\`\`\`

## Development Tips

### Debugging

- Set breakpoints in your TypeScript files
- Press F5 to start debugging
- Use "Debug Console" to see console.log outputs
- Reload the extension host window with `Ctrl+R` (or `Cmd+R` on Mac)

### Hot Reload

When running with `npm run watch`, the extension will automatically recompile when you save files. However, you still need to reload the Extension Development Host window.

### Viewing Logs

- **Extension Host Logs**: Help → Toggle Developer Tools → Console
- **Webview Logs**: Right-click in the webview → "Inspect" → Console

## Configuration

### Change Default Settings

Edit `package.json` to modify default configuration values:

\`\`\`json
"configuration": {
  "properties": {
    "puterAI.defaultModel": {
      "default": "gpt-5-nano"
    }
  }
}
\`\`\`

### Add New Commands

1. Add command to `package.json` under `contributes.commands`
2. Register command handler in `src/extension.ts`
3. Optionally add to context menu in `contributes.menus`

## Troubleshooting

### "Cannot find module 'vscode'"

Run: \`npm install\`

### Extension doesn't activate

Check the activation events in `package.json`. Current setting activates on startup.

### Webview not showing

1. Check browser console for errors (right-click → Inspect)
2. Verify Puter.js script is loading
3. Check Content Security Policy settings

### Commands not appearing

1. Verify commands are registered in `package.json`
2. Check `when` clauses for command visibility
3. Reload VS Code window

## File Structure

\`\`\`
puter-vscode-agent/
├── src/
│   ├── extension.ts          # Main extension entry point
│   ├── chatViewProvider.ts   # Chat sidebar webview
│   └── puterAIService.ts     # Puter AI integration
├── resources/
│   └── icon.svg              # Extension icon
├── out/                      # Compiled JavaScript (generated)
├── package.json              # Extension manifest
├── tsconfig.json             # TypeScript configuration
└── README.md                 # User documentation
\`\`\`

## Next Steps

1. **Customize Icon**: Replace `resources/icon.svg` with your own design
2. **Add Features**: Implement additional AI-powered commands
3. **Improve UI**: Enhance the chat interface with markdown rendering
4. **Add Tests**: Create unit tests in `src/test/`
5. **Update README**: Add screenshots and detailed usage instructions

## Support

For issues or questions:
- Check VS Code Extension API docs: https://code.visualstudio.com/api
- Puter.js documentation: https://puter.com
- GitHub Issues: [Your repository URL]

## License

MIT License - See LICENSE file for details
