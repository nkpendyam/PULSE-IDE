# Kyro IDE Implementation Plan

## Current State Assessment

**Foundation (Already Built):**
- Tauri v2 + Next.js 16 + React 19 + Monaco Editor
- Rust backend with modular architecture (kyro-core, kyro-lsp, kyro-ai, kyro-collab, kyro-git crates)
- Agent system with guardrails, memory, parallel execution
- AI backends: Ollama, AirLLM bridge, PicoClaw engine, embedded LLM (Candle)
- VS Code-like UI: File explorer, tabs, AI chat panel, status bar, command palette
- LSP infrastructure with tower-lsp
- CRDT collaboration with yrs
- E2EE with Signal Protocol

**Critical Issues to Address:**
- Rust compilation errors (LSP types, yrs API, chrono, tree-sitter, sysinfo)
- Build stabilization needed before feature expansion

---

## Phase 0: Foundation Stabilization (Weeks 1-4)

### Week 1: Fix Rust Compilation Errors

**Tasks:**
1. **Fix LSP/tower-lsp compatibility** (`src-tauri/src/lsp_real.rs`, `src-tauri/src/lsp_tower/`)
   - Update `SymbolInformation` to include `tags` field
   - Fix `CustomNotification` trait implementation
   - Align with `lsp-types` 0.95 and `tower-lsp` 0.20

2. **Fix yrs CRDT API** (`src-tauri/src/collab/`, `src-tauri/src/git_crdt/`)
   - Update `encode_v1` to current yrs API
   - Fix `get_string` and `Transaction` usage
   - Check yrs 0.18 changelog for migration

3. **Fix chrono datetime API** (`src-tauri/src/telemetry/`, `src-tauri/src/chat_sidebar/`)
   - Replace deprecated `.hour()` with `.time().hour()` pattern

4. **Fix tree-sitter 0.24 compatibility**
   - Update `Language` / `LanguageFn` usage
   - Ensure grammar crates match tree-sitter 0.24

### Week 2: Fix Remaining Compilation Issues

**Tasks:**
1. **Fix sysinfo API** (`src-tauri/src/benchmark/`, `src-tauri/src/quality/`)
   - Update `components()` to current sysinfo 0.30 API

2. **Fix hnsw/vector_store** (`src-tauri/src/rag/`)
   - Align with current `hnsw` crate API
   - Fix `max_elements` and `Hnsw::new` usage

3. **Fix AgentStore API** (`src-tauri/src/commands/agent_store.rs`)
   - Add missing `set_enabled` method or update commands

4. **Fix async/borrow issues**
   - Add `async` where needed
   - Restructure to avoid holding locks across await
   - Clone values where moved

### Week 3: CI/CD and Testing

**Tasks:**
1. **Set up GitHub Actions CI** (`.github/workflows/`)
   - `cargo build` on Windows, macOS, Linux
   - `cargo test` with proper test discovery
   - `cargo clippy` for linting
   - Cache dependencies with sccache

2. **Create first successful run**
   - Tauri app opens
   - Next.js frontend loads
   - One Tauri command works (`get_file_tree`)

3. **Add integration tests**
   - File operations (read/write)
   - AI backend detection
   - Agent lifecycle

### Week 4: Documentation and Repo Hygiene

**Tasks:**
1. **Create atomic task issues** for all "Atom" tasks below
2. **Add architecture documentation**
   - Process model diagrams
   - IPC flow documentation
   - Agent API specification

3. **Security cleanup**
   - Verify no tokens in repo
   - Add `.env.example` for configuration
   - Document secrets management

---

## Phase 1: Core Editor and UX (Weeks 5-12)

### Atom E1: Minimal IDE Shell (Weeks 5-6)

**Goal:** VS Code-like layout with Monaco, file explorer, terminal panel

**Implementation:**

1. **Layout System** (`src/components/layout/`)
   - Activity bar (left): Explorer, Search, Git, Debug, Extensions
   - Sidebar: Dynamic panels based on active activity
   - Editor area: Tab bar + Monaco editor
   - Bottom panel: Terminal, Output, Problems
   - Status bar: Git branch, cursor position, AI status

