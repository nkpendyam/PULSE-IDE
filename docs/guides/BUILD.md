# Kyro IDE Build System Documentation

This document describes the build system configuration and how to build Kyro IDE for development and production.

## Prerequisites

### Required
- **Node.js** 18+ (20+ recommended)
- **Rust** 1.70+ (latest stable recommended)
- **Cargo** (comes with Rust)

### Optional
- **Bun** (faster alternative to npm)
- **Git** (for version control)

## Project Structure

```
kyro-ide/
├── src/                    # Next.js frontend source
├── src-tauri/             # Rust backend
│   ├── crates/           # Modular Rust crates
│   │   ├── kyro-core/   # Core types and utilities
│   │   ├── kyro-lsp/    # LSP manager
│   │   ├── kyro-ai/     # AI orchestrator
│   │   ├── kyro-collab/ # CRDT collaboration
│   │   └── kyro-git/    # Git integration
│   └── Cargo.toml       # Rust dependencies
├── package.json          # Frontend dependencies
├── next.config.ts       # Next.js configuration
├── tailwind.config.ts   # Tailwind CSS configuration
└── scripts/             # Build scripts
```

## Dependencies

### Frontend (package.json)

#### Core Framework
- **Next.js 16** - React framework with SSR/SSG
- **React 19** - UI library
- **TypeScript 5** - Type safety

#### Editor & UI
- **Monaco Editor** - VS Code's editor component
- **shadcn/ui** - Modern component library (Radix UI + Tailwind)
- **Tailwind CSS 4** - Utility-first CSS framework
- **Lucide React** - Icon library
- **Framer Motion** - Animation library

#### Collaboration
- **Yjs** - CRDT library for real-time collaboration
- **y-monaco** - Monaco Editor integration for Yjs

#### Terminal
- **xterm.js** - Terminal emulator
- **xterm-addon-fit** - Terminal resize addon
- **xterm-addon-web-links** - Clickable links in terminal

#### State Management
- **Zustand** - Lightweight state management
- **TanStack Query** - Data fetching and caching

#### Forms & Validation
- **React Hook Form** - Form management
- **Zod** - Schema validation

### Backend (Cargo.toml)

#### Desktop Shell
- **Tauri v2** - Cross-platform native wrapper
- **tauri-plugin-shell** - Shell command execution
- **tauri-plugin-fs** - File system access
- **tauri-plugin-dialog** - Native dialogs
- **tauri-plugin-updater** - Auto-update system

#### Async Runtime
- **tokio** - Async runtime with full features
- **async-trait** - Async trait support

#### LSP & Language Intelligence
- **tower-lsp** - LSP server framework
- **lsp-types** - LSP protocol types
- **tree-sitter** - Incremental parsing
- **tree-sitter-{language}** - Language grammars (Rust, TypeScript, Python, Go, C, C++, Java, JSON, YAML, Markdown)

#### CRDT & Collaboration
- **yrs** - Yjs Rust port for CRDT
- **loro** - Rich text CRDT library

#### Git Integration
- **git2** - libgit2 bindings for Git operations

#### AI & LLM
- **reqwest** - HTTP client for API calls
- **rusqlite** - SQLite for agent memory
- **ndarray** - N-dimensional arrays for embeddings
- **bincode** - Binary serialization for vectors

#### Concurrency
- **dashmap** - Concurrent HashMap
- **parking_lot** - Faster synchronization primitives
- **crossbeam** - Concurrent data structures

#### Utilities
- **serde** - Serialization/deserialization
- **uuid** - UUID generation
- **chrono** - Date/time handling
- **log** - Logging facade
- **anyhow** - Error handling
- **thiserror** - Error derive macros

#### Terminal
- **portable-pty** - Cross-platform PTY

#### File System
- **notify** - File system watcher
- **walkdir** - Directory traversal

#### Cryptography
- **x25519-dalek** - Key exchange (Signal Protocol)
- **chacha20poly1305** - AEAD encryption
- **argon2** - Password hashing
- **blake3** - Fast hashing

#### WebSocket
- **tokio-tungstenite** - WebSocket implementation

## Build Configuration

### Next.js Configuration (next.config.ts)

```typescript
{
  output: "standalone",           // Standalone build for Tauri
  swcMinify: true,               // Use SWC for minification
  compress: true,                // Enable gzip compression
  experimental: {
    turbopack: true              // Use Turbopack for faster builds
  }
}
```

### Tailwind CSS Configuration (tailwind.config.ts)

- **Dark mode**: Class-based (`class` strategy)
- **Content**: Scans `src/**/*.{ts,tsx}` for classes
- **Plugins**: tailwindcss-animate for animations
- **Theme**: Extended with shadcn/ui color system

### PostCSS Configuration (postcss.config.mjs)

- **@tailwindcss/postcss**: Tailwind CSS v4 PostCSS plugin

### Cargo Build Profiles

#### Development Profile
```toml
[profile.dev]
opt-level = 1      # Minimal optimization for faster builds
debug = true       # Include debug symbols
```

