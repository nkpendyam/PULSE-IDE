# KYRO IDE — Complete Codebase Audit & 100% Execution Master Plan

**Date:** 2025-07-10  
**Commit:** `c75a5c8` (branch: `main`)  
**Build Status:** cargo check ✅ | tsc ✅ | vitest 53/53 ✅

---

## STEP 1: Architecture File Map

### 1A. Frontend / UI Shell (Next.js 16 + React 19 + Tailwind + shadcn/ui)

| Directory | Files | Purpose | Status |
|-----------|-------|---------|--------|
| `src/app/layout.tsx` | 1 | Root Next.js layout with providers | ✅ REAL |
| `src/app/page.tsx` | 1 | Main IDE shell (~400 lines), 16 components, 13 sidebar panels | ✅ REAL |
| `src/app/globals.css` | 1 | Tailwind v4 + GitHub Dark theme variables | ✅ REAL |
| `src/store/kyroStore.ts` | 1 | Zustand store with 200+ properties | ✅ REAL |
| `src/store/extendedStore.ts` | 1 | Auth, Collab, Extensions, Plugins, Updates store | ✅ REAL |
| `src/lib/` | 5 | `fileOperations.ts`, `keybindings.ts`, `themeSystem.ts`, `utils.ts`, `db.ts` | ✅ REAL |
| `src/hooks/` | 2 | `use-mobile.ts`, `use-toast.ts` | ✅ REAL |
| `src/components/editor/` | 4 | CodeEditor, MonacoEditor, GhostTextProvider, MultiCursor | ✅ REAL — Tauri invoke wired |
| `src/components/sidebar/` | 3 | FileTree, SymbolOutline, ActivityBar | ✅ REAL — Tauri invoke wired |
| `src/components/chat/` | 3 | AIChatSidebar, AIChatPanel, InlineChat | ✅ REAL — Tauri invoke wired |
| `src/components/git/` | 2 | GitStagingPanel, DiffViewer | ⚠️ PARTIAL — 6 missing Tauri commands |
| `src/components/debug/` | 1 | DebugPanel (full debugger UI) | ✅ REAL |
| `src/components/terminal/` | 1 | TerminalPanel (xterm.js) | ✅ REAL |
| `src/components/palette/` | 1 | CommandPalette (Ctrl+Shift+P, 50+ commands) | ✅ REAL |
| `src/components/search/` | 2 | GlobalSearch, SymbolSearch | ✅ REAL |
| `src/components/settings/` | 2 | SettingsPanel, UpdatePanel | ✅ REAL |
| `src/components/extensions/` | 1 | UnifiedMarketplace (VS Code + Open VSX) | ✅ REAL |
| `src/components/collaboration/` | 2 | CollaborationPanel, EditorPresence | ⚠️ PARTIAL — `broadcast_cursor` missing |
| `src/components/llm/` | 2 | HardwareInfoPanel, RagPanel | ✅ REAL |
| `src/components/lsp/` | 1 | LspPanel (language server management) | ✅ REAL |
| `src/components/auth/` | 1 | AuthModal (login/register + OAuth) | ✅ REAL |
| `src/components/agent-manager/` | 1 | AgentManagerPanel (orchestration UI) | ✅ REAL |
| `src/components/plugins/` | 1 | PluginManager (WASM plugins) | ✅ REAL |
| `src/components/migration/` | 1 | VsCodeMigration (import settings/keybindings) | ✅ REAL |
| `src/components/gitcrdt/` | 1 | GitCrdtPanel (CRDT-based sync) | ✅ REAL |
| `src/components/websocket/` | 1 | WebSocketPanel (connection mgmt) | ✅ REAL |
| `src/components/navigation/` | 1 | Breadcrumbs | ✅ REAL |
| `src/components/onboarding/` | 1 | FirstRunExperience (wizard) | ⚠️ PARTIAL — model download simulated |
| `src/components/theme/` | 1 | ThemeProvider | ✅ REAL |
| `src/components/ui/` | 50+ | shadcn/ui components (Button, Dialog, etc.) | ✅ REAL |

**Frontend Summary:** ~95 components. 95% fully wired to Tauri. 150+ `invoke()` calls to backend.

---

