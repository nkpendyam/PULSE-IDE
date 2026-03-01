# Kyro IDE 2026: Deep Engineering Plan

**Goal:** Build the **lightest AI-native IDE** that competes with **VS Code, Antigravity, and Cursor**—using **only local LLM models and agents**, **Atoms-of-Thought reasoning** (less GPU load, get things done), **AirLLM + browser + Ollama** integrated, and **n8n automation development** with large local models (GLM5, Kimi K2.5, etc.).

---

## Part 0: Core Differentiators (Kyro vs Cursor / Antigravity / VS Code)

| Differentiator | Description |
|---------------|--------------|
| **Local-only AI** | No cloud APIs by default; all inference via Ollama, embedded LLM, AirLLM, PicoClaw. Optional premium API for paid models. |
| **Atoms of Thought (AoT)** | Reasoning decomposed into **atomic, self-contained subquestions** (Markov-style) to reduce GPU memory and redundant computation. Agents use AoT for lighter inference and faster results. |
| **Lightest IDE** | Target &lt;100MB RAM idle; heavy work only in optional model processes. |
| **Integrated browser** | In-app browser for preview, testing, and workflow validation (e.g. n8n runs). |
| **n8n automation development** | Build and edit n8n workflows (JSON) with local LLMs; support large models (GLM5, Kimi K2.5, Qwen2.5) via AirLLM for complex automation logic. |
| **Ollama + AirLLM** | Ollama for daily use; AirLLM for 70B+ class models (GLM5, Kimi K2.5) on 4–8GB VRAM via layer-wise inference. |

---

## Part 1: How VS Code and Antigravity Were Built

### VS Code (from scratch)

- **Stack:** TypeScript, **Electron** (desktop), **Monaco Editor** (editing), multi-process model.
- **Architecture:**
  - **Main process:** Node.js, window lifecycle, OS/FS, menus.
  - **Renderer process:** Chromium, workbench UI (tabs, sidebar, status bar).
  - **Extension Host:** Isolated process for extensions (separate from renderer).
- **Code layout (`src/vs/`):** `base` → `platform` → `editor` (Monaco) → `workbench` → `code` (Electron entry). Targets: `browser`, `node`, `electron-main`, `electron-browser`.
- **Editor:** Monaco uses MVVM (Model = file state, ViewModel = formatting, View = DOM). Selective redraw for performance.
- **Extensions:** VS Code API (`vscode.commands`, `vscode.window`, `vscode.workspace`, `vscode.languages`) + Language Server Protocol (LSP).

### Antigravity (Google’s fork)

- **Base:** Deep **fork of VS Code OSS**, not a thin wrapper.
- **Why fork:** Extension sandbox was too limited for “agent-first” behavior. Google needed:
  - Native Gemini integration as a **system-level primitive**.
  - Agents that can run terminal commands and edit many files **autonomously**.
  - Tighter Google Cloud integration.
- **Concepts:**
  - **Agent Manager View:** “Mission control” for multiple async AI agents.
  - **Artifact-based output:** Diffs, screenshots, test results, task lists instead of only chat.
  - **Vibe coding:** Inline, natural-language editing.
  - **Multi-model:** Gemini, Claude, GPT-OSS, etc. (cloud-focused).

### Kyro’s Position

- **Not a Code-OSS fork.** You use **Tauri + Next.js + Monaco** and emulate VS Code behavior (see `CURRENT_ARCHITECTURE_VS_PLAN.md`).
- **Differentiator:** **Local-first AI** (Ollama, embedded LLM, AirLLM, PicoClaw), **zero subscription**, **unlimited tokens**, **lightweight**, plus agent orchestration and live collab.

---

## Part 2: Kyro IDE 2026 Vision (One-Page)