2. **File Explorer** (`src/components/sidebar/FileExplorer.tsx`)
   - Tree view with expand/collapse
   - File icons by extension
   - Context menu (New File, New Folder, Delete, Rename)
   - Drag and drop support
   - Tauri commands: `get_file_tree`, `create_file`, `delete_file`, `rename_file`

3. **Tab System** (`src/components/tabs/`)
   - Tab bar with file names
   - Unsaved change indicators
   - Close buttons
   - Tab reordering
   - Persist open tabs in store

4. **Terminal Panel** (`src/components/terminal/`)
   - xterm.js integration
   - Tauri PTY backend (`src-tauri/src/terminal/`)
   - Multiple terminal tabs
   - Shell detection (PowerShell on Windows, bash/zsh on Unix)

**Files to modify:**
- `src/app/page.tsx` - Restructure to VS Code layout
- `src/components/sidebar/FileTree.tsx` - Enhance with full file operations
- `src-tauri/src/commands/fs.rs` - Add file operation commands

### Atom E2: Command Palette and Settings (Weeks 7-8)

**Goal:** VS Code-style command palette and settings system

**Implementation:**

1. **Command Palette** (`src/components/palette/CommandPalette.tsx`)
   - Fuzzy search commands
   - Keyboard shortcut: `Cmd+Shift+P` / `Ctrl+Shift+P`
   - Categories: File, Edit, View, AI, Git, etc.
   - Recently used commands
   - Command registry system

2. **Settings System** (`src/components/settings/`)
   - Settings UI with search
   - JSON settings editor
   - Categories: Editor, AI, Extensions, Keybindings, Terminal
   - OS-level persistence via Tauri
   - Default settings file

3. **Keybindings** (`src/lib/keybindings.ts`)
   - VS Code-compatible keybinding schema
   - Customizable shortcuts
   - Keybinding conflict detection
   - Platform-specific defaults (Mac vs Windows/Linux)

4. **Theming** (`src/lib/themeSystem.ts`)
   - Dark/light themes
   - Custom color themes
   - Monaco theme sync
   - CSS variable system

**Files to create:**
- `src/components/palette/CommandPalette.tsx`
- `src/components/settings/SettingsPanel.tsx`
- `src-tauri/src/commands/settings.rs`

### Atom E3: Extension Host Stub (Weeks 9-10)

**Goal:** Extension API compatible with Open VSX

**Implementation:**

1. **Extension API Surface** (`src-tauri/src/extensions/`)
   - Define VS Code-compatible API types
   - Command registration system
   - Event system
   - Storage API

2. **Open VSX Client** (`src-tauri/src/commands/extensions.rs`)
   - Search extensions from open-vsx.org
   - Download .vsix files
   - Install to user data directory
   - List installed extensions
   - Enable/disable extensions

3. **Extension Host Process** (stub)
   - Node.js subprocess architecture (future)
   - WASM plugin system (immediate)
   - Message passing protocol

4. **Extension UI** (`src/components/extensions/`)
   - Extension marketplace view
   - Installed extensions list
   - Extension details page
   - Install/uninstall buttons

**Files to modify:**
- `src-tauri/src/extensions/mod.rs` - Define extension API
- `src-tauri/src/commands/extensions.rs` - Open VSX integration
- `src/components/extensions/ExtensionPanel.tsx`

### Atom E4: LSP Manager (Weeks 11-12)

**Goal:** Language Server Protocol support for 10+ languages

**Implementation:**

1. **LSP Manager** (`src-tauri/src/lsp/`)
   - Spawn language servers per workspace
   - JSON-RPC communication over stdio
   - Server lifecycle management
   - Multi-server coordination

2. **Language Registry** (`src-tauri/src/lsp/languages.rs`)
   - Map file extensions to LSP servers
   - 10 core languages: Rust, TypeScript, Python, Go, C/C++, Java, JSON, YAML, Markdown, JavaScript
   - Auto-detect language from file extension
   - Lazy-start servers on first file open

3. **LSP Features in Monaco**
   - Completion items
   - Hover information
   - Go to definition
   - Find references
   - Diagnostics (errors/warnings)
   - Document symbols
   - Code actions

4. **Tree-sitter Fallback** (`src-tauri/src/lsp/tree_sitter_fallback.rs`)
   - Syntax highlighting when LSP unavailable
   - Basic outline/symbols
   - 10 grammars already configured

