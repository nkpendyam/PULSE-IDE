# Kyro IDE

<div align="center">

![Kyro IDE Banner](./docs/logo.png)

# The Open Source, Privacy-First AI-Powered IDE

**Compete with JetBrains, VS Code, Cursor, and Windsurf - 100% Free Forever**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub Stars](https://img.shields.io/github/stars/nkpendyam/Kyro_IDE?style=social)](https://github.com/nkpendyam/Kyro_IDE)
[![GitHub Issues](https://img.shields.io/github/issues/nkpendyam/Kyro_IDE)](https://github.com/nkpendyam/Kyro_IDE/issues)
[![GitHub Release](https://img.shields.io/github/v/release/nkpendyam/Kyro_IDE)](https://github.com/nkpendyam/Kyro_IDE/releases)
[![Discord](https://img.shields.io/discord/kyroide?color=7289da&label=Discord)](https://discord.gg/kyroide)

[Download](#-installation) • [Features](#-features) • [Documentation](#-documentation) • [Contributing](#-contributing) • [Roadmap](#-roadmap)

</div>

---

## 🎯 Why Kyro IDE?

Kyro IDE is a **free, open-source, privacy-first AI-powered development environment** that delivers premium IDE features without the premium price tag. Built to compete with JetBrains, Visual Studio, Cursor, Windsurf, and other commercial IDEs.

| Feature | Kyro IDE | Cursor | Windsurf | JetBrains |
|---------|----------|--------|----------|-----------|
| **Price** | ✅ Free Forever | 💰 $20-40/mo | 💰 $15-50/mo | 💰 $149-649/yr |
| **Open Source** | ✅ MIT License | ❌ Closed | ❌ Closed | ❌ Closed |
| **Privacy** | ✅ 100% Local | ⚠️ Cloud AI | ⚠️ Cloud AI | ⚠️ Partial |
| **Local AI** | ✅ Unlimited | ❌ Limited | ❌ Limited | ❌ No |
| **Time Travel Debug** | ✅ Yes | ❌ No | ❌ No | ⚠️ Paid |
| **Collaborative Editing** | ✅ CRDT-based | ❌ No | ⚠️ Limited | ⚠️ Paid |
| **Code Clone Detection** | ✅ Type 1-4 | ❌ No | ❌ No | ⚠️ Paid |
| **Remote Development** | ✅ SSH/Container | ❌ No | ⚠️ Limited | ⚠️ Paid |

---

## 🚀 Key Features

### 🤖 Multi-Agent AI System (10 Specialized Agents)

Kyro IDE includes a revolutionary multi-agent architecture with 10 specialized AI agents working together:

| Agent | Role | Capabilities |
|-------|------|--------------|
| 🏗️ **Architect** | System Design | Architecture decisions, codebase analysis, design patterns |
| 💻 **Coder** | Code Generation | Writing code, implementing features, refactoring |
| 🔍 **Reviewer** | Code Review | Quality assurance, style compliance, best practices |
| 🐛 **Debugger** | Bug Fixing | Error analysis, root cause detection, fix suggestions |
| ⚡ **Optimizer** | Performance | Bottleneck identification, optimization strategies |
| 📝 **Documenter** | Documentation | API docs, README generation, code comments |
| 🧪 **Tester** | Testing | Unit tests, integration tests, coverage analysis |
| 🔧 **Refactorer** | Refactoring | Code cleanup, pattern application, modernization |
| 🔒 **Security** | Security | Vulnerability scanning, security audit, compliance |
| 🔬 **Researcher** | Research | Best practices, documentation lookup, tech trends |

### ⏰ Time Travel Debugging

Industry-leading debugging capabilities previously only available in premium tools:

- **Reverse Execution**: Step backwards through code execution
- **State Snapshots**: Capture and restore program state at any point
- **Variable History**: Track variable changes over time
- **Call Stack Rewind**: Navigate through historical call stacks
- **Breakpoint Time Machine**: Set breakpoints in the past

### 🔗 CRDT Collaborative Editing

Real-time collaborative editing using Conflict-Free Replicated Data Types:

- **YATA Algorithm**: Advanced CRDT implementation for conflict resolution
- **Real-time Sync**: Instant synchronization across multiple users
- **Offline Support**: Continue editing offline, sync when connected
- **Cursor Presence**: See collaborators' cursors in real-time
- **Change Attribution**: Track who made what changes

### 🔍 Advanced Code Analysis

JetBrains-style deep semantic analysis:

- **PSI-like Semantic Analysis**: Deep AST-based code understanding
- **Code Maps**: Visualize code dependencies and architecture
- **Code Clone Detection**: Type-1 through Type-4 duplicate code detection
- **Intelligent Refactoring**: AI-assisted code transformations
- **Dead Code Analysis**: Identify unused code paths

### 🌐 Remote Development

Full remote development capabilities:

- **SSH Connections**: Secure remote server access
- **Container Support**: Docker and Kubernetes integration
- **Port Forwarding**: Tunnel local ports to remote
- **File Sync**: Bi-directional file synchronization
- **Remote Terminal**: Full terminal access to remote machines

### 🧠 AI-Powered Features

| Feature | Description |
|---------|-------------|
| **Intelligent Autocomplete** | Context-aware code completion |
| **Code Explanation** | AI explains complex code blocks |
| **Natural Language to Code** | Describe what you want, AI writes it |
| **Bug Detection** | AI identifies potential bugs before runtime |
| **Code Review** | Automated PR/code review suggestions |
| **Documentation Generation** | Auto-generate docs from code |

### 💻 Full IDE Experience

- **Monaco Editor** - VS Code's editor with full IntelliSense
- **Integrated Terminal** - Real PTY terminal with xterm.js
- **Git Integration** - Complete version control support
- **File Explorer** - Tree view with drag & drop
- **Multi-file Editing** - Tabs, split view, workspaces
- **AI Chat Panel** - Conversational AI assistance
- **Command Palette** - Quick access to all commands
- **Theme Support** - Light/dark themes, custom themes
- **Plugin System** - Extend with custom functionality

---

## 🌍 Model Support

### Local Models (100% Free, 100% Private)

Run powerful AI models locally via Ollama:

| Model | Size | Best For |
|-------|------|----------|
| **Llama 3.2** | 3B-90B | General purpose coding |
| **DeepSeek Coder** | 6.7B-33B | Code generation |
| **Code Llama** | 7B-34B | Python, code completion |
| **Mistral** | 7B | Fast, efficient coding |
| **Dolphin Mixtral** | 8x7B | Uncensored, flexible |
| **Nous Hermes** | 7B-13B | Uncensored, creative |

### Cloud Models (Optional)

Connect to cloud providers for maximum performance:

- **Claude 3.5 Sonnet** - Anthropic's flagship
- **GPT-4o / GPT-4 Turbo** - OpenAI's best
- **Gemini Pro** - Google's model
- **Groq** - Ultra-fast inference

---

## 📥 Installation

### Windows

```powershell
# Download installer
winget install kyro-ide

# Or download directly
# https://github.com/nkpendyam/Kyro_IDE/releases/latest
```

| Option | Download | Size |
|--------|----------|------|
| **Installer** | [Kyro-IDE-Setup.exe](https://github.com/nkpendyam/Kyro_IDE/releases) | ~150MB |
| **Portable** | [Kyro-IDE-portable.zip](https://github.com/nkpendyam/Kyro_IDE/releases) | ~150MB |
| **MSI** | [Kyro-IDE.msi](https://github.com/nkpendyam/Kyro_IDE/releases) | ~150MB |

### Linux

```bash
# AppImage (Recommended)
wget https://github.com/nkpendyam/Kyro_IDE/releases/latest/download/kyro-ide.AppImage
chmod +x kyro-ide.AppImage
./kyro-ide.AppImage

# AUR (Arch Linux)
yay -S kyro-ide

# Snap
sudo snap install kyro-ide
```

### macOS

```bash
# Homebrew
brew install --cask kyro-ide

# Or download DMG
# https://github.com/nkpendyam/Kyro_IDE/releases/latest
```

---

## 🛠️ Building from Source

### Prerequisites

- **Rust** 1.70+ - [Install Rust](https://rustup.rs/)
- **Node.js** 18+ or **Bun** - [Install Bun](https://bun.sh)
- **Git** - [Install Git](https://git-scm.com/)

### Build Steps

```bash
# Clone the repository
git clone https://github.com/nkpendyam/Kyro_IDE.git
cd kyro-ide

# Install dependencies
bun install

# Development mode
bun run tauri:dev

# Build for production
bun run tauri:build
```

---

## 📖 Documentation

### Configuration

Settings file location:
- **Windows**: `%APPDATA%\kyro-ide\settings.json`
- **Linux**: `~/.config/kyro-ide/settings.json`
- **macOS**: `~/Library/Application Support/kyro-ide/settings.json`

---

## 🔌 Plugin Development

Create powerful plugins to extend Kyro IDE:

```typescript
import { Plugin, ExtensionContext } from '@kyro-ide/sdk';

const myPlugin: Plugin = {
  id: 'my-awesome-plugin',
  name: 'My Awesome Plugin',
  version: '1.0.0',
  
  activate(context: ExtensionContext) {
    context.commands.register('myPlugin.hello', {
      title: 'Say Hello',
      handler: () => {
        context.ui.showMessage('Hello from Kyro IDE!');
      }
    });
  }
};

export default myPlugin;
```

---

## 🗺️ Roadmap

### Version 1.0 (Current)
- [x] Monaco Editor integration
- [x] Multi-agent AI system
- [x] Local model support
- [x] Integrated terminal
- [x] Git integration
- [x] Time Travel Debugging
- [x] CRDT collaborative editing
- [x] Code clone detection
- [x] Remote development

### Version 1.1 (Current Release)
- [x] Visual debugging with variable watches
- [x] Performance profiler
- [x] Memory profiler
- [x] Database explorer
- [x] REST client

### Version 1.2 (Q2 2025)
- [ ] AI-powered test generation
- [ ] Intelligent code review
- [ ] Dependency vulnerability scanning
- [ ] Cloud sync for settings

### Version 2.0 (Q3 2025)
- [ ] Full JetBrains parity
- [ ] Visual Studio feature parity
- [ ] Enterprise features
- [ ] Team collaboration

---

## 🤝 Contributing

We welcome contributions from the community!

```bash
# Fork and clone
git clone https://github.com/YOUR_USERNAME/kyro-ide.git
cd kyro-ide

# Install dependencies
bun install

# Start development server
bun run tauri:dev
```

Please read our [Contributing Guide](./CONTRIBUTING.md) for detailed guidelines.

---

## 📜 License

Kyro IDE is released under the [MIT License](./LICENSE).

---

## 🙏 Acknowledgments

- [Tauri](https://tauri.app/) - Cross-platform desktop framework
- [Monaco Editor](https://microsoft.github.io/monaco-editor/) - Code editor
- [Ollama](https://ollama.ai/) - Local LLM runtime
- [shadcn/ui](https://ui.shadcn.com/) - UI components
- [React](https://react.dev/) - UI framework

---

## 📞 Support & Community

| Platform | Link |
|----------|------|
| 📖 **Documentation** | [docs.kyroide.dev](https://docs.kyroide.dev) |
| 💬 **Discord** | [discord.gg/kyroide](https://discord.gg/kyroide) |
| 🐛 **Bug Reports** | [GitHub Issues](https://github.com/nkpendyam/Kyro_IDE/issues) |
| 💡 **Feature Requests** | [GitHub Discussions](https://github.com/nkpendyam/Kyro_IDE/discussions) |

---

<div align="center">

**[⬆ Back to Top](#-kyro-ide)**

Made with ❤️ by the Kyro IDE Team

**[Website](https://kyroide.dev)** • **[Download](https://github.com/nkpendyam/Kyro_IDE/releases)**

</div>