| Pillar | Target |
|--------|--------|
| **Cross-OS** | Windows, macOS, Linux via Tauri; single binary/installer per platform. |
| **UI/UX parity** | Same features, toggles, and workflows as VS Code / Antigravity (sidebar, command palette, tabs, panels, settings, extensions). |
| **Local AI** | Embedded LLM (llama.cpp/Candle), Ollama, AirLLM (layer-wise for 70B on 4–8GB VRAM), PicoClaw (&lt;10MB). Optional premium API for paid models. |
| **10 AI agents** | Parallel agents controllable via PicoClaw + chat; orchestrator for plan → edit → test → review → deploy. |
| **Languages** | 165+ via LSP + Tree-sitter fallback; Open VSX extensions. |
| **Live collab** | 50+ members, CRDT (Yjs/yrs), E2EE (Signal-style), presence. |
| **Lightweight** | IDE process &lt;100MB RAM idle; heavy use only in LLM/model services. |
| **Atoms of Thought** | Agent reasoning via atomic subquestions to reduce GPU load and get tasks done efficiently. |
| **Browser** | Integrated browser for preview, testing, n8n-style flows. |
| **n8n development** | Create/edit n8n automations using local models (GLM5, Kimi K2.5, etc.). |
| **Large local models** | AirLLM + Ollama for GLM5, Kimi K2.5, Qwen2.5-class models on 4–8GB VRAM. |
| **Auto-update** | Built-in updater; optional auto-download of models based on system config. |
| **Distribution** | .exe, .dmg, AppImage, etc.; “everything in one” after install. |

---

## Part 3: Technology Map (Bleeding-Edge Open Source)

