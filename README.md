# Kyro IDE

<div align="center">

![Kyro IDE Logo](https://img.shields.io/badge/Kyro_IDE-v1.0.0-blue?style=for-the-badge)
![License](https://img.shields.io/badge/license-MIT-green?style=for-the-badge)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey?style=for-the-badge)

**A powerful, open-source AI-powered IDE that rivals Cursor, VS Code, and Zed**

[Features](#-features) • [Quick Start](#-quick-start) • [Architecture](#-architecture) • [Comparison](#-feature-comparison)

</div>

---

## 🌟 Overview

Kyro IDE is a next-generation Integrated Development Environment that combines cutting-edge AI capabilities with a modern, performant architecture. Built with TypeScript, React, and Rust (Tauri), it delivers a seamless coding experience across all major platforms.

### Why Kyro IDE?

- 🤖 **AI-First Design** - Multiple specialized AI agents working together
- ⚡ **Blazing Fast** - Tree-sitter parsing, incremental indexing, optimized performance
- 🔒 **Privacy Focused** - Run AI locally with Ollama, your code never leaves your machine
- 🔓 **Fully Open Source** - MIT licensed, community-driven development
- 🔌 **Extensible** - VS Code-compatible extension API

---

## ✨ Features

### 🤖 AI-Powered Development

Kyro IDE features a revolutionary multi-agent AI system with 10 specialized agents:

| Agent | Role | Use Case |
|-------|------|----------|
| 🏗️ **Architect** | System Design | Architecture decisions, design patterns |
| 💻 **Coder** | Code Generation | Write new features, implement specs |
| 🔍 **Reviewer** | Code Quality | Code reviews, best practices |
| 🐛 **Debugger** | Bug Fixing | Find and fix bugs, error analysis |
| 🧪 **Tester** | Testing | Generate tests, test strategies |
| 🔧 **Refactorer** | Refactoring | Clean code, improve structure |
| 📝 **Documenter** | Documentation | Generate docs, comments |
| ⚡ **Optimizer** | Performance | Optimize slow code, profiling |
| 🔒 **Security** | Security | Vulnerability scanning, secure code |
| 🔬 **Researcher** | Research | Find information, explore solutions |

**AI Capabilities:**
- **Inline Code Completion** - Intelligent suggestions as you type
- **AI Chat Panel** - Conversational interface with full codebase context
- **Multi-file Edits** - AI edits multiple files atomically with preview
- **Local LLM Support** - Full Ollama integration for offline AI

### 🌳 Code Intelligence (Tree-sitter)

Powered by Tree-sitter for lightning-fast, incremental parsing:

- **12+ Languages** - TypeScript, JavaScript, Python, Rust, Go, JSON, HTML, CSS, YAML, Markdown, and more
- **Go to Definition** - Instant navigation to symbol definitions
- **Find References** - Find all usages across the entire codebase
- **Symbol Outline** - Document structure at a glance
- **Scope Analysis** - Understand variable visibility and bindings
- **Syntax Highlighting** - Accurate, theme-aware highlighting

### 🔍 Codebase Indexing (RAG)

Semantic code search powered by vector embeddings:

- **Natural Language Search** - "Find authentication logic" finds relevant code
- **Vector Database** - IndexedDB-backed storage for embeddings
- **Trie Symbol Index** - Sub-millisecond symbol lookups
- **Find Similar Code** - Discover code patterns and duplicates
- **Incremental Updates** - Only re-index changed files

### 🐛 Multi-Language Debugger

Professional debugging support via Debug Adapter Protocol:

| Language | Adapter | Features |
|----------|---------|----------|
| **Node.js** | Built-in | Breakpoints, variables, call stack |
| **Python** | Debugpy | Virtual environments, Django/Flask |
| **Go** | Delve | Goroutines, goroutine tracing |

**Debugger Features:**
- Conditional breakpoints with expressions
- Hit count breakpoints
- Logpoints (print without modifying code)
- Variable inspection with nested expansion
- Watch expressions
- Step over/into/out, continue, pause, restart

### 👥 Real-Time Collaboration

CRDT-based collaboration without conflicts:

- **Live Cursor Sharing** - See collaborators' cursors in real-time
- **Presence Indicators** - Know who's viewing which file
- **Conflict-Free Editing** - CRDT ensures no merge conflicts
- **WebSocket Sync** - Low-latency updates across team members
- **Room-Based Sessions** - Create/join collaborative sessions

### 🌐 Remote Development

Develop anywhere, anytime:

| Protocol | Use Case |
|----------|----------|
| **SSH** | Connect to remote servers |
| **Docker** | Develop in containers |
| **WSL** | Windows Subsystem for Linux |

**Remote Features:**
- File system access over SSH
- Terminal access to remote machines
- Port forwarding
- Container-aware development

### 🧩 Extension System

VS Code-compatible extension API:

- **Extension Host** - Full lifecycle management
- **API Surface** - `workspace`, `window`, `commands`, `languages`
- **Contributions** - Commands, languages, themes, keybindings, menus
- **Extension Marketplace** - Browse and install community extensions

### 🖥️ Professional Editor

Built on the same foundation as VS Code:

- **Monaco Editor** - VS Code's battle-tested editor core
- **Multi-tab Interface** - Work with many files simultaneously
- **File Explorer** - Navigate, create, delete, rename files
- **Integrated Terminal** - Full PTY support with xterm.js
- **Git Integration** - Blame, diff, history, staging
- **Command Palette** - Quick access to everything (Ctrl+Shift+P)
- **Themes** - Multiple built-in color themes

---

## 🛠️ Technology Stack

### Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 16 | React framework with App Router |
| React | 19 | Modern UI library |
| TypeScript | 5 | Type-safe JavaScript |
| Tailwind CSS | 4 | Utility-first styling |
| shadcn/ui | Latest | Beautiful UI components |

### Code Intelligence

| Library | Purpose |
|---------|---------|
| Tree-sitter | Incremental parsing with WASM grammars |
| Monaco Editor | VS Code's editor engine |
| xterm.js | Terminal emulation |

### AI Integration

| SDK | Purpose |
|-----|---------|
| z-ai-web-dev-sdk | Cloud AI models (Claude, GPT, etc.) |
| Ollama | Local LLM runtime |

### Desktop & Backend

| Framework | Purpose |
|-----------|---------|
| Tauri | Cross-platform desktop (Rust backend) |
| WebSocket | Real-time collaboration |

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ or Bun
- Git

### Development Setup

```bash
# Clone the repository
git clone https://github.com/nkpendyam/Kyro_IDE.git
cd Kyro_IDE

# Install dependencies
bun install

# Start development server
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) to use Kyro IDE.

### Desktop App (Tauri)

```bash
# Development mode
bun run tauri:dev

# Build production app
bun run tauri:build
```

---

## 📦 Project Structure

```
src/
├── app/                      # Next.js App Router
│   ├── api/                  # Backend API routes
│   │   ├── ide/route.ts      # AI endpoints
│   │   ├── git/route.ts      # Git operations
│   │   └── debug/route.ts    # Debug operations
│   └── page.tsx              # Main IDE page
│
├── components/               # React components
│   ├── editor/               # Monaco editor wrapper
│   ├── terminal/             # xterm.js terminal
│   ├── chat/                 # AI chat panel
│   ├── git/                  # Git integration UI
│   ├── debugger/             # Debugger panel
│   ├── collaboration/        # Real-time collab UI
│   ├── marketplace/          # Extension marketplace
│   └── remote/               # Remote dev connection
│
├── lib/                      # Core libraries
│   ├── parser/               # Tree-sitter parsing
│   │   ├── tree-sitter-service.ts
│   │   ├── syntax-highlighter.ts
│   │   └── code-intelligence.ts
│   ├── indexing/             # Code indexing & RAG
│   │   ├── code-indexer.ts
│   │   ├── vector-store.ts
│   │   └── semantic-search.ts
│   ├── ai/                   # AI services
│   │   ├── ai-service.ts     # Multi-provider AI
│   │   ├── edit-manager.ts   # AI edit tracking
│   │   └── multi-file-editor.ts
│   ├── debug/                # Debugger implementation
│   │   └── debugger-manager.ts
│   ├── extensions/           # Extension system
│   │   ├── extension-host.ts
│   │   └── extension-api.ts
│   ├── collaboration/        # Real-time collab
│   │   ├── crdt-engine.ts
│   │   └── websocket-sync.ts
│   ├── remote/               # Remote development
│   │   └── connection-manager.ts
│   └── pulse/                # IDE core logic
│       └── ai/               # Agent definitions
│
└── types/                    # TypeScript definitions
```

---

## 📊 Feature Comparison

| Feature | Kyro IDE | VS Code | Cursor | Zed | JetBrains |
|---------|:--------:|:-------:|:------:|:---:|:---------:|
| **AI Chat** | ✅ | Plugin | ✅ | ✅ | Plugin |
| **Local LLM** | ✅ | Plugin | ❌ | ❌ | ❌ |
| **Multi-Agent AI** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Semantic Code Search** | ✅ | ❌ | ✅ | ❌ | ❌ |
| **Multi-file AI Edits** | ✅ | ❌ | ✅ | ❌ | ❌ |
| **Tree-sitter Parsing** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Extension API** | ✅ | ✅ | ❌ | 🔧 | ✅ |
| **Real-time Collab** | ✅ | Plugin | ❌ | ✅ | Plugin |
| **Remote Development** | ✅ | ✅ | ❌ | 🔧 | ✅ |
| **Open Source** | ✅ MIT | ✅ MIT | ❌ | ✅ GPL | ❌ |
| **Free Forever** | ✅ | ✅ | Freemium | ✅ | Paid |

---

## 🔧 Available Scripts

```bash
bun run dev              # Start development server
bun run build            # Build for production
bun run lint             # Run ESLint
bun run tauri:dev        # Start Tauri in dev mode
bun run tauri:build      # Build desktop application
```

---

## 🌐 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ide` | GET | Get available models and agents |
| `/api/ide` | POST | Chat, code completion, search |
| `/api/git` | POST | Git operations (status, commit, etc.) |
| `/api/debug` | POST | Debug operations (start, step, etc.) |
| `/api/collab` | WS | Real-time collaboration |

---

## 🎯 Roadmap

### ✅ v1.0 - Completed

- [x] Multi-agent AI system with 10 specialized agents
- [x] AI chat with full codebase context
- [x] Tree-sitter parsing for 12+ languages
- [x] Codebase indexing with RAG and semantic search
- [x] Multi-file AI editing with preview
- [x] VS Code-compatible extension API
- [x] Multi-language debugger (Node.js, Python, Go)
- [x] Real-time collaboration (CRDT-based)
- [x] Extension marketplace
- [x] Remote development (SSH, Docker, WSL)
- [x] Command palette
- [x] Cross-platform desktop (Tauri)

### 🚧 v1.1 - In Progress

- [ ] Live Share integration with VS Code users
- [ ] Cloud settings sync
- [ ] AI-powered code review workflows

### 📋 v1.2 - Planned

- [ ] Enterprise features (SSO, audit logs)
- [ ] Team workspaces
- [ ] Integrated CI/CD visualization

---

## 🤝 Contributing

We welcome contributions! Please see our contributing guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing`)
5. Open a Pull Request

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [Monaco Editor](https://microsoft.github.io/monaco-editor/) - VS Code's editor
- [Tree-sitter](https://tree-sitter.github.io/tree-sitter/) - Incremental parsing
- [Tauri](https://tauri.app/) - Cross-platform desktop framework
- [shadcn/ui](https://ui.shadcn.com/) - Beautiful UI components
- [z-ai-web-dev-sdk](https://github.com/nkpendyam/Kyro_IDE) - AI integration

---

<div align="center">

**Built with ❤️ for developers who want AI-powered coding assistance.**

[⬆ Back to Top](#kyro-ide)

</div>