#### Release Profile
```toml
[profile.release]
opt-level = 3      # Maximum optimization
lto = "thin"       # Thin LTO for faster linking
codegen-units = 1  # Single codegen unit for better optimization
panic = "abort"    # Abort on panic (smaller binary)
strip = true       # Strip debug symbols
```

## Development Setup

### Quick Start

#### Unix/Linux/macOS
```bash
./scripts/dev-setup.sh
```

#### Windows
```powershell
.\scripts\dev-setup.ps1
```

### Manual Setup

1. **Install frontend dependencies**
   ```bash
   npm install
   # or
   bun install
   ```

2. **Build Rust backend (debug)**
   ```bash
   cd src-tauri
   cargo build
   cd ..
   ```

3. **Generate Prisma client**
   ```bash
   npm run db:generate
   ```

### Running Development Server

#### Option 1: Tauri Dev (Recommended)
Runs both frontend and backend with hot reload:
```bash
npm run tauri:dev
```

#### Option 2: Separate Processes
Terminal 1 (Frontend):
```bash
npm run dev
```

Terminal 2 (Backend):
```bash
npm run tauri:dev
```

### Development Features

- **Hot Module Replacement (HMR)**: Frontend changes reload instantly
- **Rust Hot Reload**: Backend recompiles on file changes
- **TypeScript Type Checking**: Run `npm run type-check`
- **Linting**: Run `npm run lint` or `npm run lint:fix`
- **Testing**: Run `npm run test` or `npm run test:watch`

## Production Build

### Quick Build

#### Unix/Linux/macOS
```bash
./scripts/build-production.sh
```

#### Windows
```powershell
.\scripts\build-production.ps1
```

### Manual Build

1. **Build frontend**
   ```bash
   npm run build
   ```

2. **Build Rust backend (release)**
   ```bash
   cd src-tauri
   cargo build --release
   cd ..
   ```

3. **Build Tauri application**
   ```bash
   npm run tauri:build
   ```

### Platform-Specific Builds

#### Linux
```bash
./scripts/build-linux.sh
```

#### macOS
```bash
./scripts/build-macos.sh
```

#### Windows
```powershell
.\scripts\build-windows.ps1
```

## Build Artifacts

### Frontend
- **Location**: `.next/standalone/`
- **Size**: ~50-100MB
- **Contents**: Optimized Next.js bundle

### Backend
- **Location**: `src-tauri/target/release/`
- **Binary**: `kyro-ide` (Unix) or `kyro-ide.exe` (Windows)
- **Size**: ~20-50MB (stripped)

### Tauri Application
- **Location**: `src-tauri/target/release/bundle/`
- **Formats**:
  - **Linux**: `.deb`, `.AppImage`, `.rpm`
  - **macOS**: `.dmg`, `.app`
  - **Windows**: `.msi`, `.exe`

## Optimization Tips

### Frontend Optimization

1. **Use Turbopack for faster dev builds**
   ```bash
   npm run dev:turbo
   ```

2. **Analyze bundle size**
   ```bash
   npm run build:analyze
   ```

3. **Enable SWC minification** (already configured)

### Backend Optimization

1. **Use release profile for production**
   ```bash
   cargo build --release
   ```

2. **Enable LTO for smaller binaries** (already configured)

3. **Strip debug symbols** (already configured)

4. **Use `cargo-bloat` to analyze binary size**
   ```bash
   cargo install cargo-bloat
   cargo bloat --release
   ```

## Troubleshooting

### Common Issues

#### 1. "Module not found" errors
```bash
rm -rf node_modules package-lock.json
npm install
```

#### 2. Rust compilation errors
```bash
cd src-tauri
cargo clean
cargo build
```

#### 3. Tauri build fails
- Ensure all system dependencies are installed
- Check Tauri prerequisites: https://tauri.app/v2/guides/prerequisites

#### 4. Monaco Editor not loading
- Check webpack configuration in `next.config.ts`
- Ensure `@monaco-editor/react` is installed

#### 5. CRDT sync issues
- Verify WebSocket connection
- Check `yrs` and `yjs` versions match

### Performance Issues

#### Slow development builds
- Use Turbopack: `npm run dev:turbo`
- Reduce tree-sitter grammars in `Cargo.toml`
- Disable unused Tauri plugins

#### Large bundle size
- Run bundle analyzer: `npm run build:analyze`
- Enable tree shaking
- Use dynamic imports for large components

#### High memory usage
- Reduce `codegen-units` in Cargo.toml
- Use `cargo build --release` with `--jobs 1`

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Build

on: [push, pull_request]

jobs:
  build:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Setup Rust
        uses: actions-rs/toolchain@v1
        with:
          toolchain: stable
      
      - name: Install dependencies
        run: npm install
      
      - name: Build
        run: npm run tauri:build
```

## Additional Resources

- **Tauri Documentation**: https://tauri.app/v2/guides/
- **Next.js Documentation**: https://nextjs.org/docs
- **Rust Book**: https://doc.rust-lang.org/book/
- **Monaco Editor**: https://microsoft.github.io/monaco-editor/
- **Yjs Documentation**: https://docs.yjs.dev/

## Support

For build issues, please:
1. Check this documentation
2. Search existing GitHub issues
3. Create a new issue with build logs
