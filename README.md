# Kyro IDE

A powerful AI-powered Integrated Development Environment built with modern web technologies. Kyro IDE combines the flexibility of a web-based code editor with the power of multi-agent AI assistance.

## Features

### AI-Powered Development
- **Multi-Agent AI System** - 10 specialized AI agents (Architect, Coder, Reviewer, Debugger, Tester, Refactorer, Documenter, Optimizer, Security, DevOps)
- **AI Inline Completion** - Intelligent code suggestions powered by AI
- **AI Chat Panel** - Interactive chat interface for code assistance

### Code Editor
- **Monaco Editor** - Full-featured code editor with syntax highlighting
- **Multi-tab Support** - Work with multiple files simultaneously
- **File Explorer** - Navigate and manage your project files
- **Breadcrumbs Navigation** - Quick file path navigation

### Development Tools
- **Integrated Terminal** - Full PTY terminal support with xterm.js
- **Git Integration** - Blame annotations, diff viewer, file history, merge conflict resolution
- **Debugger Panel** - Debug Adapter Protocol (DAP) support
- **Database Explorer** - Browse schemas, run queries, explore data
- **REST Client** - Test APIs directly within the IDE

### Performance & Profiling
- **Performance Profiler** - CPU and memory profiling
- **Flame Graphs** - Visualize performance bottlenecks
- **Memory Leak Detector** - Identify memory issues
- **Heap Snapshots** - Analyze memory usage

### Additional Features
- **Command Palette** - Quick access to all commands
- **Theme Support** - Multiple color themes
- **Keyboard Shortcuts** - Efficient workflow shortcuts
- **Extension System** - Extensible architecture

## Technology Stack

### Frontend
- **Next.js 16** - React framework with App Router
- **React 19** - Modern UI library
- **TypeScript 5** - Type-safe JavaScript
- **Tailwind CSS 4** - Utility-first styling
- **shadcn/ui** - Beautiful UI components

### Editor & Terminal
- **Monaco Editor** - VS Code's editor core
- **xterm.js** - Terminal emulator

### AI Integration
- **z-ai-web-dev-sdk** - AI capabilities
- **Ollama Support** - Local model integration
- **Multiple Cloud Providers** - Flexible AI backend options

### Desktop Application
- **Tauri** - Cross-platform desktop app (Windows, Linux, macOS)
- **Rust Backend** - High-performance native operations

## Quick Start

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

## Desktop Build

Build Kyro IDE as a native desktop application:

### Prerequisites
- Rust toolchain installed
- Platform-specific build tools

### Build Commands

```bash
# Build for current platform
bun run tauri:build

# Or use platform-specific scripts
./scripts/build-linux.sh    # Linux
./scripts/build-win.ps1     # Windows
./scripts/build-mac.sh      # macOS
```

### Output Formats
- **Windows**: `.exe` installer, `.msi`
- **Linux**: `.AppImage`, `.deb`, `.rpm`
- **macOS**: `.dmg`, `.app`

## Project Structure

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
│   ├── database/          # Database explorer
│   └── ...                # Other components
├── lib/                   # Utility libraries
│   ├── pulse/             # AI & IDE core logic
│   ├── tauri/             # Tauri integration
│   └── ...                # Other utilities
└── types/                 # TypeScript types

src-tauri/                 # Tauri desktop app
├── src/                   # Rust source
│   ├── commands/          # Tauri commands
│   └── main.rs            # Entry point
└── tauri.conf.json        # Tauri configuration
```

## Available Scripts

```bash
bun run dev          # Start development server
bun run build        # Build for production
bun run lint         # Run ESLint
bun run tauri:dev    # Start Tauri in dev mode
bun run tauri:build  # Build desktop application
```

## AI Agents

Kyro IDE includes specialized AI agents:

| Agent | Description |
|-------|-------------|
| Architect | System design and architecture decisions |
| Coder | Code generation and implementation |
| Reviewer | Code review and quality analysis |
| Debugger | Bug detection and fixing |
| Tester | Test generation and execution |
| Refactorer | Code refactoring and optimization |
| Documenter | Documentation generation |
| Optimizer | Performance optimization |
| Security | Security analysis and fixes |
| DevOps | Deployment and infrastructure |

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## License

MIT License - see LICENSE file for details.

---

Built with ❤️ for developers who want AI-powered coding assistance.
