# Kyro IDE - Project Setup Guide

## Overview

Kyro IDE is a next-generation AI-native code editor built with Tauri v2 (Rust backend) and Next.js 16 (React 19 frontend). This document describes the project structure and setup process.

## Technology Stack

### Frontend
- **Framework**: Next.js 16.1.1
- **UI Library**: React 19.0.0
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4
- **Components**: shadcn/ui, Radix UI
- **Editor**: Monaco Editor (@monaco-editor/react)

### Backend
- **Desktop Shell**: Tauri v2
- **Language**: Rust (Edition 2021)
- **Runtime**: Tokio async runtime
- **Key Dependencies**:
  - `tower-lsp` - LSP implementation
  - `yrs` - CRDT for collaboration
  - `git2` - Git integration
  - `tree-sitter` - Language parsing
  - `rusqlite` - Agent memory storage

## Project Structure

```
Kyro_IDE/
├── src/                          # Next.js frontend
│   ├── app/                      # Next.js 16 app directory
│   │   ├── layout.tsx           # Root layout
│   │   ├── page.tsx             # Main editor page
│   │   └── globals.css          # Global styles
│   ├── components/              # React components
│   │   ├── editor/              # Monaco editor integration
│   │   ├── terminal/            # Terminal component
│   │   ├── git/                 # Git UI
│   │   ├── chat/                # AI chat sidebar
│   │   └── ui/                  # shadcn/ui components
│   ├── hooks/                   # React hooks
│   ├── lib/                     # Utilities
│   └── store/                   # State management (Zustand)
│
├── src-tauri/                   # Tauri Rust backend
│   ├── src/
│   │   ├── main.rs             # Application entry point
│   │   ├── lib.rs              # Library exports
│   │   ├── commands/           # Tauri command handlers
│   │   ├── ai/                 # AI client (Ollama)
│   │   ├── embedded_llm/       # Local LLM engine
│   │   ├── orchestrator/       # Mission orchestrator
│   │   ├── lsp/                # LSP manager
│   │   ├── terminal/           # Terminal manager
│   │   ├── git/                # Git manager
│   │   ├── collab/             # CRDT collaboration
│   │   ├── extensions/         # Extension system
│   │   └── ...                 # Other modules
│   ├── Cargo.toml              # Rust dependencies
│   ├── tauri.conf.json         # Tauri configuration
│   └── build.rs                # Build script
│
├── package.json                 # Node.js dependencies
├── next.config.ts              # Next.js configuration
├── tsconfig.json               # TypeScript configuration
└── tailwind.config.ts          # Tailwind CSS configuration
```

## Cross-Platform Support

### Supported Platforms
- **Windows**: 10/11 (x64)
- **macOS**: 10.15+ (Intel & Apple Silicon)
- **Linux**: Ubuntu 20.04+, Fedora, Debian

### Platform-Specific Configuration

#### Windows
- Uses WiX installer
- Requires WebView2 (auto-installed)
- Icon: `icons/icon.ico`

#### macOS
- Minimum version: macOS 10.15 (Catalina)
- Universal binary support (Intel + Apple Silicon)
- Icon: `icons/icon.icns`
- Uses native Metal backend for GPU acceleration

#### Linux
- Debian package with WebKit2GTK dependency
- Icon: PNG format (32x32, 128x128)

## Prerequisites

