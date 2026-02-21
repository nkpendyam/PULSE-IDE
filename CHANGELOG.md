# Changelog

All notable changes to Kyro IDE will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-02-21

### Added

#### AI Features
- Multi-agent AI system with 10 specialized agents (Architect, Coder, Reviewer, Debugger, Tester, Refactorer, Documenter, Optimizer, Security, Researcher)
- AI chat panel with codebase context awareness
- Inline code completion powered by AI
- Multi-file AI editing with preview and accept/reject
- Local LLM support via Ollama integration
- Cloud AI models support (Claude 3, GPT-4)

#### Code Intelligence
- Tree-sitter integration for 12+ languages (TypeScript, JavaScript, Python, Rust, Go, JSON, HTML, CSS, YAML, Markdown)
- Go to Definition functionality
- Find References across codebase
- Symbol extraction and outline
- Scope analysis
- Syntax highlighting via Tree-sitter

#### Codebase Indexing
- Semantic code search using RAG (Retrieval-Augmented Generation)
- Vector database with IndexedDB storage
- Trie-based symbol index for fast lookups
- Find similar code patterns
- Incremental file indexing
- Natural language code search

#### Debugger
- Multi-language debugging support (Node.js, Python, Go)
- Conditional breakpoints with expressions
- Hit count breakpoints
- Logpoints (print without modifying code)
- Variable inspection with nested expansion
- Watch expressions
- Step over/into/out, continue, pause, restart

#### Real-Time Collaboration
- CRDT-based conflict-free editing
- Live cursor sharing
- Presence indicators
- Room-based collaborative sessions
- WebSocket synchronization

#### Remote Development
- SSH connection support
- Docker container development
- WSL (Windows Subsystem for Linux) support
- File system access over SSH
- Terminal access to remote machines
- Port forwarding

#### Extension System
- VS Code-compatible extension API
- Extension host with lifecycle management
- API surface: workspace, window, commands, languages
- Extension marketplace
- Contribution points for commands, languages, themes, keybindings

#### Editor Features
- Monaco Editor integration
- Multi-tab interface
- File explorer with CRUD operations
- Integrated terminal with xterm.js
- Git integration (blame, diff, history)
- Command palette (Ctrl+Shift+P)
- Theme support
- Resizable panels

### Technical
- Next.js 16 with App Router
- React 19
- TypeScript 5
- Tailwind CSS 4
- Tauri for cross-platform desktop
- z-ai-web-dev-sdk for AI integration

### Documentation
- Comprehensive README with feature comparison
- Contributing guidelines
- API documentation

## [0.1.0] - 2025-02-20

### Added
- Initial project structure
- Basic IDE layout
- Monaco Editor integration
- File explorer
- Terminal integration
- Basic AI chat panel
