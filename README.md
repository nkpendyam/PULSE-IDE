# KYRO IDE

**AI-Powered Code Editor** - A lightweight, fast, and intelligent development environment with local AI support.

## Features

### Core Editor
- **Monaco Editor** - VS Code's editor engine with custom KYRO dark theme
- **Multi-language Support** - 25+ languages with syntax highlighting
- **Symbol Navigation** - Functions, classes, structs outline panel
- **Real Terminal** - Full PTY terminal with xterm.js
- **File Explorer** - Browse and edit your projects
- **Tab System** - Multi-file editing with dirty indicators

### AI Integration
- **Ollama Integration** - Local AI via Ollama (completely free, your code stays private)
- **8 AI Commands**:
  - Code Review - Security and quality analysis
  - Generate Tests - Comprehensive test generation
  - Explain Code - Step-by-step explanations
  - Refactor Code - Clean and optimize
  - Fix Code - Debug with error context
  - Code Completion - AI-assisted coding
  - Chat - General coding questions

### Molecular LSP (New!)
- **Zero External Processes** - No need to install language servers
- **Symbol Extraction** - Find functions, classes, structs, enums
- **Keyword Completions** - Language-specific suggestions
- **Syntax Diagnostics** - Bracket matching, string detection
- **Supported Languages**: Rust, Python, JavaScript, TypeScript, Go, C, C++, C#, Ruby, PHP, Java, Kotlin, Swift, HTML, CSS, SCSS, JSON, YAML, TOML, Markdown, SQL, Shell, Lua, Vue, Svelte

## Screenshot

```
┌────────────────────────────────────────────────────────────────────┐
│ KYRO IDE • my-project                      ● Ollama Connected     │
├────────────────────────────────────────────────────────────────────┤
│ 📁 Explorer │ ⚡ Symbols │ 🔍 Search │ 🌿 Git                      │
├────────────────────────────────────────────────────────────────────┤
│ 📂 src                    │  function main() {        │ 💬 AI Chat │
│   📂 components          │    println!("Hello");     │            │
│     📄 page.tsx          │  }                        │ Ask about  │
│     📄 layout.tsx        │                           │ your code  │
│   📂 lib                 │  struct User {            │            │
│     📄 utils.ts          │    name: String,          │ [Send]     │
│ 📂 public                │  }                        │            │
├────────────────────────────────────────────────────────────────────┤
│ ⚡ Terminal                                          Ln 1, Col 1   │
└────────────────────────────────────────────────────────────────────┘
```

## Installation

### Prerequisites

1. **Rust**: https://rustup.rs
2. **Node.js**: https://nodejs.org
3. **Bun**: https://bun.sh

### Linux Dependencies

```bash
# Ubuntu/Debian
sudo apt install libgtk-3-dev libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf

# Fedora
sudo dnf install gtk3-devel webkit2gtk4.1-devel libappindicator-gtk3-devel librsvg2-devel

# Arch Linux
sudo pacman -S gtk3 webkit2gtk libappindicator librsvg
```

### Build from Source

```bash
git clone https://github.com/nkpendyam/Kyro_IDE.git
cd Kyro_IDE
bun install
bun run tauri:dev    # Development
bun run tauri:build  # Production
```

### Install Ollama for AI Features

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull a code model
ollama pull codellama:7b

# Or other models
ollama pull deepseek-coder:6.7b-instruct
ollama pull llama3:8b
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React 19, Tailwind CSS |
| Editor | Monaco Editor |
| Terminal | xterm.js |
| State | Zustand |
| Desktop | Tauri 2.0 |
| Backend | Rust |
| AI | Ollama (local LLM) |
| LSP | Tree-sitter (Molecular LSP) |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    KYRO IDE (Tauri + Rust)                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Monaco    │  │ Molecular   │  │  AI Agent Engine    │  │
│  │   Editor    │  │    LSP      │  │    (Ollama)         │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  Git Core   │  │  Terminal   │  │  File System        │  │
│  │  (git2-rs)  │  │  (xterm.js) │  │  (Tauri Plugins)   │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Project Structure

```
kyro-ide/
├── src/                    # React/Next.js frontend
│   ├── components/        # UI components
│   │   ├── editor/       # Monaco editor wrapper
│   │   ├── sidebar/      # File tree, activity bar, symbols
│   │   ├── terminal/     # xterm.js terminal
│   │   ├── chat/         # AI chat panel
│   │   └── statusbar/    # Status bar
│   ├── store/            # Zustand state management
│   └── app/              # Next.js pages
├── src-tauri/            # Rust backend
│   └── src/
│       ├── ai/          # Ollama integration
│       ├── terminal/    # PTY management
│       ├── files/       # File operations
│       ├── git/         # Git operations
│       ├── lsp/         # Molecular LSP (tree-sitter)
│       └── commands/    # Tauri command handlers
└── README.md
```

## Roadmap

- [x] Monaco Editor with KYRO theme
- [x] Ollama AI integration
- [x] Molecular LSP for 25+ languages
- [x] Symbol extraction and navigation
- [ ] Real-time collaboration (Yjs + Git-CRDT)
- [ ] Browser integration for datasets
- [ ] Command palette (Ctrl+P)
- [ ] WASM plugin system
- [ ] Mobile PICO Bridge controller

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details.

---

<div align="center">
  Built with ❤️ by KYRO Team
</div>