| Area | Technology | Repo / Source |
|------|------------|----------------|
| Desktop shell | Tauri v2 | [tauri-apps/tauri](https://github.com/tauri-apps/tauri) |
| Frontend | Next.js 16, React 19, Monaco | [microsoft/monaco-editor](https://github.com/microsoft/monaco-editor), [vercel/next.js](https://github.com/vercel/next.js) |
| Extensions | Open VSX API | [eclipse/openvsx](https://github.com/eclipse/openvsx), [open-vsx.org](https://open-vsx.org) |
| LSP | tower-lsp, lsp-types | [ebkalderon/tower-lsp](https://github.com/ebkalderon/tower-lsp) |
| CRDT / Collab | Yjs (yrs in Rust) | [y-crdt/y-crdt](https://github.com/y-crdt/y-crdt) |
| Local LLM | llama.cpp, Candle, Ollama API | [ggerganov/llama.cpp](https://github.com/ggerganov/llama.cpp), [huggingface/candle](https://github.com/huggingface/candle), [ollama/ollama](https://github.com/ollama/ollama) |
| Large-model inference | AirLLM (Python) | [lyogavin/airllm](https://github.com/lyogavin/airllm) |
| Lightweight AI | PicoClaw (Go) / in-Rust emulation | [sipeed/picoclaw](https://github.com/sipeed/picoclaw), [Clawland-AI/picclaw](https://github.com/Clawland-AI/picclaw) |
| MCP | Model Context Protocol | MCP spec 2024-11-05 |
| Model discovery | Hugging Face API | [huggingface/huggingface_hub](https://github.com/huggingface/huggingface_hub) |
| E2EE | Signal-style (X3DH, Double Ratchet) | Custom in `e2ee` module |
| Plugins | WASM (wasmtime) | [bytecodealliance/wasmtime](https://github.com/bytecodealliance/wasmtime) |
| Atoms of Thought | AoT-style reasoning (atomic subquestions) | Integrate into agent/orchestrator prompts; refs: [Atom of Thoughts](https://paperswithcode.com/paper/atom-of-thoughts-for-markov-llm-test-time), Atomic Reasoner Framework |
| n8n | Workflow automation | [n8n-io/n8n](https://github.com/n8n-io/n8n); edit workflow JSON with local LLMs; optional embedded runner |
| Large local models | GLM5, Kimi K2.5, Qwen2.5 | Via AirLLM (layer-wise) or Ollama; Hugging Face for download |

---

## Part 4: Stage-by-Stage Implementation Plan

### Stage 1: Stabilize Build and Core (Priority: P0)

- **1.1** Fix all current Rust compilation errors (see “Current issues” below): LSP types, yrs API, chrono, tree-sitter, sysinfo, Hnsw/vector_store, AgentStore API, etc.
- **1.2** Unify extension commands: keep a single set of Tauri commands for extensions (e.g. `vscode_compat` as canonical); avoid duplicate `#[tauri::command]` names (already resolved for `search_extensions`, `install_extension`, `list_agents`, `get_extension_details`).
- **1.3** CI: GitHub Actions for `cargo build` and `cargo test` on Windows, macOS, Linux.
- **1.4** One successful “hello world” run: Tauri app opens, Next.js loads, one Tauri command (e.g. `get_file_tree`) works.

**Deliverables:** Clean `cargo build` and `cargo test`, green CI, runnable app on one platform.

---

### Stage 2: VS Code–Like UX and Editor (P0)

- **2.1** **Layout:** Sidebar (explorer, search, extensions, agent manager), main editor area (tabs + Monaco), bottom panel (terminal, output, problems), status bar. Match VS Code/Antigravity layout and toggles.
- **2.2** **Command palette:** Fuzzy command palette (you have `CommandPalette.tsx`); wire all major actions (open file, run terminal, extensions, agents, settings).
- **2.3** **Settings:** OS-level and app-level settings (themes, font, keybindings, AI backends, Ollama/AirLLM/PicoClaw paths). Persist in app data dir.
- **2.4** **Monaco:** Syntax highlighting, multi-tab, unsaved indicators, basic LSP integration (completion, hover, go-to-def) once LSP layer is fixed.

**Deliverables:** UI that looks and behaves like VS Code (same features/toggles); settings and command palette wired.

---

### Stage 3: LSP and 165+ Languages (P0)

- **3.1** Fix `lsp_real` and `lsp_tower` to current `lsp-types` and `tower-lsp` APIs (SymbolInformation `tags`, etc.).
- **3.2** One LSP per language: spawn rust-analyzer, pyright, tsserver, etc. from Tauri; communicate over stdio/JSON-RPC.
- **3.3** Language selector: detect file type (extension + optional model); auto-start the right LSP. Tree-sitter fallback for languages without LSP.
- **3.4** Scale to 165+ languages: maintain a map (extension → LSP server command or Tree-sitter grammar); document how to add new ones.

**Deliverables:** At least 10 languages working with LSP; path to 165+; Tree-sitter fallback.

---

### Stage 4: Local AI Stack (P0)

- **4.1** **Embedded LLM:** Fix `embedded_llm` (Candle/llama-cpp) and hardware detection; one model (e.g. Phi-2 or small Llama) runs and returns completions.
- **4.2** **Ollama:** Already in `ai` and `swarm_ai`; ensure `check_ollama_status`, `list_models`, and chat/completion use it; optional auto-install or prompt.
- **4.3** **AirLLM:** Keep Python subprocess bridge; add UI for “large model” (70B class) with layer-wise inference; config for VRAM budget and model choice.
- **4.4** **PicoClaw:** Keep in-Rust `PicoClawEngine` for &lt;10MB path; optional external PicoClaw (Go) for advanced scheduling; wire to orchestrator.
- **4.5** **Orchestrator:** Already added; route prompts to embedded / Ollama / AirLLM / PicoClaw by config and capability; mission phases (plan → edit → test → review → deploy).
- **4.6** **Large local models:** Support GLM5, Kimi K2.5, Qwen2.5-class models via AirLLM (layer-wise) or Ollama; document model IDs and VRAM requirements.
- **4.7** **Atoms of Thought (AoT):** In agent/orchestrator prompts, decompose tasks into atomic subquestions; use Markov-style steps to reduce GPU load and redundant context; optional AoT library or prompt templates.

**Deliverables:** At least two backends working (e.g. Ollama + embedded); orchestrator choosing backend; UI to pick model/backend; AoT-style prompts for agents; large-model path (GLM5/Kimi K2.5) documented.

---

### Stage 5: 10 Agents and PicoClaw Control (P1)

- **5.1** Define 10 agent roles (e.g. coder, reviewer, tester, doc, refactor, security, perf, deploy, planner, reviewer-2); each with system prompt and tool set (MCP tools).
- **5.2** **Parallel execution:** Use `ParallelAgentsOrchestrator` (or equivalent) so multiple agents can run concurrently; no single bottleneck; share context via RAG/memory.
- **5.3** **Chat window:** User talks to “controller”; controller delegates to agents; show agent outputs and artifacts (diffs, test results) in UI.
- **5.4** **PicoClaw:** If using external PicoClaw: start/stop, submit tasks, get results over HTTP or stdio; if in-Rust only: same API surface from `PicoClawEngine` and orchestrator.

**Deliverables:** 10 agents registered; parallel execution; chat-driven control; artifact display.

---

### Stage 5.5: Integrated Browser and n8n Automation (P1)

- **5.5.1** **Integrated browser:** Embed a browser view (e.g. WebView or system browser control) for preview, testing, and running n8n or other web tools; same-window or panel.
- **5.5.2** **n8n workflow development:** Support editing n8n workflow JSON (and related files) in the IDE; LSP or schema for n8n workflows; AI (local LLM) to generate or refactor n8n nodes and connections using large models (GLM5, Kimi K2.5) via AirLLM when needed.
- **5.5.3** **Run/debug n8n:** Optional: launch n8n locally (e.g. Docker or npm) and open in integrated browser; or document “export and run in n8n” flow.

**Deliverables:** In-IDE browser; n8n JSON editing and AI-assisted workflow generation with local models.

---

### Stage 6: Open VSX and Extensions (P1)

- **6.1** **Open VSX client:** Use REST API (e.g. [open-vsx.org](https://open-vsx.org)); search, metadata, download .vsix; align with existing `vscode_compat` and `extensions` modules.
- **6.2** **Install/Uninstall:** Install to user data dir; list installed; enable/disable; no duplicate command names (use `vscode_compat` as single surface).
- **6.3** **Extension host (optional):** If you keep a Node extension host, run it as subprocess and proxy VS Code API; otherwise document “WASM plugins only” and rely on Open VSX for discovery + manual run (e.g. LSPs).
- **6.4** **Compatibility:** Document which extensions are “known to work” (e.g. Prettier, ESLint, language packs).

**Deliverables:** Search Open VSX, install/uninstall from UI, list/enable/disable; no duplicate Tauri commands.

---

### Stage 7: Live Collaboration (50+ Members) (P1)

- **7.1** **CRDT:** Fix yrs usage (correct API for encode/decode, `get_string`, etc.); single shared document per workspace or per file.
- **7.2** **Presence:** Cursors, selection, identity; broadcast via WebSocket; 50+ members implies a scalable server (e.g. single server with rooms or Redis pub/sub).
- **7.3** **E2EE:** Finish Signal-style channel (X3DH + Double Ratchet) so only participants see content; server only relays ciphertext.
- **7.4** **Invite/join:** Share room link or token; join with optional E2EE handshake; persistence of membership in app or server.

**Deliverables:** Real-time multi-cursor editing; presence; E2EE option; support for 50+ in a room (with scalable backend).

---

### Stage 8: Lightweight and Packaging (P1)

- **8.1** **RAM:** Profile; keep IDE process &lt;100MB idle; lazy-load heavy features (LSP, RAG, agents).
- **8.2** **Storage:** Don’t bundle models; download on demand; cache in user dir; optional “portable” layout.
- **8.3** **Installers:** Tauri builder: Windows (NSIS/msi), macOS (dmg + notarization), Linux (AppImage/deb). Single .exe/.dmg/.AppImage per channel.
- **8.4** **Auto-update:** Use `tauri-plugin-updater`; delta updates if possible; model list updates from Hugging Face or manifest.

**Deliverables:** Documented RAM target; installers for three OSes; auto-update working.

---

### Stage 9: Autonomous Build / Test / Deploy (P2)

- **9.1** **Single prompt:** “Implement feature X” → orchestrator creates mission → agents plan, edit, test, suggest deploy.
- **9.2** **Artifacts:** Diffs, test results, logs; show in Agent Manager or dedicated panel.
- **9.3** **Approval:** Optional human approval before apply or deploy; integrate with existing approval flow in chat.

**Deliverables:** One end-to-end flow from prompt to artifacts (and optional apply).

---

### Stage 10: i18n and 165+ Languages (UI) (P2)

- **10.1** Use next-intl (or equivalent) for UI strings; ship with top 10–20 locales.
- **10.2** Document how to add more; aim for 165+ UI locales long-term.

**Deliverables:** Localized UI for major locales; process for adding more.

---

## Part 5: Current Issues (Summary and Fix Directions)

These are the main categories of errors in the repo (as of the last full `cargo check`); fixing them is **Stage 1**.

| Category | Examples | Fix direction |
|----------|----------|----------------|
| **LSP / tower-lsp** | `SymbolInformation` missing `tags`; `CustomNotification` not implementing `Notification` | Align with current `lsp-types` and `tower-lsp`; add `tags`; fix or remove custom notifications. |
| **yrs** | `encode_v1`, `get_string`, `Transaction` API | Check yrs changelog and migration; use correct encode/decode and text APIs. |
| **chrono** | `hour()` not found on `DateTime` | Use `chrono` 0.4 API (e.g. `.time()` then `.hour()` or equivalent). |
| **tree-sitter** | `Language` / `LanguageFn` mismatch | Use tree-sitter 0.24 and grammar crates that match (e.g. correct `language()` usage). |
| **sysinfo** | `components()` not found | Update `sysinfo` or use the correct API for GPU/component info. |
| **hnsw / vector_store** | `max_elements`, `Hnsw::new` | Align with current `hnsw` and/or `vector_store` crate APIs. |
| **AgentStore** | `set_enabled` not found | Add `set_enabled` to `AgentStore` or rename command to existing method (e.g. `toggle_agent`). |
| **Async / borrow** | `await` in non-async; multiple borrows; moved values | Add `async` where needed; restructure to avoid holding locks across await; clone or refactor where values are moved. |
| **Serde** | `Serialize`/`Deserialize` for YjsDocument, Instant, etc. | Use newtype wrappers with custom serde or switch to serializable types. |

Systematic approach: fix one module at a time (e.g. `lsp_real` → `git_crdt`/yrs → `collab` → `agent_store` → …), run `cargo check` after each, then re-enable tests.

---

## Part 6: Security and Repo Hygiene

- **GitHub token:** If a personal access token was ever committed or pasted in chat, **revoke it immediately** in GitHub → Settings → Developer settings → Personal access tokens, and create a new one. Never commit tokens.
- **Secrets:** Use env vars or a secrets manager for any API keys (e.g. premium models); document in CONTRIBUTING or README.

---

## Part 7: Success Criteria (2026)

- Runs on Windows, macOS, Linux from one installer per OS.
- UI/UX and feature set comparable to VS Code and Antigravity (same toggles, panels, command palette, settings).
- At least two local AI backends (e.g. Ollama + embedded or AirLLM); orchestrator and 10 agents usable from chat.
- Open VSX: search, install, uninstall, enable/disable extensions.
- Live collab with 50+ members, E2EE option, presence.
- IDE process lightweight (&lt;100MB idle); models and heavy work in separate processes or on-demand.
- One “single prompt → build/test/deploy” flow with artifacts and optional approval.
- **Atoms of Thought** used in agents to reduce GPU load and get tasks done.
- **Integrated browser** and **n8n automation development** with local models (including GLM5, Kimi K2.5).

---

## Part 8: Current Repo Status (as of this plan)

- **Orchestrator:** `orchestrator` module and `missions.rs` are in place; Tauri commands and state are wired in `main.rs`.
- **Duplicate Tauri commands:** Resolved by renaming: `search_extensions_registry`, `install_extension_registry`, `uninstall_extension_registry`, `get_github_extension_details`, `list_installed_agents` (so they do not clash with `vscode_compat` / `mcp`).
- **Build:** The Rust project currently has a large set of pre-existing errors (LSP, yrs, chrono, tree-sitter, sysinfo, AgentStore, etc.). **Stage 1** is to fix these until `cargo build` and `cargo test` pass, then proceed with the stages above.

---

**Document version:** 1.0  
**Last updated:** 2025-03  
**Repo:** [nkpendyam/Kyro_IDE](https://github.com/nkpendyam/Kyro_IDE)
