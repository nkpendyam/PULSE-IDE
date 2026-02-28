# KRO IDE User Guide

**Version**: v0.0.0-alpha  
**Last Updated**: 2025-02-24

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Installation](#installation)
3. [Interface Overview](#interface-overview)
4. [Core Features](#core-features)
5. [AI Features](#ai-features)
6. [Collaboration](#collaboration)
7. [Settings & Customization](#settings--customization)
8. [Keyboard Shortcuts](#keyboard-shortcuts)
9. [Troubleshooting](#troubleshooting)

---

## 1. Getting Started

### What is KRO IDE?

KRO IDE is a GPU-accelerated, AI-native code editor with the following key features:

- **51 Programming Languages** - Full syntax highlighting and IntelliSense
- **Embedded AI** - Local LLM for code completion and generation
- **Real-time Collaboration** - Up to 50 users with end-to-end encryption
- **VS Code Compatibility** - Use your favorite extensions
- **Privacy First** - All AI runs locally, no data leaves your machine

### System Requirements

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| **CPU** | 4 cores | 8+ cores |
| **RAM** | 8 GB | 16+ GB |
| **GPU VRAM** | 4 GB | 8+ GB |
| **Storage** | 2 GB | 10 GB (with models) |
| **OS** | Windows 10, macOS 12, Ubuntu 20.04 | Latest versions |

---

## 2. Installation

### Windows

1. Download `KRO_IDE-Setup-x.x.x.exe`
2. Run the installer
3. Follow the setup wizard
4. Launch KRO IDE from Start Menu

### macOS

1. Download `KRO_IDE-x.x.x.dmg`
2. Open the DMG file
3. Drag KRO IDE to Applications
4. Launch from Applications folder

### Linux

**Debian/Ubuntu:**
```bash
sudo dpkg -i kro-ide_x.x.x_amd64.deb
sudo apt-get install -f
```

**AppImage:**
```bash
chmod +x KRO_IDE-x.x.x.AppImage
./KRO_IDE-x.x.x.AppImage
```

### First Launch

On first launch, KRO IDE will:

1. **Detect Hardware** - Identify GPU and memory
2. **Configure AI** - Recommend optimal model
3. **Setup Workspace** - Ask for default project folder

---

## 3. Interface Overview

### Main Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Menu Bar  │  File Name                        │  Window   │
├────────┬────────────────────────────────────┬──────────────┤
│        │                                    │              │
│  File  │                                    │   AI Chat    │
│  Tree  │         Code Editor                │    Panel     │
│        │                                    │              │
│        │                                    ├──────────────┤
│        │                                    │  Hardware    │
│        │                                    │   Info       │
├────────┴────────────────────────────────────┴──────────────┤
│  Terminal Panel                                              │
├─────────────────────────────────────────────────────────────┤
│  Status Bar: Branch │ File │ Position │ AI Status │ Users  │
└─────────────────────────────────────────────────────────────┘
```

### Key Components

#### File Tree (Left Panel)
- Browse project files
- Create, rename, delete files
- Git status indicators
- Drag and drop support

#### Code Editor (Center)
- Syntax highlighting for 51 languages
- IntelliSense and code completion
- Multi-cursor editing
- Minimap navigation

#### AI Chat Panel (Right)
- Natural language code requests
- Code explanation
- Refactoring suggestions
- Test generation

#### Terminal Panel (Bottom)
- Integrated terminal
- Multiple tabs
- Command history
- Task runner

#### Status Bar (Bottom)
- Git branch and status
- File information
- Cursor position
- AI model status
- Collaboration users

---

## 4. Core Features

### File Operations

#### Opening Files
- **Single File**: File → Open, or `Ctrl+O`
- **Project Folder**: File → Open Folder, or `Ctrl+K Ctrl+O`
- **Recent Files**: File → Recent Files

#### Saving
- **Save**: `Ctrl+S`
- **Save As**: `Ctrl+Shift+S`
- **Save All**: File → Save All

### Code Editing

#### Navigation
| Action | Shortcut |
|--------|----------|
| Go to Line | `Ctrl+G` |
| Go to File | `Ctrl+P` |
| Go to Symbol | `Ctrl+Shift+O` |
| Go to Definition | `F12` |
| Find References | `Shift+F12` |

#### Editing
| Action | Shortcut |
|--------|----------|
| Cut | `Ctrl+X` |
| Copy | `Ctrl+C` |
| Paste | `Ctrl+V` |
| Undo | `Ctrl+Z` |
| Redo | `Ctrl+Y` |
| Multi-cursor | `Alt+Click` |
| Select All | `Ctrl+A` |
| Find | `Ctrl+F` |
| Replace | `Ctrl+H` |

### Language Support

KRO IDE supports 51 programming languages out of the box:

**Core Languages (Always Available):**
Rust, Python, JavaScript, TypeScript, Go, C, C++, Java, Kotlin, Swift, Ruby, PHP, Lua, Zig, Odin

**Extended Languages (Feature Flag):**
Haskell, OCaml, F#, Scala, Elixir, Erlang, Clojure, R, Julia, Dart, C#, VB.NET, Pascal, Fortran, and 21 more

### Terminal

#### Opening Terminal
- View → Terminal, or `Ctrl+``
- Multiple tabs with `+` button

#### Features
- Bash, Zsh, PowerShell, CMD support
- Split terminal panes
- Custom profiles
- Task integration

---

## 5. AI Features

### Initializing the AI

1. Open Hardware Info Panel (right sidebar)
2. Review detected hardware
3. Click "Initialize Embedded LLM"
4. Select recommended model or custom model

### AI Commands

#### Code Completion
Type code and AI will suggest completions. Press `Tab` to accept.

#### Code Generation
1. Open AI Chat Panel
2. Describe what you want:
   ```
   Create a REST API endpoint for user registration
   ```
3. AI generates code in your current language

#### Code Explanation
1. Select code in editor
2. Right-click → "Explain Code"
3. AI explains in chat panel

#### Refactoring
1. Select code
2. Right-click → "Refactor"
3. Choose refactoring type:
   - Extract function
   - Rename variable
   - Simplify logic
   - Add error handling

#### Test Generation
1. Select function or code block
2. Right-click → "Generate Tests"
3. AI creates unit tests

### AI Shortcuts

| Action | Shortcut |
|--------|----------|
| Open AI Chat | `Ctrl+Shift+A` |
| Generate Code | `Ctrl+Shift+G` |
| Explain Code | `Ctrl+Shift+E` |
| Fix Code | `Ctrl+Shift+F` |
| Generate Tests | `Ctrl+Shift+T` |

---

## 6. Collaboration

### Starting a Session

1. Click collaboration icon in status bar
2. Choose "Start Session"
3. Share room code with collaborators

### Joining a Session

1. Click collaboration icon
2. Choose "Join Session"
3. Enter room code

### Collaboration Features

#### Real-time Editing
- See other users' cursors
- Watch edits in real-time
- Conflict-free CRDT synchronization

#### Presence Indicators
- User avatars in editor
- Cursor positions
- Active file tracking

#### Communication
- In-editor chat
- @mentions
- Code comments

### End-to-End Encryption

All collaboration is encrypted:

1. **Initial Key Exchange** - X3DH protocol
2. **Message Encryption** - ChaCha20-Poly1305
3. **Forward Secrecy** - Double Ratchet

Only participants can read messages. Server cannot decrypt content.

---

## 7. Settings & Customization

### Opening Settings

- File → Settings, or `Ctrl+,`
- Edit JSON settings directly

### Key Settings

```json
{
  "editor.fontSize": 14,
  "editor.tabSize": 4,
  "editor.wordWrap": "on",
  "editor.minimap.enabled": true,
  "editor.formatOnSave": true,
  
  "ai.model": "llama-7b-q4",
  "ai.maxTokens": 2048,
  "ai.temperature": 0.7,
  
  "terminal.shell": "bash",
  "terminal.fontSize": 13,
  
  "collaboration.maxUsers": 50,
  "collaboration.e2eEncryption": true,
  
  "theme": "dark"
}
```

### Themes

Built-in themes:
- Dark (default)
- Light
- High Contrast
- Monokai
- Dracula

### Extensions

Install VS Code extensions:
1. View → Extensions
2. Search Open VSX marketplace
3. Click Install

---

## 8. Keyboard Shortcuts

### General

| Action | Windows/Linux | macOS |
|--------|---------------|-------|
| Command Palette | `Ctrl+Shift+P` | `Cmd+Shift+P` |
| Quick Open | `Ctrl+P` | `Cmd+P` |
| New File | `Ctrl+N` | `Cmd+N` |
| Save | `Ctrl+S` | `Cmd+S` |
| Save All | `Ctrl+K S` | `Cmd+K S` |
| Close | `Ctrl+W` | `Cmd+W` |
| Quit | `Ctrl+Q` | `Cmd+Q` |

### Editor

| Action | Windows/Linux | macOS |
|--------|---------------|-------|
| Undo | `Ctrl+Z` | `Cmd+Z` |
| Redo | `Ctrl+Y` | `Cmd+Y` |
| Cut | `Ctrl+X` | `Cmd+X` |
| Copy | `Ctrl+C` | `Cmd+C` |
| Paste | `Ctrl+V` | `Cmd+V` |
| Find | `Ctrl+F` | `Cmd+F` |
| Replace | `Ctrl+H` | `Cmd+H` |
| Go to Line | `Ctrl+G` | `Cmd+G` |
| Go to Definition | `F12` | `F12` |
| Format Document | `Shift+Alt+F` | `Shift+Opt+F` |

### AI

| Action | Windows/Linux | macOS |
|--------|---------------|-------|
| Open AI Chat | `Ctrl+Shift+A` | `Cmd+Shift+A` |
| Generate | `Ctrl+Shift+G` | `Cmd+Shift+G` |
| Explain | `Ctrl+Shift+E` | `Cmd+Shift+E` |
| Fix | `Ctrl+Shift+F` | `Cmd+Shift+F` |

### Terminal

| Action | Windows/Linux | macOS |
|--------|---------------|-------|
| Toggle Terminal | `Ctrl+` | `Cmd+` |
| New Terminal | `Ctrl+Shift+` | `Cmd+Shift+` |

---

## 9. Troubleshooting

### Common Issues

#### AI Not Working

1. Check GPU is detected in Hardware Info
2. Verify model is downloaded
3. Check VRAM is sufficient
4. Restart application

**Solution:**
```
Settings → AI → Reset Model → Reinitialize
```

#### Slow Performance

1. Close unused tabs
2. Reduce AI model size
3. Disable unnecessary extensions
4. Check memory usage

#### Collaboration Not Connecting

1. Check internet connection
2. Verify room code is correct
3. Check firewall settings
4. Try restarting session

**Firewall Settings:**
```
Allow: TCP 443, UDP 443
Allow: localhost connections
```

### Logging

Enable debug logging:
```json
{
  "debug.enabled": true,
  "debug.logLevel": "debug",
  "debug.logFile": "~/kro-ide-debug.log"
}
```

### Getting Help

- **Documentation**: https://docs.kro-ide.dev
- **GitHub Issues**: https://github.com/nkpendyam/Kyro_IDE/issues
- **Discord**: https://discord.gg/kro-ide

---

## Appendix: Feature Flags

Enable experimental features:

```json
{
  "features": {
    "allLanguages": true,
    "experimentalAI": true,
    "betaCollaboration": true
  }
}
```

---

*User Guide v0.0.0-alpha - Last updated: 2025-02-24*