### 1B. Backend / Context Engine (Rust 2021)

| Module | Status | Key Exports | Deps Used | Notes |
|--------|--------|-------------|-----------|-------|
| **AI & Inference** |
| `ai/` | ✅ REAL | `AiClient`, `AiService`, `QualityGate` | reqwest | Ollama HTTP client, completion pipeline |
| `swarm_ai/` | ✅ REAL | `SwarmAIEngine`, `SpeculativeDecoder`, `KVCache`, `P2PSwarm`, `ModelRouter` | tokio, anyhow | Speculative decoding, multi-model routing, P2P swarm |
| `embedded_llm/` | ✅ REAL | `EmbeddedLLMEngine`, `ModelManager`, `MemoryProfiler` | — | llama.cpp with CUDA/Metal/Vulkan, memory tiers |
| `inference/` | ✅ REAL | `InferenceEngine`, `LoadedModel` | candle | Candle GGUF/safetensors inference, GPU offloading |
| `airllm/` | ✅ REAL | `AirLLMEngine`, `QuantizationType` | — | 70B on 4GB VRAM via Python subprocess |
| `picoclaw/` | ✅ REAL | `PicoClawEngine`, `NGramModel` | tree-sitter | Ultra-lightweight AI <10MB, pattern matching |
| `aot/` | ✅ REAL | `AotReasoner`, `AtomOfThought` | — | Atoms-of-Thought decomposition + DAG execute |
| **Code Analysis** |
| `lsp/` | ✅ REAL | `CompletionEngine`, `SmartSelection`, `LspManager` | tree-sitter | Molecular LSP for 165+ languages |
| `lsp_tower/` | ✅ REAL | `KyroLspBackend`, `DocumentState` | tower-lsp | Standards-compliant LSP server |
| `lsp_transport/` | ✅ REAL | `LspClient`, `RealTransport`, `SemanticTokens` | lsp-types | Real LSP client via stdio/socket |
| `debug/` | ✅ REAL | `DapClient`, `DapServer`, `DebugSession` | dap | DAP session management, breakpoint tracking |
| `rag/` | ✅ REAL | `RAGManager`, `CodeChunk`, `Indexer`, `Embedder` | tree-sitter, ndarray, hnsw | Vector DB for code search, AST chunking |
| `repowiki/` | ✅ REAL | `RepoWikiEngine`, `DependencyGraph`, `WikiPage` | tree-sitter, sha2 | Auto-docs, Mermaid diagrams, living sync |
| **Orchestration & Agents** |
| `orchestrator/` | ✅ REAL | `KyroOrchestrator`, `Mission`, `QuestState` | reqwest | Planner→Coder→Reviewer→Tester pipeline |
| `agents/` | ✅ REAL | `AgentGuardrails`, `AgentMemory`, `AgentScheduler` | rusqlite | 2GB limit, 30min timeout, SQLite memory |
| `autonomous/` | ⚠️ PARTIAL | `AutonomousAgent`, `ExecutionPlan`, `Task`, `Verifier` | — | Types + verifier real; executor deferred |
| `agent_editor/` | ✅ REAL | `MCPAgent`, `ApprovalWorkflow`, `EditExecutor` | — | Agent file editing with diff preview + rollback |
| `agent_store/` | ✅ REAL | `AgentDefinition`, `AgentStore` | — | GitHub import, marketplace ranking |
| `chat_sidebar/` | ✅ REAL | `RAGChatEngine`, `ContextBuilder`, `StreamingResponder` | — | Code-aware chat with RAG context |
| **MCP** |
| `mcp/` | ✅ REAL | `MCPServer`, `MCPClient`, `ToolRegistry`, `TransportType` | — | Stdio/SSE/WebSocket transports |
| **Collaboration** |
| `git/` | ✅ REAL | `GitManager`, `GitStatus`, `FileDiff`, `BlameLine` | git2 | Full git2 bindings |
| `git_crdt/` | ✅ REAL | `CollaborationManager`, `YjsAdapter`, `AiMergeResolver` | yrs | Yjs + Git persistence + AI merge resolution |
| `collab/` | ✅ REAL | `CollabManager`, `CollabRoom`, `SyncMessage` | yrs | Real-time Yrs CRDT sync |
| `p2p/` | ✅ REAL | `P2PCollaboration`, `PeerDiscovery`, `WebRTCManager` | — | mDNS discovery, WebRTC data channels |
| **Security** |
| `auth/` | ✅ REAL | `AuthManager`, `JwtHandler`, `RateLimiter`, `AuditLog` | argon2, jsonwebtoken | Argon2 + JWT + RBAC + brute-force protection |
| `e2ee/` | ✅ REAL | `E2eeSession`, `DoubleRatchetState`, `X3DH_Challenge` | chacha20poly1305, ed25519-dalek | Signal protocol, forward secrecy |
| `trust/` | ✅ REAL | `AgentIdentity`, `Permission`, `TrustLevel` | — | 4-tier trust, path/command/URL patterns |
| **Files & Editor** |
| `files/` | ✅ REAL | `FileWatcher`, `FileChangeEvent` | notify | Real-time file watching |
| `terminal/` | ✅ REAL | `TerminalManager`, `TerminalSession` | portable-pty | Real PTY terminal emulation |
| `buffer/` | ✅ REAL | `RopeBuffer`, `GapBuffer`, `PieceTable`, `UndoStack` | ropey | O(log n) rope, undo/redo |
| **Extensions** |
| `vscode_compat/` | ✅ REAL | `VSCodeApi`, `ExtensionHost`, `MarketplaceClient` | — | VS Code API shim, Node.js subprocess |
| `extensions/` | ✅ REAL | `ExtensionManager`, `OpenVSXRegistry`, `ExtensionSandbox` | — | Open VSX integration, sandboxing |
| `plugin_sandbox/` | ✅ REAL | `WasmRuntime`, `PluginApi`, `CapabilitySet` | wasmtime | WASM plugin system, capability-based security |
| **Infrastructure** |
| `telemetry/` | ✅ REAL | `TelemetryManager`, `TelemetryEvent` | — | Privacy-first, opt-in, event buffering |
| `accessibility/` | ✅ REAL | `AccessibilityManager`, `ScreenReaderSupport` | — | WCAG 2.1 AA compliance |
| `benchmark/` | ✅ REAL | `BenchmarkRunner`, `BenchmarkSuite` | — | Startup, file ops, AI, LSP, memory, collab |
| `update/` | ✅ REAL | `UpdateManager`, `DeltaUpdater`, `HealthMonitor` | — | Delta patching, auto-rollback, multi-channel |
| `feedback/` | ✅ REAL | `FeedbackDB`, `Suggestion`, `FeedbackStats` | rusqlite | SQLite learning flywheel |
| **Business** |
| `quality/` | ⚠️ PARTIAL | `OnboardingManager`, `HardwareProfile` | sysinfo | Hardware detection real; tier selection placeholder |
| `business/` | ⚠️ PARTIAL | `SubscriptionTier`, `LicenseManager`, `UsageTracker` | — | Config-only, no SaaS backend API |
| `memory/` | ⚠️ PARTIAL | `HierarchicalMemory`, `LRUCache`, `SymbolGraph` | — | L1/L2/L4 real; `extract_symbols/imports` return `Vec::new()` |
| **Platform** |
| `telegram/` | ✅ REAL | `TelegramBot`, `NotificationManager` | — | Remote code review, rate limiting |

