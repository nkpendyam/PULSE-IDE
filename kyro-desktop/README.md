# Kyro Desktop - Native Desktop Application

[![CI](https://github.com/nkpendyam/Kyro_IDE/workflows/ci.yml/badge.svg)](https://github.com/nkpendyam/Kyro_IDE/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Kyro Desktop** is the native desktop application version of Kyro IDE, built with Tauri for cross-platform support (Windows, macOS, Linux).

## 🚀 Features

- **Native Performance** - Built with Rust (Tauri) for optimal performance
- **Cross-Platform** - Windows, macOS, and Linux support
- **AI Integration** - Multi-agent AI system with local and cloud models
- **Code Intelligence** - Tree-sitter based parsing and analysis
- **Real-time Collaboration** - CRDT-based collaborative editing
- **Extension System** - VS Code-compatible extension API

## 📋 System Requirements

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| **OS** | Windows 10, macOS 10.15, Ubuntu 20.04 | Windows 11, macOS 13+, Ubuntu 22.04 |
| **RAM** | 4GB | 8GB+ |
| **Disk** | 500MB | 2GB+ (for local models) |
| **CPU** | x64/ARM64 | Multi-core |

## 📦 Installation

### Download

Download the latest release from [GitHub Releases](https://github.com/nkpendyam/Kyro_IDE/releases):

| Platform | File |
|----------|------|
| Windows | `Kyro-IDE-Setup-x.x.x.exe` |
| macOS (Intel) | `Kyro-IDE-x.x.x.dmg` |
| macOS (Apple Silicon) | `Kyro-IDE-x.x.x-arm64.dmg` |
| Linux | `kyro-ide_x.x.x_amd64.deb` |

### Build from Source

```bash
# Clone the repository
git clone https://github.com/nkpendyam/Kyro_IDE.git
cd Kyro_IDE

# Install dependencies
bun install

# Build for your platform
bun run tauri:build
```

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Kyro Desktop UI                          │
│                    (Tauri + TypeScript)                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Tauri Backend (Rust)                     │
│   ┌──────────┬──────────┬──────────┬──────────────────┐     │
│   │    FS    │   Git    │ Terminal │    Commands      │     │
│   │  Watcher │  Service │  Service │                  │     │
│   └──────────┴──────────┴──────────┴──────────────────┘     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Frontend (Next.js)                         │
│   ┌──────────┬──────────┬──────────┬──────────────────┐     │
│   │  Monaco  │   AI     │Debugger  │ Collaboration    │     │
│   │  Editor  │  Chat    │          │                  │     │
│   └──────────┴──────────┴──────────┴──────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

## 🔧 Configuration

Edit `kyro.toml` in the installation directory:

```toml
[models]
default_model = "claude-3-sonnet"
ollama_host = "http://localhost:11434"

[editor]
font_family = "JetBrains Mono"
font_size = 14
tab_size = 2

[collaboration]
enabled = true
server_url = "wss://collab.kyro.dev"

[security]
sandbox_enabled = true
```

## 📁 Project Structure

```
kyro-desktop/
├── agents/           # Python AI agents
├── model-proxy/      # Rust model proxy server
├── runtime/          # Rust runtime kernel
├── ui/               # Tauri UI application
├── installer/        # Platform installers
└── kyro.toml        # Configuration
```

## 🛡️ Security

Kyro Desktop enforces security through:

- **Sandboxed extensions** - Extensions run in isolated contexts
- **API key encryption** - Keys stored securely in OS keychain
- **Permission system** - Granular control over capabilities
- **No telemetry** - Your code stays on your machine

## 🧪 Development

### Prerequisites

- Rust 1.70+
- Node.js 18+ or Bun
- Platform-specific build tools

### Run Development Build

```bash
# Install dependencies
bun install

# Run in development mode
bun run tauri:dev
```

### Build Production

```bash
# Build for current platform
bun run tauri:build

# Output in src-tauri/target/release/bundle/
```

## 📚 Documentation

- [Main README](../README.md)
- [API Documentation](../docs/API.md)
- [Contributing Guide](../CONTRIBUTING.md)

## 📄 License

MIT License - see [LICENSE](../LICENSE) file for details.

---

**Kyro IDE Team** | [GitHub](https://github.com/nkpendyam/Kyro_IDE) | [Discord](https://discord.gg/kyro-ide)
