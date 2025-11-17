# Change Log

All notable changes to the "Puter AI Agent" extension will be documented in this file.

## [1.0.0] - 2024-11-17

### Added
- Initial release of Puter AI Agent
- AI-powered chat sidebar with multiple AI models support
  - Claude Sonnet 4.5, Opus 4.1, Haiku 4.5
  - GPT-5, GPT-5 Nano, GPT-4o
- Code explanation feature
- Code generation from natural language descriptions
- Intelligent code refactoring
- Automatic comment generation
- AI-powered error fixing
- Unit test generation
- Agent Mode for direct code modifications
- Keyboard shortcuts for quick access
  - `Ctrl+Shift+E` / `Cmd+Shift+E`: Explain selected code
  - `Ctrl+Shift+G` / `Cmd+Shift+G`: Generate code
- Context-aware AI responses with workspace integration
- Streaming responses for better UX
- Conversation history management
- Multiple AI model selection in chat interface
- No API keys required - uses Puter.js for free AI access
- Support for browser-based authentication via Puter.com
- Configurable temperature and max tokens settings
- Auto-apply option for agent mode changes
- Diff preview for agent modifications
- Context menu integration for selected code
- Command palette integration

### Features
- **Free AI Access**: No API keys needed, powered by Puter.js
- **Multiple AI Models**: Choose between Claude and GPT models
- **Agent Mode**: AI can directly modify your code with your approval
- **Smart Context**: AI understands your workspace and file context
- **Streaming**: Real-time response streaming for better experience
- **Code Actions**: Insert AI-generated code at cursor position
- **History Management**: Track conversation history and stats

### Technical
- TypeScript implementation
- VS Code Webview API for chat interface
- Puter.js v2 integration
- Content Security Policy compliant
- Source maps for debugging
- ESLint for code quality
- Comprehensive error handling

## [Unreleased]

### Planned
- Multi-file context awareness
- Code review mode
- Custom AI prompts
- Enhanced markdown rendering in chat
- Code snippet library
- Export conversation history
- Inline code suggestions
- Integration with popular testing frameworks