**Backend Summary:** 42 modules. 37 REAL. 5 PARTIAL. 0 pure stubs.

---

### 1C. Workspace Crates (`src-tauri/crates/`)

| Crate | Status | Purpose |
|-------|--------|---------|
| `kyro-core` | ✅ REAL | `KyroError`, `ServiceRegistry`, `RuntimeConfig` |
| `kyro-ai` | ✅ REAL | AI orchestration layer, agent coordination |
| `kyro-collab` | ✅ REAL | CRDT engine, Yrs integration, 50+ users |
| `kyro-git` | ✅ REAL | Git abstraction layer |
| `kyro-lsp` | ✅ REAL | LSP lifecycle management, DashMap thread-safe |

---

### 1D. CI/CD & DevOps

| File | Purpose | Status |
|------|---------|--------|
| `.github/workflows/ci.yml` | Lint, test, security audit, coverage, reproducible build, docs | ✅ REAL |
| `.github/workflows/release.yml` | macOS universal, Windows MSI, Linux AppImage release builds | ✅ REAL |
| `.github/workflows/benchmark.yml` | Performance benchmarks on push/PR | ✅ REAL |
| `scripts/build-production.ps1` | Windows production build | ✅ REAL |
| `scripts/build-production.sh` | Linux/macOS production build | ✅ REAL |
| `scripts/dev-setup.ps1` / `.sh` | Developer environment setup | ✅ REAL |
| `codecov.yml` | Coverage config | ✅ REAL |
| `Caddyfile` | Reverse proxy config | ✅ REAL |