**Files to modify:**
- `src-tauri/src/lsp/mod.rs` - Core LSP manager
- `src-tauri/src/lsp_tower/` - tower-lsp integration
- `src/components/editor/MonacoEditor.tsx` - LSP client integration

---

## Phase 2: Agent Platform and Orchestration (Weeks 13-24)

### Atom A1: Agent Lifecycle API (Weeks 13-15)

**Goal:** Production-ready agent system with resource limits

**Implementation:**

1. **Agent Lifecycle** (`src-tauri/src/agents/`)
   - Spawn: Create new agent process
   - Pause: Suspend agent execution
   - Resume: Continue paused agent
   - Stop: Terminate agent gracefully
   - Resource limits: Memory, CPU, runtime

2. **Agent Types** (10 predefined agents)
   - `coder`: Write and edit code
   - `reviewer`: Code review and suggestions
   - `tester`: Generate and run tests
   - `debugger`: Debug and fix issues
   - `refactor`: Code refactoring
   - `doc`: Documentation generation
   - `security`: Security analysis
   - `perf`: Performance optimization
   - `planner`: Task planning and breakdown
   - `deploy`: Deployment assistance

3. **Agent Configuration** (`src-tauri/src/agents/config.rs`)
   - System prompts per agent type
   - Tool access permissions
   - Resource limits per agent
   - Model selection policy

4. **Agent Store** (`src-tauri/src/agent_store/`)
   - Persist agent configurations
   - User-defined agents
   - Agent marketplace integration

**Files to modify:**
- `src-tauri/src/agents/mod.rs` - Expand agent types
- `src-tauri/src/commands/agent_store.rs` - Complete API
- `src/components/agent-manager/AgentManagerPanel.tsx` - Enhanced UI

### Atom A2: Agent Sandboxing and IPC (Weeks 16-18)

**Goal:** Secure agent execution with proper isolation

**Implementation:**

1. **Sandboxing** (`src-tauri/src/plugin_sandbox/`)
   - WASM-based sandbox for agent code
   - File system access controls
   - Network access restrictions
   - Resource usage monitoring

2. **IPC Layer** (`src-tauri/src/agents/ipc.rs`)
   - UI to Agent communication
   - Agent to Agent communication
   - Message types: Task, Result, Progress, Error
   - Async message handling

3. **File Guard** (`src-tauri/src/agents/file_guard.rs`)
   - Whitelist/blacklist paths
   - Read-only vs read-write permissions
   - Audit logging for file access

4. **Guardrails** (`src-tauri/src/agents/guardrails.rs`)
   - Memory limit enforcement (2GB default)
   - CPU limit enforcement (50% default)
   - Runtime limit enforcement (30 min default)
   - Automatic termination on limit breach

**Files to create:**
- `src-tauri/src/agents/ipc.rs`
- `src-tauri/src/agents/sandbox.rs`

### Atom A3: PicoClaw Integration (Weeks 19-21)

**Goal:** Ultra-lightweight agent runtime

**Implementation:**

1. **PicoClaw Engine** (`src-tauri/src/picoclaw/`)
   - In-Rust implementation (already started)
   - <10MB memory footprint per agent
   - Fast startup (<100ms)
   - Task queue management

2. **PicoClaw Agent Types**
   - Quick tasks: Code snippets, explanations
   - Background tasks: Search, indexing
   - Micro-agents: Single-purpose agents

3. **Orchestrator Integration** (`src-tauri/src/orchestrator/`)
   - Route small tasks to PicoClaw
   - Route complex tasks to full agents
   - Load balancing between backends

4. **PicoClaw UI** (`src/components/agents/PicoClawPanel.tsx`)
   - Quick action buttons
   - Status indicators
   - Task history

**Files to modify:**
- `src-tauri/src/picoclaw/mod.rs` - Complete implementation
- `src-tauri/src/orchestrator/mod.rs` - Integration

### Atom A4: Parallel Agent Execution (Weeks 22-24)

**Goal:** 10 concurrent agents with coordination

**Implementation:**

1. **Parallel Orchestrator** (`src-tauri/src/agents/parallel_agents.rs`)
   - Task queue with priority
   - Agent pool management
   - Concurrent execution (already exists, enhance)
   - Result aggregation

