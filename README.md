# KYRO IDE

**AI-Powered Code Editor** - A lightweight, fast, and intelligent development environment with local AI support.

## Features

- **Monaco Editor** - VS Code's editor engine with custom KYRO dark theme
- **AI Integration** - Local AI via Ollama (completely free, your code stays private)
- **Real Terminal** - Full PTY terminal with xterm.js
- **Git Integration** - Built-in version control
- **File Explorer** - Browse and edit your projects
- **Multi-language Support** - 40+ programming languages with syntax highlighting

## Installation

### Prerequisites

1. **Rust**: https://rustup.rs
2. **Node.js**: https://nodejs.org
3. **Bun**: https://bun.sh

### Linux Dependencies

```bash
# Ubuntu/Debian
sudo apt install libgtk-3-dev libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf
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
curl -fsSL https://ollama.com/install.sh | sh
ollama pull codellama:7b
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

## License

MIT
