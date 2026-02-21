# Kyro IDE Desktop Build Guide

This guide explains how to build Kyro IDE as a desktop application for Windows, macOS, and Linux.

## Prerequisites

### All Platforms
1. **Rust** (1.70 or later) - Install from https://rustup.rs
2. **Bun** (1.0 or later) - Install from https://bun.sh
3. **Node.js** (18 or later) - Optional, Bun is preferred

### Platform-Specific Requirements

#### Windows
- Visual Studio Build Tools (C++ workload)
- WebView2 (included in Windows 10/11)

#### macOS
- Xcode Command Line Tools: `xcode-select --install`

#### Linux
```bash
sudo apt install libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev
```

## Building

### Development Build

```bash
# Install dependencies
bun install

# Run in development mode (opens a web view)
bun run tauri:dev
```

### Production Builds

#### Build for Current Platform
```bash
bun run tauri:build
```

#### Build for Specific Platforms

**Windows:**
```bash
bun run tauri:build:win
```

**macOS (Apple Silicon):**
```bash
bun run tauri:build:mac
```

**Linux:**
```bash
bun run tauri:build:linux
```

## Output Files

After building, you'll find the installers in:

### Windows
- `src-tauri/target/release/bundle/msi/` - MSI installer
- `src-tauri/target/release/bundle/nsis/` - NSIS installer (.exe)

### macOS
- `src-tauri/target/release/bundle/dmg/` - DMG installer
- `src-tauri/target/release/bundle/macos/` - .app bundle

### Linux
- `src-tauri/target/release/bundle/appimage/` - AppImage (universal)
- `src-tauri/target/release/bundle/deb/` - Debian/Ubuntu package
- `src-tauri/target/release/bundle/rpm/` - Fedora/RHEL package

## Auto-Updates

Kyro IDE includes built-in auto-update functionality. Configure the update server URL in `src-tauri/tauri.conf.json`:

```json
{
  "plugins": {
    "updater": {
      "endpoints": ["https://releases.kyroide.dev/{{target}}/{{arch}}/{{current_version}}"]
    }
  }
}
```

## Code Signing

### Windows
1. Obtain a code signing certificate
2. Configure in `tauri.conf.json`:
```json
{
  "bundle": {
    "windows": {
      "certificateThumbprint": "YOUR_CERT_THUMBPRINT",
      "timestampUrl": "http://timestamp.digicert.com"
    }
  }
}
```

### macOS
1. Obtain an Apple Developer certificate
2. Configure in `tauri.conf.json`:
```json
{
  "bundle": {
    "macOS": {
      "signingIdentity": "Developer ID Application: Your Name (TEAM_ID)",
      "providerShortName": "TEAM_ID"
    }
  }
}
```

## Architecture

The desktop app uses Tauri 2.0:

```
┌─────────────────────────────────────┐
│           Frontend (Next.js)         │
│   React, Monaco Editor, shadcn/ui   │
├─────────────────────────────────────┤
│           Tauri Bridge               │
│      IPC between Frontend & Rust     │
├─────────────────────────────────────┤
│          Rust Backend                │
│  - File System Operations            │
│  - Git Integration (git2)            │
│  - Terminal/PTY                      │
│  - AI Model Integration              │
│  - System Integration                │
├─────────────────────────────────────┤
│         Native WebView               │
│   (WebKitGTK / WebView2 / WebKit)    │
└─────────────────────────────────────┘
```

## Tauri Commands

The following commands are available from the frontend:

### File System
- `fs_read_file` - Read file contents
- `fs_write_file` - Write to file
- `fs_list_directory` - List directory contents
- `fs_create_directory` - Create directories
- `fs_delete_file` / `fs_delete_directory` - Delete files/directories
- `fs_copy_file` / `fs_move_file` - Copy/move files
- `fs_search_files` - Search for files

### Git
- `git_status` - Get repository status
- `git_commit` - Create commits
- `git_push` / `git_pull` / `git_fetch` - Remote operations
- `git_branch_list` / `git_branch_create` / `git_branch_switch` - Branch management
- `git_log` - View commit history
- `git_blame` - Git blame for files

### Terminal
- `terminal_create` - Create terminal session
- `terminal_write` - Write to terminal
- `terminal_resize` - Resize terminal
- `terminal_kill` - Kill terminal session
- `terminal_list_shells` - List available shells

### AI
- `ai_chat` - Chat with AI models
- `ai_complete` - Code completion
- `ai_get_models` - List available models
- `ai_load_model` / `ai_unload_model` - Model management

### System
- `system_info` - Get system information
- `system_open_url` / `system_open_file` - Open URLs/files
- `system_get_env` / `system_set_env` - Environment variables

## Troubleshooting

### Build Errors

**Rust target not installed:**
```bash
rustup target add x86_64-pc-windows-msvc
rustup target add aarch64-apple-darwin
rustup target add x86_64-unknown-linux-gnu
```

**Missing dependencies (Linux):**
```bash
sudo apt install libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev patchelf
```

**WebView2 not found (Windows):**
Download and install from: https://developer.microsoft.com/en-us/microsoft-edge/webview2/

### Development Issues

**Hot reload not working:**
```bash
bun run clean
bun install
bun run tauri:dev
```

## Distribution

### Distributing on Multiple Platforms

1. Build for each platform on its native OS (Windows on Windows, macOS on macOS, Linux on Linux)
2. Use CI/CD for cross-platform builds (GitHub Actions recommended)

### GitHub Actions Example

```yaml
name: Build Desktop App

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    strategy:
      matrix:
        include:
          - os: windows-latest
            target: x86_64-pc-windows-msvc
          - os: macos-latest
            target: aarch64-apple-darwin
          - os: ubuntu-latest
            target: x86_64-unknown-linux-gnu
    
    runs-on: ${{ matrix.os }}
    
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - uses: oven-sh/setup-bun@v1
      - uses: dtolnay/rust-toolchain@stable
        with:
          targets: ${{ matrix.target }}
      
      - name: Install dependencies (Linux only)
        if: matrix.os == 'ubuntu-latest'
        run: |
          sudo apt-get update
          sudo apt-get install -y libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev
      
      - name: Build
        run: |
          bun install
          bun run tauri build --target ${{ matrix.target }}
      
      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: kyro-ide-${{ matrix.target }}
          path: src-tauri/target/${{ matrix.target }}/release/bundle/
```

## License

MIT License - See LICENSE file for details.