2. **Agent Coordination**
   - Shared context via RAG/memory
   - Conflict resolution
   - Dependency management
   - Synchronization points

3. **Mission Control** (`src/components/agent-manager/MissionControl.tsx`)
   - Visual mission timeline
   - Agent status dashboard
   - Real-time progress updates
   - Artifact display (diffs, test results)

4. **Chat Integration**
   - Natural language mission creation
   - Agent delegation from chat
   - Result presentation in chat

**Files to modify:**
- `src-tauri/src/agents/parallel_agents.rs` - Enhance coordination
- `src/components/agent-manager/AgentManagerPanel.tsx` - Mission control UI

---

## Phase 3: Local Model Integration (Weeks 25-36)

### Atom M1: Ollama Integration (Weeks 25-27)

**Goal:** Production-ready Ollama client

**Implementation:**

1. **Ollama Client** (`src-tauri/src/ai/ollama.rs`)
   - Model discovery and listing
   - Model download progress
   - Chat completions API
   - Streaming responses

2. **Model Management UI** (`src/components/llm/ModelManager.tsx`)
   - Available models list
   - Download button with progress
   - Model info (size, parameters, VRAM required)
   - Default model selection

3. **Auto-Detection**
   - Detect Ollama installation
   - Prompt to install if missing
   - Auto-start Ollama if configured

4. **Integration with Chat**
   - Backend selector in chat panel
   - Model switching during conversation
   - Per-model system prompts

**Files to modify:**
- `src-tauri/src/ai/` - Ollama client (already exists, enhance)
- `src-tauri/src/commands/ai.rs` - Model management commands
- `src/components/chat/` - Model selector UI

### Atom M2: AirLLM Adapter (Weeks 28-30)

**Goal:** Memory-efficient large model inference

**Implementation:**

1. **AirLLM Service** (`services/airllm-service/`)
   - Python FastAPI service (already started)
   - Layer-wise inference
   - Model quantization (4-bit, 8-bit)
   - VRAM optimization

2. **Rust Bridge** (`src-tauri/src/airllm/`)
   - HTTP client to AirLLM service
   - Model loading requests
   - Inference requests
   - Progress tracking

3. **Large Model Support**
   - GLM5 (via AirLLM)
   - Kimi K2.5 (via AirLLM)
   - Qwen2.5 (via AirLLM)
   - VRAM requirement checking

4. **UI for Large Models**
   - VRAM budget settings
   - Model recommendation based on hardware
   - Quantization options
   - Download management

**Files to modify:**
- `services/airllm-service/main.py` - Complete implementation
- `src-tauri/src/airllm/mod.rs` - Rust bridge
- `src/components/llm/LargeModelPanel.tsx`

### Atom M3: Model Selection Policy (Weeks 31-33)

**Goal:** Auto-select models based on system resources

**Implementation:**

1. **Hardware Detection** (`src-tauri/src/benchmark/hardware.rs`)
   - GPU detection (NVIDIA, AMD, Apple Silicon)
   - VRAM detection
   - RAM detection
   - CPU core count

2. **Model Selection Engine** (`src-tauri/src/ai/model_selector.rs`)
   - Task complexity analysis
   - Resource availability check
   - Model capability matching
   - Fallback chain

3. **Selection Policies**
   - Fast tasks: PicoClaw
   - Standard tasks: Ollama (7B-13B)
   - Complex tasks: AirLLM (70B+)
   - Offline: Embedded LLM

4. **User Preferences**
   - Override auto-selection
   - Favorite models
   - Performance vs quality slider

**Files to create:**
- `src-tauri/src/ai/model_selector.rs`
- `src/components/settings/AISettings.tsx`

### Atom M4: Embedded LLM (Weeks 34-36)

**Goal:** Fully offline inference with Candle

**Implementation:**

1. **Candle Integration** (`src-tauri/src/embedded_llm/`)
   - GGUF model loading
   - Text generation
   - Chat template support
   - Quantization support

2. **Model Management**
   - Built-in small models (Phi-2, TinyLlama)
   - Download larger models on demand
   - Model cache management

3. **Fallback Behavior**
   - Use embedded when Ollama unavailable
   - Graceful degradation
   - User notification

4. **Performance Optimization**
   - Metal acceleration (macOS)
   - CUDA acceleration (NVIDIA)
   - CPU-optimized inference

