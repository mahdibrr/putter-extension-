# Change Log

All notable changes to the "Puter AI Agent" extension will be documented in this file.

## [1.0.0] - 2024-11-17

### Added
- Initial release of Puter AI Agent extension
- AI Chat Sidebar with interactive interface
- Code explanation feature (right-click on selected code)
- Code refactoring capability
- Auto-comment generation
- Error fixing assistance
- Unit test generation
- Agent Mode for direct code modification
- Support for multiple AI models:
  - Claude Sonnet 4.5
  - Claude Opus 4.1
  - Claude Haiku 4.5
  - Claude Sonnet 4
  - Claude Opus 4
  - GPT-5 series (5, 5-nano, 5-mini)
  - GPT-4o
- Configuration options:
  - Model selection
  - Temperature control
  - Max tokens setting
  - Streaming responses
  - Agent mode toggle
  - Auto-apply agent changes
- Context menu integration
- Command palette commands
- Free AI access through Puter.js (no API keys required)
- Comprehensive documentation (README, SETUP, FAQ)

### Features
- **No API Keys Required**: Uses Puter.js for free AI access
- **Multi-Model Support**: Switch between Claude and GPT models
- **Agent Mode**: AI can directly modify your code with approval
- **Context-Aware**: Understands your workspace and active files
- **Streaming Responses**: Real-time AI responses
- **Code Actions**: Insert generated code at cursor position
- **Conversation History**: Track your AI interactions
- **Statistics**: View conversation stats

### Configuration
- All settings available in VS Code settings
- Customizable default model
- Adjustable temperature and token limits
- Toggle streaming and agent features

### Known Issues
- Webview authentication may require browser sign-in on first use
- After Puter authentication, VS Code reload (Ctrl+R) may be needed
- Rate limits apply based on Puter.js free tier

### Documentation
- README.md with feature overview and usage instructions
- SETUP.md with detailed installation and development guide
- FAQ section in README
- Inline code documentation

## Future Improvements
- [ ] Enhanced markdown rendering in chat
- [ ] Syntax highlighting for code blocks
- [ ] File attachment support
- [ ] Multi-file context awareness
- [ ] Custom prompt templates
- [ ] Conversation export/import
- [ ] Dark/Light theme customization
- [ ] Code diff preview improvements
- [ ] Offline mode with caching
- [ ] Extension API for other extensions