### Development Tools
- **Rust**: 1.70+ (install via [rustup](https://rustup.rs/))
- **Node.js**: 18+ (or Bun for faster builds)
- **Cargo**: Comes with Rust
- **Tauri CLI**: `cargo install tauri-cli`

### Platform-Specific Requirements

#### Windows
- Visual Studio Build Tools 2019+
- WebView2 Runtime

#### macOS
- Xcode Command Line Tools: `xcode-select --install`

#### Linux (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libssl-dev \
  libgtk-3-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev
```

## Installation & Setup

### 1. Clone the Repository
```bash
git clone https://github.com/nkpendyam/Kyro_IDE.git
cd Kyro_IDE
```

### 2. Install Frontend Dependencies
```bash
# Using npm
npm install

# Or using bun (faster)
bun install
```

### 3. Install Rust Dependencies
```bash
cd src-tauri
cargo build
cd ..
```

### 4. Run Development Server
```bash
# Start Next.js dev server and Tauri
bun run tauri:dev

# Or direct Tauri CLI (after bun install)
bunx tauri dev
```

## Build for Production

### Development Build
```bash
bun run tauri:build
```

### Platform-Specific Builds

#### Windows
```bash
bunx tauri build --target x86_64-pc-windows-msvc
```

#### macOS (Universal Binary)
```bash
bunx tauri build --target universal-apple-darwin
```

#### Linux
```bash
bunx tauri build --target x86_64-unknown-linux-gnu
```

## Configuration Files

### Tauri Configuration (`src-tauri/tauri.conf.json`)
- **Product Name**: Kyro IDE
- **Identifier**: dev.kyro.ide
- **Bundle Targets**: all (Windows, macOS, Linux)
- **Dev Server**: http://localhost:3000
- **Frontend Dist**: ../out

### Next.js Configuration (`next.config.ts`)
- **Output**: export (static build for Tauri packaging)
- **React Strict Mode**: disabled (for Monaco compatibility)
- **Turbopack**: enabled for faster builds

### Cargo Workspace (Future)
The project is structured to support a modular Cargo workspace:
```toml
# Future workspace members:
# - crates/kyro-core      # Core types and utilities
# - crates/kyro-lsp       # LSP manager
# - crates/kyro-ai        # AI orchestrator
# - crates/kyro-collab    # CRDT collaboration
# - crates/kyro-git       # Git integration
```

## Key Features Implemented

### ✅ Task 1.1 Completed
- [x] Tauri v2 project structure initialized
- [x] Next.js 16 with React 19 configured
- [x] TypeScript setup complete
- [x] Cross-platform build configuration (Windows, macOS, Linux)
- [x] Modular Rust backend structure
- [x] Cargo workspace prepared for future modularity

### Core Services Initialized
- Terminal Manager (PTY support)
- AI Client (Ollama integration)
- File Watcher (notify crate)
- Git Manager (git2/libgit2)
- LSP Manager (tower-lsp)
- Embedded LLM Engine
- MCP Server
- Collaboration Manager (CRDT)
- Plugin Manager (WASM sandbox)
- Update Manager
- Orchestrator (Mission Control)

## Development Workflow

### Hot Reload
The development server supports hot reload for both frontend and backend:
- Frontend changes: Instant reload via Next.js
- Rust changes: Automatic recompilation via Tauri

### Testing
```bash
# Run Rust tests
cd src-tauri
cargo test

# Run frontend tests
npm test
```

### Linting
```bash
# Lint frontend
npm run lint

# Format Rust code
cd src-tauri
cargo fmt
```

## Troubleshooting

### Common Issues

#### "WebView2 not found" (Windows)
Install WebView2 Runtime: https://developer.microsoft.com/en-us/microsoft-edge/webview2/

#### "libwebkit2gtk not found" (Linux)
```bash
sudo apt install libwebkit2gtk-4.1-dev
```

#### Build fails with "linker error"
Ensure all platform-specific dependencies are installed (see Prerequisites).

## Next Steps

After completing Task 1.1, the next tasks are:
- **Task 1.2**: Set up core Rust backend structure (modular crates)
- **Task 1.3**: Configure build system and dependencies
- **Task 1.4**: Set up testing infrastructure

## Resources

- [Tauri Documentation](https://tauri.app/v2/)
- [Next.js 16 Documentation](https://nextjs.org/docs)
- [React 19 Documentation](https://react.dev/)
- [Rust Book](https://doc.rust-lang.org/book/)

## License

MIT License - See LICENSE file for details
