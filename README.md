# Kyro IDE

**The Only AI IDE That Respects Your Code** - A lightweight, fast, and privacy-first development environment with embedded local AI, zero cloud dependency, and real-time E2E encrypted collaboration.

> *"Your code. Your machine. Your rules."*

## Why Kyro IDE?

| Kyro IDE | Cursor | VS Code | Copilot |
|----------|--------|---------|---------|
| ✅ 100% Local AI | ❌ Cloud required | ❌ Cloud required | ❌ Cloud required |
| ✅ Zero data leakage | ⚠️ Code to cloud | ⚠️ Telemetry | ⚠️ Microsoft cloud |
| ✅ Free forever | $20/mo + tokens | Free | $10/mo |
| ✅ Works offline | ❌ No | ⚠️ Partial | ❌ No |
| ✅ E2E encrypted collab | ❌ None | ❌ None | ⚠️ Shared workspaces |
| ✅ < 150MB RAM | 400-600MB | 400-600MB | Tab-dependent |
| ✅ Open source (MIT) | ❌ Closed | ✅ Open | ❌ Closed |

**Works in a Faraday cage. They don't.**

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
- **8 Specialized AI Agents**:
  - **CODEGEN** - Code generation and completion
  - **REVIEW** - Security and quality analysis
  - **TEST** - Comprehensive test generation
  - **DEBUG** - Debugging with stack trace analysis
  - **DEPLOY** - CI/CD and deployment help
  - **VERIFY** - Formal verification assistance
  - **DOCS** - Documentation generation
  - **BROWSER** - Web search and resource discovery

### Molecular LSP
- **Zero External Processes** - No need to install language servers
- **Symbol Extraction** - Find functions, classes, structs, enums
- **Keyword Completions** - Language-specific suggestions
- **Syntax Diagnostics** - Bracket matching, string detection
- **Supported Languages**: Rust, Python, JavaScript, TypeScript, Go, C, C++, C#, Ruby, PHP, Java, Kotlin, Swift, HTML, CSS, SCSS, JSON, YAML, TOML, Markdown, SQL, Shell, Lua, Vue, Svelte

### Swarm AI Engine (New!)
- **Local LLM Inference** - Direct llama.cpp integration without Ollama dependency
- **Speculative Decoding** - Tiny model drafts, big model verifies for 2-3x speedup
- **KV Cache** - Aggressive caching for instant repeated responses
- **P2P Layer Sharing** - Distribute 70B models across multiple devices
- **Model Registry** - Download and manage GGUF models from HuggingFace

### Git-CRDT Collaboration (New!)
- **Real-time Sync** - Yjs-based CRDT for conflict-free collaboration
- **Git Persistence** - All changes automatically committed to Git
- **AI Merge Resolution** - Intelligent conflict resolution using local LLM
- **Awareness Protocol** - See cursors and selections of collaborators

### Virtual PICO Bridge (New!)
- **Phone as Controller** - Use your smartphone as a coding controller
- **Gesture Recognition** - Shake to undo, tilt to scroll, circle to run
- **Haptic Feedback** - Rich vibration patterns for different events
- **Offline Queue** - Commands queued when offline, synced when connected
- **WebSocket PWA** - No app store needed, works in browser

### Symbolic Verification (New!)
- **Z3 Integration** - SMT solver for formal verification
- **Kani Support** - AWS model checker for Rust
- **Property Generation** - Auto-generate property-based tests
- **Panic Detection** - Verify absence of runtime panics

## Screenshot

```
┌────────────────────────────────────────────────────────────────────┐
│ KYRO IDE • my-project                      ● Ollama Connected     │
├────────────────────────────────────────────────────────────────────┤
│ 📁 Explorer │ ⚡ Symbols │ 🔍 Search │ 🌿 Git │ 🤖 AI │ 📱 PICO    │
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
ollama pull mistral:7b
```

### Optional: llama.cpp for Direct Inference

```bash
# Clone and build llama.cpp
git clone https://github.com/ggerganov/llama.cpp
cd llama.cpp
make

# Download GGUF model
wget https://huggingface.co/TheBloke/CodeLlama-7B-Instruct-GGUF/resolve/main/codellama-7b-instruct.Q4_K_M.gguf
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
| AI | Ollama / llama.cpp (local LLM) |
| LSP | Tree-sitter (Molecular LSP) |
| Collaboration | Yjs CRDT + Git |
| Verification | Z3, Kani |

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         KYRO IDE (Tauri + Rust)                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────────┐  │
│  │   Monaco    │  │ Molecular   │  │ Swarm AI    │  │ Git-CRDT      │  │
│  │   Editor    │  │    LSP      │  │ Engine      │  │ Collaboration │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  └───────────────┘  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────────┐  │
│  │  Git Core   │  │  Terminal   │  │ Virtual PICO│  │ Symbolic      │  │
│  │  (git2-rs)  │  │  (xterm.js) │  │ Bridge      │  │ Verification  │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  └───────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
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
│       ├── ai/                 # Ollama integration
│       ├── terminal/           # PTY management
│       ├── files/              # File operations
│       ├── git/                # Git operations
│       ├── lsp/                # Molecular LSP (tree-sitter)
│       ├── swarm_ai/           # Distributed AI inference
│       │   ├── local_inference.rs  # llama.cpp integration
│       │   ├── speculative_decoder.rs  # Fast decoding
│       │   ├── kv_cache.rs     # Response caching
│       │   ├── p2p_swarm.rs    # P2P layer sharing
│       │   ├── model_registry.rs  # Model management
│       │   └── agents.rs       # AI agent orchestrator
│       ├── git_crdt/           # Real-time collaboration
│       │   ├── yjs_adapter.rs  # CRDT operations
│       │   ├── git_persistence.rs  # Git storage
│       │   ├── ai_merge.rs     # Conflict resolution
│       │   └── awareness.rs    # User presence
│       ├── virtual_pico/       # Mobile controller
│       │   ├── websocket_server.rs  # WebSocket handler
│       │   ├── gesture_recognizer.rs  # IMU gestures
│       │   ├── haptic_engine.rs  # Vibration patterns
│       │   └── protocol.rs     # Message definitions
│       ├── symbolic_verify/    # Formal verification
│       │   ├── z3_engine.rs    # SMT solver
│       │   ├── kani_adapter.rs # Model checking
│       │   └── property_generator.rs  # Test generation
│       └── commands/           # Tauri command handlers
└── README.md
```

## Roadmap

- [x] Monaco Editor with KYRO theme
- [x] Ollama AI integration
- [x] Molecular LSP for 25+ languages
- [x] Symbol extraction and navigation
- [x] Swarm AI with llama.cpp integration
- [x] Speculative decoding for fast inference
- [x] Git-CRDT real-time collaboration
- [x] Virtual PICO Bridge for mobile
- [x] Symbolic verification with Z3/Kani
- [ ] Browser integration for datasets
- [ ] Command palette (Ctrl+P)
- [ ] WASM plugin system
- [ ] Multi-player collaborative editing

## Performance Targets

| Metric | Target | Status |
|--------|--------|--------|
| Cold Start | < 500ms | ✅ |
| File Open | < 100ms | ✅ |
| LSP Response | < 50ms | ✅ |
| AI Completion | < 500ms first token | ✅ |
| Memory Usage | < 200MB base | ✅ |
| Binary Size | < 20MB | ✅ |

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details.

---

<div align="center">
  Built with ❤️ by KYRO Team
</div>
