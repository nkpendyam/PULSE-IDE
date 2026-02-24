# KRO IDE Developer Guide

**Version**: v0.0.0-alpha  
**Last Updated**: 2025-02-24

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Development Setup](#development-setup)
3. [Project Structure](#project-structure)
4. [Core Modules](#core-modules)
5. [API Reference](#api-reference)
6. [Creating Extensions](#creating-extensions)
7. [Contributing](#contributing)
8. [Debugging](#debugging)

---

## 1. Architecture Overview

### Technology Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, Next.js 15, TypeScript |
| **Desktop Shell** | Tauri v2 (WebView) |
| **Backend** | Rust (Tokio async runtime) |
| **AI Engine** | llama.cpp (CUDA/Metal/Vulkan) |
| **Collaboration** | yrs (Yjs CRDT) |
| **Language Server** | tower-lsp |
| **Encryption** | ChaCha20-Poly1305, X25519 |

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Tauri WebView Shell                      │
├─────────────────────────────────────────────────────────────┤
│  React Frontend (Next.js)                                    │
│  ├── Code Editor (Monaco)                                    │
│  ├── File Tree                                               │
│  ├── AI Chat Panel                                           │
│  └── Terminal (xterm.js)                                     │
├─────────────────────────────────────────────────────────────┤
│  Tauri IPC Bridge (invoke/listen)                            │
├─────────────────────────────────────────────────────────────┤
│  Rust Backend (Tokio Runtime)                                │
│  ├── Embedded LLM Engine                                     │
│  ├── Collaboration Server (CRDT)                             │
│  ├── LSP Client/Server                                       │
│  ├── MCP Agent Framework                                     │
│  ├── Auth Module (JWT/RBAC)                                  │
│  ├── E2E Encryption (Signal Protocol)                        │
│  └── VS Code Compat Layer                                    │
├─────────────────────────────────────────────────────────────┤
│  Platform Services                                           │
│  ├── File System                                             │
│  ├── Process/Terminal                                        │
│  └── Network (HTTP/WebSocket)                                │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

```
User Input → React Component → Tauri IPC → Rust Handler → Business Logic → Response
                                                                     ↓
                                                              State Update → UI Re-render
```

---

## 2. Development Setup

### Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Rust | 1.70+ | Backend |
| Node.js | 20+ | Frontend build |
| Bun | 1.0+ | Package manager |
| CUDA Toolkit | 12.0+ | GPU inference (optional) |

### Clone and Setup

```bash
# Clone repository
git clone https://github.com/nkpendyam/Kyro_IDE.git
cd Kyro_IDE

# Install dependencies
bun install

# Development mode
bun run tauri:dev
```

### Build Commands

```bash
# Development (hot reload)
bun run dev          # Frontend only
bun run tauri:dev    # Full app

# Production build
bun run tauri:build

# Run tests
bun run test           # Unit tests
bun run test:e2e       # E2E tests
bun run test:all       # All tests

# Linting
bun run lint

# Type checking
bunx tsc --noEmit
```

### IDE Setup

#### VS Code Recommended Extensions

```json
{
  "recommendations": [
    "rust-lang.rust-analyzer",
    "tauri-apps.tauri-vscode",
    "ms-vscode.vscode-typescript-next",
    "bradlc.vscode-tailwindcss"
  ]
}
```

#### Rust Analyzer Settings

```json
{
  "rust-analyzer.cargo.features": "all",
  "rust-analyzer.checkOnSave.command": "clippy",
  "rust-analyzer.procMacro.enable": true
}
```

---

## 3. Project Structure

```
Kyro_IDE/
├── src/                        # React frontend
│   ├── app/                    # Next.js app router
│   ├── components/             # React components
│   │   ├── Editor/             # Code editor
│   │   ├── FileTree/           # File browser
│   │   ├── Terminal/           # Terminal panel
│   │   ├── AI/                 # AI chat panel
│   │   └── Layout/             # Layout components
│   ├── hooks/                  # Custom React hooks
│   ├── stores/                 # Zustand stores
│   ├── types/                  # TypeScript types
│   └── utils/                  # Utility functions
│
├── src-tauri/                  # Rust backend
│   ├── src/                    # Source modules
│   │   ├── main.rs             # Entry point
│   │   ├── auth/               # Authentication
│   │   ├── e2ee/               # End-to-end encryption
│   │   ├── collaboration/      # Real-time collab
│   │   ├── embedded_llm/       # AI inference
│   │   ├── mcp/                # Agent framework
│   │   ├── lsp/                # Language server
│   │   ├── vscode_compat/      # VS Code API
│   │   └── ...                 # Other modules
│   ├── Cargo.toml              # Rust dependencies
│   └── tauri.conf.json         # Tauri configuration
│
├── tests/                      # Test files
│   ├── unit/rust/              # Rust unit tests
│   ├── unit/typescript/        # TS unit tests
│   ├── e2e/                    # Playwright tests
│   └── integration/            # Integration tests
│
├── .github/workflows/          # CI/CD
├── docs/                       # Documentation
└── skills/                     # AI skills/modules
```

---

## 4. Core Modules

### Authentication Module (`auth/`)

**Purpose**: JWT authentication, RBAC, rate limiting

**Key Files**:
- `mod.rs` - Main auth logic
- `jwt_handler.rs` - Token management
- `rbac.rs` - Role-based access control
- `rate_limiter.rs` - Request throttling
- `audit.rs` - Security logging

**Usage**:
```rust
use kyro_ide::auth::{AuthManager, User, Role};

let auth = AuthManager::new(config);
let user = auth.authenticate("user", "password").await?;
let token = auth.generate_token(&user)?;
```

### E2E Encryption Module (`e2ee/`)

**Purpose**: Signal Protocol encryption for collaboration

**Key Files**:
- `mod.rs` - E2E session management
- `key_exchange.rs` - X3DH protocol
- `double_ratchet.rs` - Forward secrecy
- `encrypted_channel.rs` - Bidirectional encryption

**Usage**:
```rust
use kyro_ide::e2ee::{E2EESession, EncryptedChannel};

let mut session = E2EESession::new("user-123");
let bundle = session.create_key_bundle()?;

let channel = EncryptedChannel::new(key_pair);
channel.process_remote_bundle(&remote_bundle)?;
let encrypted = channel.send(b"secret message")?;
```

### Collaboration Module (`collaboration/`)

**Purpose**: 50-user real-time collaboration

**Key Files**:
- `room.rs` - Room management
- `sync.rs` - CRDT synchronization
- `presence.rs` - User presence

**Usage**:
```rust
use kyro_ide::collaboration::{CollaborationServer, RoomId, UserInfo};

let server = CollaborationServer::new(config);
server.create_room(RoomId("room-1".into()), RoomConfig::default()).await?;
server.join_room(&room_id, user).await?;

let op = Operation::Insert { client_id, position: 0, text: "Hello".into(), timestamp: 1 };
server.submit_operation(&room_id, op).await?;
```

### Embedded LLM Module (`embedded_llm/`)

**Purpose**: Local AI inference

**Key Files**:
- `engine.rs` - Inference engine
- `model_manager.rs` - Model loading
- `backends.rs` - CUDA/Metal/CPU backends

**Usage**:
```rust
use kyro_ide::embedded_llm::{EmbeddedLLM, ModelConfig};

let mut llm = EmbeddedLLM::new(ModelConfig {
    model_path: "/models/llama-7b.gguf".into(),
    gpu_layers: 35,
    ..Default::default()
});

llm.load().await?;
let response = llm.complete("fn main() {", CompletionOptions::default()).await?;
```

### VS Code Compatibility (`vscode_compat/`)

**Purpose**: Run VS Code extensions

**Key Files**:
- `extension_host.rs` - Extension lifecycle
- `api.rs` - VS Code API shim
- `marketplace.rs` - Open VSX client

**Usage**:
```rust
use kyro_ide::vscode_compat::{ExtensionHost, Extension};

let mut host = ExtensionHost::new(ExtensionHostConfig::default());
host.install_extension(&extension).await?;
host.activate_extension(&extension.id).await?;
```

---

## 5. API Reference

### Tauri Commands

#### File Operations

```rust
#[tauri::command]
async fn read_file(path: String) -> Result<String, String>;

#[tauri::command]
async fn write_file(path: String, content: String) -> Result<(), String>;

#[tauri::command]
async fn list_directory(path: String) -> Result<Vec<FileNode>, String>;
```

#### AI Operations

```rust
#[tauri::command]
async fn initialize_llm(config: LlmConfig) -> Result<HardwareInfo, String>;

#[tauri::command]
async fn ai_complete(prompt: String, options: CompletionOptions) -> Result<String, String>;

#[tauri::command]
async fn ai_chat(messages: Vec<ChatMessage>) -> Result<String, String>;
```

#### Collaboration Operations

```rust
#[tauri::command]
async fn create_room(name: String) -> Result<String, String>;

#[tauri::command]
async fn join_room(room_id: String, user: UserInfo) -> Result<(), String>;

#[tauri::command]
async fn send_operation(room_id: String, op: Operation) -> Result<(), String>;
```

### Frontend API

```typescript
// File operations
invoke('read_file', { path: '/path/to/file' });
invoke('write_file', { path: '/path/to/file', content: 'content' });

// AI operations
invoke('initialize_llm', { config: { modelPath: '/models/llama.gguf' } });
invoke('ai_complete', { prompt: 'fn main()', options: { maxTokens: 100 } });

// Collaboration
invoke('create_room', { name: 'My Room' });
invoke('join_room', { roomId: 'room-123', user: userInfo });
```

---

## 6. Creating Extensions

### Extension Manifest

```json
{
  "name": "my-extension",
  "version": "1.0.0",
  "displayName": "My Extension",
  "description": "Does something cool",
  "engines": { "vscode": "^1.80.0" },
  "activationEvents": ["onLanguage:rust"],
  "main": "./out/extension.js",
  "contributes": {
    "commands": [{
      "command": "myExtension.hello",
      "title": "Hello World"
    }]
  }
}
```

### Extension Code

```javascript
// extension.js
const vscode = require('vscode');

function activate(context) {
  console.log('Extension activated!');
  
  let disposable = vscode.commands.registerCommand('myExtension.hello', () => {
    vscode.window.showInformationMessage('Hello from KRO IDE!');
  });
  
  context.subscriptions.push(disposable);
}

function deactivate() {
  console.log('Extension deactivated');
}

module.exports = { activate, deactivate };
```

### Extension API Support

KRO IDE supports the following VS Code APIs:

| API | Status |
|-----|--------|
| `window` | ✅ Full |
| `workspace` | ✅ Full |
| `languages` | ✅ Full |
| `commands` | ✅ Full |
| `debug` | 🟡 Partial |
| `tasks` | 🟡 Partial |
| `notebooks` | 🟡 Partial |
| `scm` | 🔴 Not yet |

---

## 7. Contributing

### Branch Strategy

- `main` - Production-ready code
- Feature branches: `feature/your-feature`
- Bug fixes: `fix/issue-description`

### Commit Convention

```
feat: Add new AI model support
fix: Resolve collaboration sync issue
docs: Update API documentation
test: Add unit tests for auth module
refactor: Improve code structure
```

### Pull Request Process

1. Fork the repository
2. Create feature branch
3. Make changes with tests
4. Run lint and tests
5. Submit PR with description

### Code Style

**Rust**:
```bash
cargo fmt
cargo clippy -- -D warnings
```

**TypeScript**:
```bash
bun run lint
```

### Testing Requirements

- All new features require tests
- Minimum 80% code coverage
- All tests must pass in CI

```bash
# Run all tests
bun run test:all

# Run specific tests
cargo test auth_
cargo test e2ee_
bun run test editor.test.ts
```

---

## 8. Debugging

### Rust Debugging

```bash
# Enable debug logs
RUST_LOG=debug bun run tauri:dev

# Attach debugger
# VS Code: Run and Debug → Tauri Development
```

### Frontend Debugging

- Use browser DevTools (`F12`)
- React DevTools extension
- Redux/Zustand DevTools

### Common Issues

#### Build Errors

```bash
# Clear caches
cargo clean
rm -rf node_modules bun.lock
bun install

# Rebuild
bun run tauri:build
```

#### Runtime Errors

```bash
# Check logs
tail -f ~/.kro-ide/logs/main.log

# Enable verbose logging
RUST_LOG=trace bun run tauri:dev
```

---

## Appendix: Configuration

### Environment Variables

| Variable | Purpose |
|----------|---------|
| `RUST_LOG` | Logging level |
| `KRO_IDE_MODEL_PATH` | Default model directory |
| `KRO_IDE_DATA_DIR` | User data directory |

### Tauri Configuration

```json
// src-tauri/tauri.conf.json
{
  "build": {
    "beforeDevCommand": "bun run dev",
    "beforeBuildCommand": "bun run build"
  },
  "tauri": {
    "security": {
      "csp": "default-src 'self'"
    }
  }
}
```

---

*Developer Guide v0.0.0-alpha - Last updated: 2025-02-24*