**Files to modify:**
- `src-tauri/src/embedded_llm/mod.rs` - Complete implementation
- `src-tauri/src/commands/embedded_llm.rs`

---

## Phase 4: Collaboration and Sharing (Weeks 37-48)

### Atom C1: Real-time Collaboration (Weeks 37-40)

**Goal:** CRDT-based editing for 50+ members

**Implementation:**

1. **CRDT Engine** (`src-tauri/src/collab/`)
   - yrs integration (fix API issues)
   - Document synchronization
   - Conflict resolution
   - Offline support

2. **WebSocket Server**
   - Session management
   - Room-based collaboration
   - Presence broadcasting
   - Message relay

3. **Collaboration UI** (`src/components/collaboration/`)
   - Remote cursors
   - Remote selections
   - User avatars
   - Presence indicators

4. **Session Management**
   - Create session
   - Join via link/token
   - Permission levels (read, write, admin)
   - Session persistence

**Files to modify:**
- `src-tauri/src/collab/` - Fix yrs integration
- `src-tauri/src/commands/collaboration.rs`
- `src/components/collaboration/RemoteCursors.tsx`

### Atom C2: Shared Terminals and Debugging (Weeks 41-44)

**Goal:** Shared development environment

**Implementation:**

1. **Shared Terminals**
   - Terminal session sharing
   - Read-only and read-write modes
   - Terminal replay

2. **Shared Debugging**
   - Debug session sharing
   - Collaborative breakpoints
   - Shared variable inspection
   - Synchronized stepping

3. **Role-based Permissions** (`src-tauri/src/auth/permissions.rs`)
   - Viewer: Read-only
   - Contributor: Read-write
   - Maintainer: Admin functions
   - Custom roles

4. **Collaboration Panel** (`src/components/collaboration/CollabPanel.tsx`)
   - Participant list
   - Permission management
   - Activity feed
   - Chat within session

**Files to create:**
- `src-tauri/src/collab/terminal_share.rs`
- `src-tauri/src/collab/debug_share.rs`

### Atom C3: End-to-End Encryption (Weeks 45-48)

**Goal:** Signal Protocol for secure collaboration

**Implementation:**

1. **E2EE Implementation** (`src-tauri/src/e2ee/`)
   - X3DH key agreement
   - Double Ratchet algorithm
   - Message encryption/decryption
   - Key management

2. **Secure Session Setup**
   - Identity key generation
   - Pre-key bundles
   - Session establishment
   - Key verification

3. **UI for E2EE** (`src/components/collaboration/E2EESettings.tsx`)
   - Enable/disable E2EE
   - Key verification UI
   - Security status indicators

4. **Fallback Behavior**
   - Server relay for non-E2EE
   - Mixed mode (some users E2EE, some not)
   - Clear security indicators

**Files to modify:**
- `src-tauri/src/e2ee/` - Complete implementation
- `src/components/collaboration/` - Security UI

---

## Phase 5: Language Support and Tooling (Weeks 49-56)

### Atom L1: LSP Manager Enhancement (Weeks 49-52)

**Goal:** 165+ languages via LSP

**Implementation:**

1. **Language Registry Expansion**
   - Complete mapping of extensions to LSP servers
   - Auto-install prompts for missing LSPs
   - Version management

2. **LSP Installation Manager**
   - One-click LSP installation
   - npm-based LSPs (TypeScript, ESLint, etc.)
   - Binary-based LSPs (rust-analyzer, gopls, etc.)
   - Python-based LSPs (pylsp, pyright)

3. **LSP Features**
   - Code formatting
   - Rename refactoring
   - Code actions (quick fixes)
   - Inlay hints
   - Semantic highlighting

4. **Fallback System**
   - Tree-sitter for syntax highlighting
   - Basic completion from text
   - Snippet support

**Files to modify:**
- `src-tauri/src/lsp/languages.rs` - Expand registry
- `src-tauri/src/commands/lsp.rs` - Installation commands

### Atom L2: Debug Adapter Protocol (Weeks 53-56)

**Goal:** Integrated debugging

**Implementation:**

1. **DAP Client** (`src-tauri/src/debug/`)
   - Debug adapter communication
   - Launch configurations
   - Breakpoint management
   - Variable inspection

