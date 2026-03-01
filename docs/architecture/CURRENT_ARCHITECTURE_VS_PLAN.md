## Kyro IDE Current Architecture vs. Plan (VS Code / Antigravity Model)

### 1. Editor & Shell

- **Plan**: Fork VS Code OSS (Code-OSS) as `apps/desktop` with Electron main process, Chromium workbench, and Node extension host.
- **Current**: Kyro uses **Tauri v2 + WebView** as the desktop shell and a **Next.js + React + Monaco** frontend instead of a raw VS Code fork.
- **Implication**: We already have a VS Code–style UX (Monaco editor, panels, command palette patterns) plus a dedicated `vscode_compat` Rust module that talks to **Open VSX** and manages VS Code extensions. We do **not** need to embed the entire Code-OSS repo; instead we emulate its behaviors on top of Tauri and Monaco.

### 2. Processes & Responsibilities

- **Plan** (VS Code three-process model):
  - Electron **main**: window lifecycle, OS integration.
  - Chromium **renderer**: workbench UI.
  - Node **extension host**: runs extensions in isolation.
- **Current** (Tauri model):
  - **Rust backend (`src-tauri`)**: plays the role of main process, extension host, AI runtime, collaboration engine, and orchestrator.
  - **WebView (Next.js app)**: plays the role of renderer / workbench (tabs, sidebar, panels, status bar).
  - **VS Code compatibility layer (`src-tauri/src/vscode_compat/`)**: provides a pseudo extension host and Open VSX marketplace client inside Rust, rather than a separate Node process.

### 3. AI Runtime & Models

- **Plan**:
  - Separate **AirLLM service** (Python FastAPI) as `services/airllm-service`.
  - Separate **Ollama adapter** and **PicoClaw controller** processes.
  - Kyro Orchestrator routes between these services over HTTP/gRPC.
- **Current**:
  - **Embedded LLM** (`embedded_llm` + `inference` + `llama-cpp` features) for local GGUF models with no Python dependency.
  - **Ollama / LM Studio / vLLM** integration via the Rust `AiService` (HTTP clients) and `commands::ai` module.
  - **PicoClaw** implemented as a pure Rust engine in `src-tauri/src/picoclaw/mod.rs`, exposed via Tauri commands.
  - **AirLLM** is implemented as a **Rust→Python subprocess bridge** (`src-tauri/src/airllm/mod.rs`) instead of a standalone HTTP microservice. This still uses layer-wise inference and supports large GLM / Qwen2.5-class models on 8GB VRAM, but is launched on demand from the backend.

### 4. Agents & Orchestration

- **Plan**:
  - External **Kyro Orchestrator** service (`apps/orchestrator`) that talks to AirLLM, Ollama, PicoClaw, FS, terminal, and browser over RPC.
  - **PicoClaw controller** as a separate Go process for multi-agent scheduling.
- **Current**:
  - **MCP / Swarm / Agent modules** living inside the Rust backend:
    - `src-tauri/src/mcp`, `src-tauri/src/swarm_ai`, `src-tauri/src/agents`, `src-tauri/src/chat_agent`, and `src-tauri/src/chat_sidebar`.
  - **PicoClaw** is embedded directly in Rust (`PicoClawEngine`) and exposed via Tauri commands (`commands::picoclaw`).
  - A logical **orchestrator** is already emerging inside the Rust backend: `AiService` + `swarm_ai` + `MCP` + PicoClaw + RAG (`rag` + `memory`).
  - We will keep the orchestrator **in-process** in Rust instead of a separate Node service, but follow the same responsibilities as the plan: missions, tools, routing, and safety.

### 5. Collaboration & CRDT

- **Plan**:
  - Separate `packages/collab-core` and `apps/collab-server` built on Yjs/Automerge with WebSockets.
- **Current**:
  - **yrs / loro / automerge** already included in `Cargo.toml`.
  - Rust collaboration engine in `src-tauri/src/collab` and `src-tauri/src/git_crdt`, plus WebSocket commands in `commands::websocket`.
  - The backend acts as both the collab server and the CRDT engine for now; we can later factor it into a dedicated collab server if needed, but the core behavior (multi-user CRDT + presence) already lives here.

### 6. Extension & Marketplace

- **Plan**:
  - VS Code workbench + Open VSX integration via Node.
- **Current**:
  - **VS Code compatibility** is implemented natively in Rust:
    - `src-tauri/src/vscode_compat/*` covers extension manifests, runtime, JSON-RPC protocol, and Open VSX marketplace client.
  - Tauri + Next.js render the UI, but the extension lifecycle and marketplace behavior is already aligned with VS Code concepts.

### 7. Packaging & Distribution

- **Plan**:
  - Electron-based installers via `electron-builder`.
  - Bundle orchestrator + model services as background binaries.
- **Current**:
  - **Tauri bundler** handles `.exe`, `.dmg`, and Linux app formats via its config.
  - The Rust backend bundles almost all capabilities (AI, LSP, collab, extensions) into a single static binary per platform, with optional external dependencies (Ollama, AirLLM Python) discovered at runtime.
  - This already satisfies the “very lightweight client + heavy optional model runtimes” constraint, without shipping a full Electron + Node stack.

### 8. Conclusion for Foundation Audit

- Kyro IDE today is a **Tauri + Rust + Next.js AI-native editor** that **emulates VS Code behaviors** (Monaco, extensions, Open VSX, LSP, CRDT) rather than a literal Code-OSS fork.
- For the rest of the plan, we will:
  - Treat the **Rust backend** as the Kyro Orchestrator + extension host.
  - Keep the existing shell + UI as the “Kyro Workbench”.
  - Implement orchestration, missions, and model routing inside Rust modules and commands, instead of spinning up separate Node/Electron processes.