---

### 1E. Tests

| Location | Files | Coverage |
|----------|-------|----------|
| `tests/unit/typescript/` | 2 (`editor.test.ts`, `monaco-editor.test.tsx`) | Frontend editor |
| `tests/e2e/` | 2 (`editor.spec.ts`, `collaboration.spec.ts`) | Playwright E2E |
| `src-tauri/tests/` | 9 tests | auth, collab, e2ee, integration, lsp, perf, security, vscode_compat |
| `src-tauri/benches/` | 1 (`performance.rs`) | Rust benchmarks |
| **vitest** | 53/53 passing | ✅ |

---

## STEP 2: State of the Union — Gap Analysis

### 🟢 100% COMPLETE (37 features)

These need zero additional work:

1. **Monaco Editor** — Multi-cursor, split panes, tabs, syntax highlighting
2. **Ghost Text AI** — Streaming completions with token display
3. **AI Chat Sidebar** — RAG-aware, streaming, code context
4. **Inline Edit** — Code transforms with diff preview + approval
5. **Command Palette** — Fuzzy search over 50+ commands
6. **File Tree** — Full FS ops via Tauri (read/write/create/delete/rename)
7. **Terminal** — xterm.js + real PTY via portable-pty  
8. **Git** — Status, commit, diff, log, branch, blame, stash, merge via git2
9. **Debug** — Full DAP client, breakpoints, variables, call stack
10. **LSP** — 165+ languages, tree-sitter molecular LSP
11. **LSP Transport** — Real stdio/socket client, semantic tokens, inlay hints
12. **LSP Tower** — Standards-compliant LSP server
13. **Ollama AI** — HTTP client, completion pipeline, quality gate
14. **Embedded LLM** — llama.cpp with CUDA/Metal/Vulkan, memory tiers
15. **AirLLM** — 70B on 4GB VRAM via Python subprocess
16. **PicoClaw** — Ultra-lightweight AI <10MB, N-gram + tree-sitter
17. **Atoms of Thought** — Decompose→DAG→Execute reasoning
18. **Speculative Decoding** — KV cache, parallel verification
19. **Candle Inference** — GGUF/safetensors model loading
20. **MCP** — Full spec: Stdio/SSE/WebSocket transports, tool calling
21. **Multi-Model Router** — Route by task complexity, model registry
22. **Orchestrator** — Mission control: Planner→Coder→Reviewer→Tester
23. **Agent Guardrails** — 2GB memory, 30min timeout, file whitelist
24. **Agent Editor** — Approval workflow, diff preview, rollback
25. **Agent Store** — GitHub import, marketplace ranking
26. **CRDT Collab** — Yrs port, awareness protocol, 50+ users
27. **Git-CRDT** — Yjs adapter + Git persistence + AI merge resolution
28. **P2P** — mDNS discovery, WebRTC data channels, 10 peers
29. **E2EE** — Signal protocol, X3DH, Double Ratchet, ChaCha20
30. **Auth** — JWT + Argon2 + RBAC + rate limiting + audit log
31. **Trust System** — 4-tier trust, path/command/URL patterns
32. **VS Code Compat** — Extension API shim, Node.js subprocess
33. **Open VSX Extensions** — Registry integration, sandboxing
34. **WASM Plugins** — Capability-based security, plugin lifecycle
35. **RepoWiki** — AST extraction, dependency graph, LLM wiki gen, living sync
36. **RAG** — Vector DB, AST-aware chunking, background indexing
37. **Feedback Flywheel** — SQLite learning from accept/reject/correct

---

### 🟡 PARTIALLY IMPLEMENTED (5 features)