2. **Debug UI** (`src/components/debug/`)
   - Debug toolbar (play, pause, step, etc.)
   - Call stack view
   - Variables view
   - Watch expressions
   - Debug console

3. **Debugger Support**
   - CodeLLDB (C/C++, Rust)
   - debugpy (Python)
   - Node.js debugger
   - Go delve

4. **Launch Configuration**
   - `.vscode/launch.json` compatibility
   - Debug configuration UI
   - Environment variables
   - Pre-launch tasks

**Files to modify:**
- `src-tauri/src/debug/` - DAP implementation
- `src/components/debug/DebugPanel.tsx`

---

## Phase 6: Packaging and Distribution (Weeks 57-64)

### Atom P1: Cross-Platform Installers (Weeks 57-60)

**Goal:** Professional installers for all platforms

**Implementation:**

1. **Windows Installer**
   - NSIS installer (.exe)
   - MSI installer for enterprise
   - Windows Store package
   - Auto-start option

2. **macOS Installer**
   - DMG with drag-and-drop
   - PKG installer
   - Notarization and signing
   - Apple Silicon + Intel universal binary

3. **Linux Packages**
   - AppImage (universal)
   - DEB package (Debian/Ubuntu)
   - RPM package (Fedora/RHEL)
   - Flatpak support

4. **Tauri Configuration** (`src-tauri/tauri.conf.json`)
   - Bundle configuration
   - Icon assets
   - Deep link handling
   - Protocol registration

**Files to modify:**
- `src-tauri/tauri.conf.json`
- `scripts/build-*.sh` - Build scripts

### Atom P2: Auto-Updater (Weeks 61-64)

**Goal:** Seamless updates

**Implementation:**

1. **Update System** (`src-tauri/src/update/`)
   - Check for updates
   - Download updates
   - Delta updates
   - Install on restart

2. **Update Server**
   - GitHub Releases integration
   - Update manifest
   - Channel support (stable, beta, nightly)
   - Rollback capability

3. **Update UI** (`src/components/update/`)
   - Update notification
   - Changelog display
   - Install now/later options
   - Progress indicator

4. **Model Updates**
   - Model list updates
   - New model notifications
   - Automatic model downloads (optional)

**Files to modify:**
- `src-tauri/src/update/` - Already exists, enhance
- `src/components/update/UpdateChecker.tsx`

---

## Phase 7: Security and Polish (Weeks 65-72)

### Atom S1: Security Hardening (Weeks 65-68)

**Goal:** Enterprise-grade security

**Implementation:**

1. **Local-First Default**
   - No cloud by default
   - Explicit opt-in for cloud features
   - Data stays on device

2. **Agent Permission Model** (`src-tauri/src/trust/`)
   - Permission prompts for destructive actions
   - Dry-run mode
   - Human-in-the-loop approvals
   - Audit logging

3. **Sandboxing**
   - WASM plugin sandbox
   - Agent process isolation
   - File system restrictions
   - Network restrictions

4. **Secure Defaults**
   - Secure configuration defaults
   - Automatic security updates
   - Vulnerability scanning

**Files to modify:**
- `src-tauri/src/trust/` - Already exists, enhance
- `src/components/trust/PermissionDialog.tsx`

### Atom S2: Telemetry and Privacy (Weeks 69-72)

**Goal:** Transparent telemetry

**Implementation:**

1. **Telemetry System** (`src-tauri/src/telemetry/`)
   - Anonymous usage metrics
   - Error reporting (opt-in)
   - Performance metrics
   - Feature usage

2. **Privacy Controls**
   - Opt-in during onboarding
   - Granular privacy settings
   - Data deletion
   - Transparency report

3. **GDPR Compliance**
   - Data portability
   - Right to deletion
   - Consent management
   - Privacy policy

4. **Open Source Verification**
   - Reproducible builds
   - Open source all code
   - Community audit

**Files to modify:**
- `src-tauri/src/telemetry/` - Already exists, enhance
- `src/components/onboarding/PrivacySettings.tsx`

---

## Repository Actions and GitHub Integration

### Repo Action R1: Create Roadmap Directory

Create `roadmap/` with:
- `phases/` - Phase-specific documentation
- `atoms/` - Individual atomic task specifications
- `milestones.md` - Milestone definitions

