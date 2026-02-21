# Kyro IDE

A powerful, open-source AI-powered Integrated Development Environment built with modern web technologies. Kyro IDE combines the flexibility of a web-based code editor with the power of multi-agent AI assistance.

## ✨ Features

### 🤖 AI-Powered Development
- **Multi-Agent AI System** - 10 specialized AI agents (Architect, Coder, Reviewer, Debugger, Tester, Refactorer, Documenter, Optimizer, Security, Researcher)
- **AI Inline Completion** - Intelligent code suggestions powered by Claude, GPT, or local models
- **AI Chat Panel** - Interactive chat interface for code assistance with context awareness
- **Multi-file AI Edits** - AI can edit multiple files atomically with preview and accept/reject
- **Local LLM Support** - Full Ollama integration for privacy-first AI

### 📝 Code Intelligence (Tree-sitter)
- **Incremental Parsing** - Lightning-fast syntax analysis
- **12+ Languages** - TypeScript, JavaScript, Python, Rust, Go, JSON, HTML, CSS, YAML, Markdown
- **Go to Definition** - Jump to symbol definitions
- **Find References** - Find all usages across the codebase
- **Symbol Extraction** - Document outline and symbol navigation
- **Scope Analysis** - Understand variable scopes

### 🔍 Codebase Indexing (RAG)
- **Semantic Search** - Find code by natural language description
- **Vector Database** - IndexedDB-backed vector store for embeddings
- **Symbol Index** - Trie-based fast symbol lookup
- **Find Similar Code** - Discover code patterns across your project
- **Incremental Updates** - Only re-index changed files

### 🐛 Multi-Language Debugger
- **Node.js Debugging** - Full JavaScript/TypeScript support
- **Python Debugging** - Debugpy-compatible adapter
- **Go Debugging** - Delve integration
- **Breakpoints** - Conditions, hit counts, logpoints
- **Variable Inspection** - Scopes, watches, evaluation
- **Step Controls** - Step over, into, out, continue, pause

### 🔌 Extension System
- **VS Code Compatible API** - Familiar extension development
- **Extension Host** - Full lifecycle management
- **API Surface** - workspace, window, commands, languages
- **Contributions** - Commands, languages, themes, keybindings

### 🖥️ Code Editor
- **Monaco Editor** - VS Code's editor core
- **Multi-tab Support** - Work with multiple files simultaneously
- **File Explorer** - Navigate and manage your project files
- **Integrated Terminal** - Full PTY terminal support with xterm.js
- **Git Integration** - Blame annotations, diff viewer, file history

### 🎨 User Experience
- **Command Palette** - Quick access to all commands (Ctrl+Shift+P)
- **Theme Support** - Multiple color themes
- **Keyboard Shortcuts** - Efficient workflow shortcuts
- **Resizable Panels** - Customize your layout

## 🛠️ Technology Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| Next.js 16 | React framework with App Router |
| React 19 | Modern UI library |
| TypeScript 5 | Type-safe JavaScript |
| Tailwind CSS 4 | Utility-first styling |
| shadcn/ui | Beautiful UI components |

### Code Intelligence
| Library | Purpose |
|---------|---------|
| Tree-sitter | Incremental parsing |
| Monaco Editor | Code editing |
| xterm.js | Terminal emulation |

### AI Integration
| SDK | Purpose |
|-----|---------|
| z-ai-web-dev-sdk | AI capabilities |
| Ollama | Local LLM runtime |

### Desktop
| Framework | Purpose |
|-----------|---------|
| Tauri | Cross-platform desktop app |
| Rust | High-performance backend |

## 🚀 Quick Start

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

## 📦 Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # Backend API routes
│   └── page.tsx           # Main IDE page
├── components/            # React components
│   ├── editor/            # Code editor components
│   ├── terminal/          # Terminal components
│   ├── chat/              # AI chat panel
│   ├── git/               # Git integration
│   ├── debugger/          # Debugger panel
│   └── ...                # Other components
├── lib/                   # Core libraries
│   ├── parser/            # Tree-sitter parsing
│   ├── indexing/          # Code indexing & search
│   ├── ai/                # AI services & editing
│   ├── debug/             # Debugger implementation
│   ├── extensions/        # Extension system
│   ├── pulse/             # IDE core logic
│   └── ...                # Other utilities
└── types/                 # TypeScript types
```

## 🤖 AI Agents

| Agent | Description | Model |
|-------|-------------|-------|
| 🏗️ Architect | System design and architecture decisions | Claude 3 Opus |
| 💻 Coder | Code generation and implementation | Claude 3.5 Sonnet |
| 🔍 Reviewer | Code review and quality analysis | Claude 3.5 Sonnet |
| 🐛 Debugger | Bug detection and fixing | Claude 3.5 Sonnet |
| 🧪 Tester | Test generation and execution | Claude 3.5 Sonnet |
| 🔧 Refactorer | Code refactoring | Claude 3.5 Sonnet |
| 📝 Documenter | Documentation generation | Claude 3 Haiku |
| ⚡ Optimizer | Performance optimization | Claude 3.5 Sonnet |
| 🔒 Security | Security analysis | Claude 3 Opus |
| 🔬 Researcher | Research and information gathering | Claude 3.5 Sonnet |

## 🔧 Available Scripts

```bash
bun run dev          # Start development server
bun run build        # Build for production
bun run lint         # Run ESLint
bun run tauri:dev    # Start Tauri in dev mode
bun run tauri:build  # Build desktop application
```

## 🌐 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ide` | GET | Get models, agents, status |
| `/api/ide` | POST | Chat, complete, search |
| `/api/git` | POST | Git operations |
| `/api/debug` | POST | Debug operations |

## 📊 Feature Comparison

| Feature | Kyro IDE | VS Code | Cursor | Zed |
|---------|----------|---------|--------|-----|
| **AI Chat** | ✅ | Plugin | ✅ | ✅ |
| **Local LLM** | ✅ | Plugin | ❌ | ❌ |
| **Multi-Agent AI** | ✅ | ❌ | ❌ | ❌ |
| **Tree-sitter** | ✅ | ✅ | ✅ | ✅ |
| **Semantic Search** | ✅ | ❌ | ✅ | ❌ |
| **Multi-file AI Edits** | ✅ | ❌ | ✅ | ❌ |
| **Extension API** | ✅ | ✅ | ❌ | 🔧 |
| **Open Source** | ✅ MIT | ✅ MIT | ❌ | ✅ GPL |

## 🎯 Roadmap

### ✅ Completed
- [x] AI Chat with context awareness
- [x] Tree-sitter parsing for 12+ languages
- [x] Codebase indexing with vector search
- [x] Multi-file AI editing
- [x] VS Code-compatible extension API
- [x] Multi-language debugger (Node, Python, Go)
- [x] Command palette

### 🚧 In Progress
- [ ] Real-time collaboration
- [ ] Extension marketplace
- [ ] Remote development (SSH, Docker)

### 📋 Planned
- [ ] Live Share integration
- [ ] Cloud settings sync
- [ ] Enterprise features (SSO, audit logs)

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## 📄 License

MIT License - see LICENSE file for details.

---

Built with ❤️ for developers who want AI-powered coding assistance.