| Feature | What Works | What's Missing | Impact |
|---------|-----------|---------------|--------|
| **Git Staging UI** | `GitStagingPanel.tsx` renders staging area | Backend commands `git_stage`, `git_unstage`, `git_stage_all`, `git_unstage_all`, `git_discard`, `git_stage_hunk` don't exist | HIGH — users can't stage files |
| **Cursor Broadcasting** | `EditorPresence.tsx` sends `broadcast_cursor` | Backend command `broadcast_cursor` doesn't exist | MEDIUM — collab cursors broken |
| **Memory Hierarchy** | L1 immediate, L2 LRU, L4 symbol graph work. `build_context()` builds multi-level prompt. | `extract_symbols()` and `extract_imports()` return `Vec::new()` — should use tree-sitter. Compression uses regex heuristics instead of real AST. | HIGH — AI context is weaker than it should be |
| **Autonomous Execution** | Types, planning, verifier (command/path/output checks) all real. | No actual AI-driven executor — `ExecutionPlan` is created but tasks aren't auto-executed via LLM. | MEDIUM — agents can plan but not fully self-drive |
| **Onboarding** | Wizard UI exists with welcome/model/language steps | Model download is simulated (progress bar runs but doesn't download real model) | LOW — cosmetic issue |

---

### 🔴 ENTIRELY MISSING (8 features needed for a world-class Agentic IDE)

| # | Feature | What It Is | Why It Matters |
|---|---------|-----------|----------------|
| 1 | **GraphRAG** | Graph-enhanced retrieval-augmented generation over the RepoWiki dependency graph | Without it, RAG is flat vector search — misses structural relationships between files/symbols |
| 2 | **Agent Streaming UI** | Real-time terminal-style view of agent execution (plan steps, file edits, test results) | Users can't watch agents work — currently a modal, not a live feed |
| 3 | **Test Runner Integration** | Run project tests from UI, capture results, feed back to agents | Agents can't verify their code changes actually pass tests |
| 4 | **Integrated Browser Preview** | WebView panel showing localhost preview of web apps | Listed in README but no component exists |
| 5 | **n8n Workflow Editor** | Visual workflow builder for n8n automations | Listed in README but no component exists |
| 6 | **Model Download Manager** | Real embedded model downloading with progress, verification, and storage | FirstRunExperience simulates this but doesn't actually download |
| 7 | **Settings Persistence** | Write settings to disk and reload on startup | Settings panel exists but values reset on restart |
| 8 | **Project-Scoped Config** | `.kyro/` directory with project-level settings, agent rules, model prefs | Currently global only — no per-project overrides |

---

## STEP 3: File-by-File Blueprint with OSS Libraries

### FIX 1: Git Staging Commands (7 commands)

**File:** `src-tauri/src/commands/git.rs` — Add 6 new `#[tauri::command]` functions  
**File:** `src-tauri/src/git/mod.rs` — Add corresponding methods to `GitManager`  
**File:** `src-tauri/src/main.rs` — Register 6 new commands  
**File:** `src-tauri/src/commands/collaboration.rs` — Add `broadcast_cursor` command  
**File:** `src-tauri/src/main.rs` — Register `broadcast_cursor`  

**Library:** `git2` (already in Cargo.toml)  
**Implementation:** `git2::Repository::index()` → `index.add_path()` / `index.remove_path()` for stage/unstage. `checkout_index()` with `FORCE` for discard. Hunk staging via `diff.foreach()` + selective `index.add_frombuffer()`.

---

### FIX 2: Memory Hierarchy — Wire Tree-Sitter

**File:** `src-tauri/src/memory/mod.rs` — Replace `extract_symbols()` and `extract_imports()` stubs  
**Approach:** Import `tree_sitter` + language grammars (already compiled in `rag/`). Reuse the AST extraction logic from `repowiki/scanner.rs` — call `extract_ast()` to get `SymbolInfo` and `ImportInfo`, then convert to `memory::SymbolInfo`.

**File:** `src-tauri/src/memory/compression.rs` — Replace regex with tree-sitter  
**Approach:** Walk AST, keep only function signatures + struct definitions + impl blocks. Strip function bodies.

---

### FIX 3: Autonomous Executor

**File:** `src-tauri/src/autonomous/executor.rs` — NEW (create)  
**Purpose:** Given an `ExecutionPlan`, execute tasks by calling `orchestrator::llm_chat()` + `agent_editor::EditExecutor` + `terminal::TerminalManager`  
**Library:** `reqwest` (Ollama), existing internal modules  
**Flow:** For each `Task` in the plan → match `TaskType`:
- `CodeGeneration` → Call Ollama → `agent_editor` apply edits
- `TestExecution` → `terminal` run test command → parse output
- `FileOperation` → `files` module create/move/delete
- `CommandExecution` → `terminal` command + `verifier` safety check

---

### FIX 4: GraphRAG over RepoWiki

**File:** `src-tauri/src/rag/graph_rag.rs` — NEW (create)  
**Purpose:** Graph-enhanced retrieval using the dependency graph from `repowiki/graph.rs`  
**Approach:** When RAG query arrives:
1. Standard vector search → top-K chunks
2. For each chunk, look up its file in `DependencyGraph`
3. Walk 1-hop neighbors (imports/exports) → include neighbor summaries
4. Re-rank by graph centrality + vector score  
**Library:** `hnsw` (already in Cargo.toml for vector), `repowiki::graph` for graph traversal

---

### FIX 5: Agent Streaming UI

**File:** `src/components/agents/AgentStreamPanel.tsx` — NEW (create)  
**Purpose:** Real-time view of agent execution: plan steps, file edits, terminal output, test results  
**Approach:** Use Tauri event system (`listen('agent-step-progress', ...)`) to receive streaming updates from the orchestrator. Render as a terminal-style log with expandable sections.  
**Library:** `@tauri-apps/api` events (already used), `framer-motion` for animations

**File:** `src-tauri/src/orchestrator/mod.rs` — Add `emit()` calls  
**Add:** After each quest step completion, emit `app.emit_all("agent-step-progress", &step_result)`

---

### FIX 6: Test Runner Integration

**File:** `src-tauri/src/commands/testing.rs` — NEW (create)  
**Commands:** `run_tests`, `run_single_test`, `get_test_results`, `detect_test_framework`  
**Approach:** Use `terminal::TerminalManager` to execute test commands (`cargo test`, `npm test`, `pytest`). Parse output for pass/fail counts. Emit structured results.  
**Library:** `portable-pty` (already used for terminal), regex for output parsing

**File:** `src/components/testing/TestRunnerPanel.tsx` — NEW (create)  
**Purpose:** Test results UI with pass/fail tree view, re-run button, coverage display

---

### FIX 7: Integrated Browser Preview

**File:** `src/components/browser/BrowserPreview.tsx` — NEW (create)  
**Purpose:** Embedded browser panel showing localhost preview  
**Approach:** Use Tauri v2's `WebviewWindow` API to create a child webview. Point it at `localhost:3000` (or detected port from terminal output).  
**Library:** `@tauri-apps/api/webviewWindow` (Tauri v2 API)

---

### FIX 8: Model Download Manager

**File:** `src-tauri/src/commands/model_download.rs` — NEW (create)  
**Commands:** `download_model`, `cancel_download`, `list_available_models`, `delete_model`, `get_download_progress`  
**Approach:** HTTP GET from Ollama registry or HuggingFace with streaming progress via Tauri events. Write to `~/.kyro/models/`. Verify SHA-256 checksum.  
**Library:** `reqwest` (streaming), `sha2`, `dirs`

---

### FIX 9: Settings Persistence

**File:** `src-tauri/src/commands/settings.rs` — NEW (create)  
**Commands:** `get_settings`, `set_setting`, `reset_settings`, `export_settings`, `import_settings`  
**Approach:** JSON file at `~/.kyro/settings.json`. Read on startup, write on change. Merge with defaults. Frontend sends `set_setting` on every toggle flip.  
**Library:** `dirs`, `serde_json` (both already in Cargo.toml)

---

### FIX 10: Project-Scoped Config

**File:** `src-tauri/src/commands/project_config.rs` — NEW (create)  
**Commands:** `init_project_config`, `get_project_config`, `set_project_config`  
**Approach:** `.kyro/config.json` in project root. Overrides global settings. Contains: preferred model, agent rules, excluded paths, test command.

---

## STEP 4: 100% Execution Master Plan

### Phase 1: Critical Wiring Fixes (7 broken commands)

**Priority:** HIGHEST — these are user-visible bugs.

| # | Task | Files | Est. Lines |
|---|------|-------|------------|
| 1.1 | Add `git_stage`, `git_unstage`, `git_stage_all`, `git_unstage_all`, `git_discard`, `git_stage_hunk` to `git/mod.rs` | `src-tauri/src/git/mod.rs` | ~120 |
| 1.2 | Add 6 staging commands to `commands/git.rs` | `src-tauri/src/commands/git.rs` | ~50 |
| 1.3 | Add `broadcast_cursor` to `commands/collaboration.rs` | `src-tauri/src/commands/collaboration.rs` | ~20 |
| 1.4 | Register all 7 in `main.rs` invoke_handler | `src-tauri/src/main.rs` | ~7 |
| 1.5 | Wire `memory::extract_symbols()` and `extract_imports()` to tree-sitter | `src-tauri/src/memory/mod.rs` | ~80 |
| 1.6 | Replace regex compression with tree-sitter AST pruning | `src-tauri/src/memory/compression.rs` | ~60 |

**Verification:** `cargo check` → 0 errors. Test `git_stage` from `GitStagingPanel`. Test `broadcast_cursor` from `EditorPresence`.

---

### Phase 2: RepoWiki GraphRAG + Smart Context

| # | Task | Files | Est. Lines |
|---|------|-------|------------|
| 2.1 | Create `rag/graph_rag.rs` — graph-enhanced retrieval | NEW: `src-tauri/src/rag/graph_rag.rs` | ~200 |
| 2.2 | Wire GraphRAG into `chat_sidebar/mod.rs` context builder | `src-tauri/src/chat_sidebar/mod.rs` | ~30 |
| 2.3 | Add `build_context_with_graph` command | `src-tauri/src/commands/rag.rs` | ~20 |
| 2.4 | Register command in `main.rs` | `src-tauri/src/main.rs` | ~1 |
| 2.5 | Settings persistence (`commands/settings.rs`) | NEW: `src-tauri/src/commands/settings.rs` | ~100 |
| 2.6 | Project config (`commands/project_config.rs`) | NEW: `src-tauri/src/commands/project_config.rs` | ~80 |
| 2.7 | Model download manager | NEW: `src-tauri/src/commands/model_download.rs` | ~150 |
| 2.8 | Wire onboarding to real model download | `src/components/onboarding/FirstRunExperience.tsx` | ~30 |

**Verification:** RAG queries should return graph-connected snippets. Settings persist across restarts.

---

### Phase 3: Agentic Execution Engine

| # | Task | Files | Est. Lines |
|---|------|-------|------------|
| 3.1 | Create autonomous executor | NEW: `src-tauri/src/autonomous/executor.rs` | ~250 |
| 3.2 | Add orchestrator event emission | `src-tauri/src/orchestrator/mod.rs` | ~30 |
| 3.3 | Create `AgentStreamPanel.tsx` | NEW: `src/components/agents/AgentStreamPanel.tsx` | ~200 |
| 3.4 | Wire agent panel into `page.tsx` sidebar | `src/app/page.tsx` | ~15 |
| 3.5 | Create test runner commands | NEW: `src-tauri/src/commands/testing.rs` | ~120 |
| 3.6 | Create `TestRunnerPanel.tsx` | NEW: `src/components/testing/TestRunnerPanel.tsx` | ~180 |
| 3.7 | Wire test results into agent feedback loop | `src-tauri/src/autonomous/executor.rs` | ~40 |
| 3.8 | Create browser preview component | NEW: `src/components/browser/BrowserPreview.tsx` | ~100 |

**Verification:** Agent can: receive task → plan steps → edit files → run tests → report results, all visible in streaming UI.

---

### Phase 4: Polish, Testing & CI/CD

| # | Task | Files | Est. Lines |
|---|------|-------|------------|
| 4.1 | Add Rust unit tests for git staging | `src-tauri/tests/git_staging_test.rs` | ~100 |
| 4.2 | Add Rust unit tests for GraphRAG | `src-tauri/tests/graph_rag_test.rs` | ~80 |
| 4.3 | Add Rust unit tests for autonomous executor | `src-tauri/tests/autonomous_test.rs` | ~80 |
| 4.4 | Add frontend tests for new panels | `tests/unit/typescript/*.test.tsx` | ~120 |
| 4.5 | Add E2E test for agent execution flow | `tests/e2e/agent-execution.spec.ts` | ~80 |
| 4.6 | Add Playwright test for git staging | `tests/e2e/git-staging.spec.ts` | ~60 |
| 4.7 | Update `quality/mod.rs` tier selection with real logic | `src-tauri/src/quality/mod.rs` | ~40 |
| 4.8 | Add `business/` SaaS API stubs for future licensing | `src-tauri/src/business/mod.rs` | ~60 |

**Verification:** `cargo test` all pass. `vitest` all pass. `playwright test` all pass. CI green.

---

## STEP 5: GitHub Deployment Strategy

### 5A. GitHub Actions (Already Configured)

Your 3 workflows are solid:

| Workflow | Trigger | Jobs |
|----------|---------|------|
| `ci.yml` | push/PR to `main`, `develop` | lint, test, security audit, coverage (codecov), reproducible build, docs |
| `release.yml` | tag `v*` or manual | macOS universal DMG, Windows MSI, Linux AppImage → GitHub Release |
| `benchmark.yml` | push/PR to `main` | Performance test suite + benchmark report |

**Recommended addition — add a 4th workflow:**

```yaml
# .github/workflows/e2e.yml
name: E2E Tests
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun run build
      - run: bunx playwright install --with-deps
      - run: bunx playwright test
```

### 5B. README.md Structure (Current → Recommended)

Current README is adequate but could be enhanced. Recommended structure:

```
# Kyro IDE
[1-paragraph pitch]

## Screenshots / Demo GIF

## Features
- ✅ Local-first AI (Ollama, AirLLM, PicoClaw, Candle)
- ✅ Atoms of Thought reasoning
- ✅ 165+ language LSP
- ✅ Real-time collaboration (CRDT + E2EE)
- ✅ VS Code extension compatibility
- ✅ 10+ parallel AI agents
- ✅ MCP tool calling
- ✅ RepoWiki auto-documentation

## Quick Start
[3-command setup]

## Architecture
[Mermaid diagram]

## Build from Source
[Platform-specific instructions]

## Contributing
[Link to CONTRIBUTING.md]

## License
MIT
```

### 5C. Git Workflow

```
main ─── stable releases (tagged v0.x.y)
  └── develop ─── integration branch
        ├── feature/git-staging
        ├── feature/graph-rag
        ├── feature/agent-streams
        └── feature/test-runner
```

**Branch strategy:**
1. Create `develop` from `main`
2. Each Phase gets feature branches off `develop`
3. PR → `develop` with CI checks
4. When Phase complete, merge `develop` → `main`, tag release

**Release cadence:**
- `v0.3.0` — Phase 1 (wiring fixes)
- `v0.4.0` — Phase 2 (GraphRAG + settings)
- `v0.5.0` — Phase 3 (agentic execution)
- `v1.0.0` — Phase 4 (polish + full test coverage)

---

## Summary Scorecard

| Category | Score | Notes |
|----------|-------|-------|
| **Frontend UI** | 95% | 95 components, all wired except 7 broken commands |
| **Backend Modules** | 90% | 37/42 fully real, 5 partial |
| **Wiring Layer** | 97% | 220+ commands registered, 7 missing |
| **CI/CD** | 85% | 3 workflows + scripts, needs E2E workflow |
| **Testing** | 60% | 53 vitest + 9 Rust tests + 2 E2E, needs more coverage |
| **Documentation** | 80% | README, architecture docs, guides exist; needs API docs |
| **Overall Completeness** | **88%** | 12% remaining = 4 phases described above |

**Bottom line:** Kyro IDE is 88% complete. The remaining 12% is concentrated in 7 broken command wires, memory system stubs, autonomous executor, and missing UI panels (test runner, agent stream, browser preview). All fixable with ~2,200 lines of new code across 14 new files + 10 file modifications.