### Repo Action R2: Add Architecture Documentation

Create `docs/architecture/`:
- `process-model.md` - Process architecture
- `ipc.md` - Inter-process communication
- `agent-api.md` - Agent API specification
- `security-model.md` - Security architecture

### Repo Action R3: Integration Adapters

Create `integrations/`:
- `ollama/` - Ollama integration docs and configs
- `airllm/` - AirLLM adapter
- `picoclaw/` - PicoClaw integration

### Repo Action R4: CI Templates

Enhance `.github/workflows/`:
- `build.yml` - Cross-platform builds
- `test.yml` - Automated testing
- `release.yml` - Release automation
- `security.yml` - Security scanning

### Repo Action R5: GitHub Issues

Create issues for each Atom with labels:
- `atom:e1`, `atom:e2`, etc.
- `priority:p0`, `priority:p1`, `priority:p2`
- `estimate:1w`, `estimate:2w`, `estimate:3w`
- `area:frontend`, `area:backend`, `area:ai`

### Repo Action R6: Community Files

Ensure exists:
- `CONTRIBUTING.md` - Contribution guidelines
- `CODE_OF_CONDUCT.md` - Community standards
- `SECURITY.md` - Security policy
- `.github/dependabot.yml` - Dependency updates

---

## Success Criteria

### Phase 0 Success
- [ ] `cargo build` passes without errors
- [ ] `cargo test` passes all tests
- [ ] CI green on all platforms
- [ ] App runs and loads successfully

### Phase 1 Success
- [ ] VS Code-like layout functional
- [ ] File explorer with full operations
- [ ] Command palette with 50+ commands
- [ ] Settings persistence working
- [ ] 10 languages with LSP support

### Phase 2 Success
- [ ] 10 agent types defined and working
- [ ] Parallel agent execution (5+ concurrent)
- [ ] Agent sandboxing functional
- [ ] Mission control UI complete

### Phase 3 Success
- [ ] Ollama integration production-ready
- [ ] AirLLM running 70B models
- [ ] Auto model selection working
- [ ] Embedded LLM fallback functional

### Phase 4 Success
- [ ] Real-time collaboration with 10+ users
- [ ] E2EE working
- [ ] Shared terminals functional
- [ ] Role-based permissions

### Phase 5 Success
- [ ] 50+ languages with LSP
- [ ] Path to 165+ documented
- [ ] Debugging functional for 5+ languages

### Phase 6 Success
- [ ] Installers for Windows, macOS, Linux
- [ ] Auto-updater working
- [ ] Delta updates implemented

### Phase 7 Success
- [ ] Security audit passed
- [ ] Privacy controls complete
- [ ] Documentation complete
- [ ] Beta release published

---

## Resource Allocation

### Minimal Viable Team

| Role | Count | Responsibilities |
|------|-------|------------------|
| Core Engineers | 3-5 | Editor, LSP, extension host, packaging |
| AI Engineers | 2-3 | Ollama, AirLLM, agent orchestration |
| Infra/DevOps | 1-2 | CI, cross-builds, collaboration server |
| QA/UX | 1-2 | Usability, accessibility, performance |

### Development Priorities

1. **P0 (Must Have):** Core IDE, LSP, Ollama, 10 agents
2. **P1 (Should Have):** Collaboration, Open VSX, AirLLM
3. **P2 (Nice to Have):** E2EE, advanced debugging, enterprise features

---

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Local model resource constraints | Auto-model selection, lazy-loading, AirLLM optimization |
| Agent autonomy causing unsafe changes | Strict sandboxing, permission prompts, dry-run mode |
| VS Code feature scope too large | Prioritize core UX first, leverage Open VSX |
| Model licensing issues | Respect licenses, clear UI for provenance |
| Build complexity | Modular architecture, CI/CD automation |

---

## First Week Sprint Checklist

- [ ] Create GitHub issues for top 20 atoms
- [ ] Assign priorities and estimates
- [ ] Fix first 5 Rust compilation errors
- [ ] Set up CI pipeline
- [ ] Create architecture documentation skeleton
- [ ] Prototype Ollama client model listing
- [ ] Push initial plan to repo

---

**Plan Version:** 1.0  
**Last Updated:** 2026-03-02  
**Repository:** https://github.com/nkpendyam/Kyro_IDE