# Engineering Plan: Overcoming Limitations & Delivering Kyro IDE

## 1. Executive Summary

This plan addresses the critical limitations identified in the project assessment:
1.  **"Zero Cost" Myth**: We replace heavy Python-based AirLLM with **native, statically-linked `llama.cpp`** (via `embedded_llm` module) to run quantized GGUF models efficiently on consumer hardware (8GB+ RAM) without external dependencies or cloud costs.
2.  **"10-Agent Swarm" Complexity**: We simplify the architecture to a **Single Orchestrator with Tool Use** pattern. Instead of 10 always-on agents (massive context overhead), we use one efficient Orchestrator that dynamically loads specialized "skills" (tools) only when needed.
3.  **"Experimental Risk"**: We prioritize **PicoClaw** (lightweight N-gram/Tree-sitter) for latency-sensitive tasks (autocomplete) and **Embedded LLM** for reasoning, removing the fragile Python/AirLLM bridge.
4.  **Performance**: We optimize the **Tauri + Monaco** integration by offloading language services to the Rust backend (`lsp` module) and using shared memory where possible.

## 2. Architecture Overhaul

### 2.1. AI Engine: "Embedded First"
-   **Old Approach**: AirLLM (Python subprocess) + Ollama (External binary).
-   **New Approach**: `embedded_llm` (Rust) with `llama-cpp` bindings.
    -   **Static Linking**: Compile `llama.cpp` directly into the binary. No generic Python install required.
    -   **Quantization**: Default to `Q4_K_M` GGUF models (e.g., `Qwen2.5-Coder-7B`) which run comfortably on 8GB RAM with decent reasoning.
    -   **GPU Offloading**: Auto-detect CUDA/Metal/Vulkan and offload layers natively.

### 2.2. Agent System: "Just-in-Time Skills"
-   **Old Approach**: 10 distinct agents with full context windows.
-   **New Approach**: **Task-Based Orchestrator**.
    -   **Core**: A single `AgentOrchestrator` in Rust.
    -   **Skills**: specialized modules (Git, File Ops, Terminal, Web Search) loaded as *tools* in the prompt context, not separate agents.
    -   **Memory**: Shared `VectorStore` (RAG) for long-term memory, reducing context window pressure.

### 2.3. Editor Core: "Rust-Native LSP"
-   **Frontend**: Monaco Editor (React) for UI only.
-   **Backend**: Rust `lsp` module handles syntax analysis, completions, and diagnostics.
-   **Communication**: Optimized Tauri Commands (binary payloads) instead of heavy JSON serialization for large file updates.

## 3. Implementation Roadmap

### Phase 1: Core Stabilization (Immediate)
-   [x] Audit existing code.
-   [ ] **Refactor `Cargo.toml`**: Enable `llama-cpp` and `local-ai` features by default.
-   [ ] **Deprecate `AirLLM`**: Remove Python dependency from the critical path.
-   [ ] **Verify `embedded_llm`**: Ensure it can load a GGUF model from a local path.

### Phase 2: Agent Simplification
-   [ ] **Refactor `swarm_ai`**: Replace P2P/Multi-agent complexity with a robust `ToolUse` loop.
-   [ ] **Integrate `PicoClaw`**: Connect the lightweight autocomplete to the frontend.

### Phase 3: Performance & Distribution
-   [ ] **CI/CD**: Set up GitHub Actions to build binaries with `llama.cpp` linked.
-   [ ] **Updater**: Configure `tauri-plugin-updater` for signed updates.

## 4. Technical Specifications

### 4.1. Model Selection (Default)
-   **Autocomplete**: `PicoClaw` (N-gram + Tree-sitter) - <50MB RAM.
-   **Chat/Reasoning**: `Qwen2.5-Coder-7B-Instruct-Q4_K_M.gguf` (~4.5GB RAM).
-   **Fallback (Low RAM)**: `Phi-2-2.7B-Q4_K_M` (~2GB RAM).

### 4.2. Data Flow
1.  **User Typing**: -> Monaco -> React State -> Tauri Command (`update_buffer`) -> Rust Rope Buffer.
2.  **Autocomplete**: -> `PicoClaw::suggest` (Rust) -> Frontend (Immediate).
3.  **Chat Request**: -> `AgentOrchestrator` -> `EmbeddedLLM` -> Stream Response -> Frontend.

## 5. Risk Mitigation
-   **Hardware Limits**: The `HardwareTier` detection in `embedded_llm` will strictly enforce model size limits to prevent crashes.
-   **Download Costs**: Models are downloaded *once* and cached. We will provide a "Lite" installer without models and a "Full" installer with models pre-packaged (via sidecar or separate download).

This plan moves Kyro IDE from a "concept" to a "shippable product" by respecting hardware realities and leveraging the efficiency of Rust.
