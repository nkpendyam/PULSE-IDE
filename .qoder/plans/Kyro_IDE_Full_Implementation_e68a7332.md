# Kyro IDE Full Implementation Plan

## Overview
Build a lightweight AI-native IDE matching Qoder's functionality using **only local LLMs** with **Atoms of Thought (AoT)** reasoning for efficient agent execution.

---

## Phase 0: Foundation Stabilization (Week 1-2)

### 0.1 Fix Remaining Rust Compilation Errors
**Files to fix:**
- `src-tauri/src/vscode_compat/mod.rs` - ExtensionHost borrow issues, list_extensions return type
- `src-tauri/src/vscode_compat/openvsx.rs` - namespace clone issues
- `src-tauri/src/vscode_compat/extension_runtime.rs` - stdin mutable borrow
- `src-tauri/src/e2ee/key_exchange.rs` - EphemeralSecret move issues
- `src-tauri/src/embedded_llm/backends.rs` - temporary value dropped
- `src-tauri/src/lsp/smart_selection.rs` - moved value issues
- `src-tauri/src/swarm_ai/kv_cache.rs` - borrow issues
- `src-tauri/src/rag/embeddings.rs` - vocabulary borrow
- `src-tauri/src/git_crdt/yjs_adapter.rs` - partial move

### 0.2 CI/CD Setup
- GitHub Actions for `cargo build` + `cargo test` on Windows/macOS/Linux
- Automated linting and formatting checks

---

## Phase 1: Qoder UI/UX Parity (Week 3-4)

### 1.1 Chat Sidebar with Streaming
**Location:** `src/components/chat/`
- Real-time streaming responses from LLM
- Message history with context preservation
- Code block rendering with syntax highlighting
- Copy/insert code actions
- Chat session persistence

### 1.2 Command Palette (Full Implementation)
**Location:** `src/components/palette/CommandPalette.tsx`
- Fuzzy search (Ctrl+Shift+P)
- Command registration system
- Recent commands
- Keybinding display

### 1.3 Editor Features
**Location:** `src/components/editor/`
- Multi-cursor editing (Ctrl+D)
- Split panes (horizontal/vertical)
- Minimap
- Breadcrumbs navigation
- Sticky scroll

### 1.4 Status Bar Enhancements
**Location:** `src/components/statusbar/StatusBar.tsx`
- LLM status indicator
- Agent activity indicator
- Language/encoding display
- Git branch status

---

## Phase 2: Local LLM Stack (Week 5-7)

### 2.1 Ollama Integration (Primary Backend)
**Location:** `src-tauri/src/ai/mod.rs`
```rust
// Already partially implemented
// Enhance with:
- Model hot-swapping
- Streaming responses via SSE
- Context window management
- Token counting
```

### 2.2 AirLLM Integration (70B+ Models on 4-8GB VRAM)
**Location:** `src-tauri/src/airllm/mod.rs` + `services/airllm-service/`
- Python subprocess bridge for layer-wise inference
- Support for: GLM5, Kimi K2.5, Qwen2.5
- VRAM budget configuration
- Model download from Hugging Face

### 2.3 Embedded LLM (llama.cpp/Candle)
**Location:** `src-tauri/src/embedded_llm/`
- Fix current implementation issues
- Static linking for zero-dependency deployment
- Hardware detection (CUDA/Metal/Vulkan/CPU)
- Model loading/unloading

### 2.4 PicoClaw Integration (<10MB Agents)
**Location:** `src-tauri/src/picoclaw/mod.rs`
- Lightweight agent runtime
- Task scheduling
- Resource-constrained execution

### 2.5 LLM Orchestrator
**Location:** `src-tauri/src/orchestrator/mod.rs`
- Route requests to appropriate backend based on:
  - Model size requirements
  - Available VRAM
  - Task complexity
- Fallback chain: Embedded → Ollama → AirLLM

---

## Phase 3: Atoms of Thought (AoT) Integration (Week 8-9)

### 3.1 AoT Reasoning Engine
**New file:** `src-tauri/src/aot/mod.rs`
```rust
pub struct AtomOfThought {
    pub question: String,
    pub context: Vec<String>,
    pub dependencies: Vec<AtomId>,
    pub result: Option<String>,
}

pub struct AoTReasoner {
    atoms: HashMap<AtomId, AtomOfThought>,
    execution_graph: DAG,
}

impl AoTReasoner {
    // Decompose complex task into atomic subquestions
    pub fn decompose(&mut self, task: &str) -> Vec<AtomOfThought>;
    
    // Execute atoms in dependency order (Markov-style)
    pub async fn execute(&mut self, llm: &dyn LLMBackend) -> Result<String>;
    
    // Prune redundant context between atoms
    pub fn optimize_context(&mut self);
}
```

### 3.2 AoT Prompt Templates
**New file:** `src-tauri/src/aot/prompts.rs`
- Task decomposition prompts
- Atomic question templates
- Result synthesis prompts
- Context compression strategies

### 3.3 Agent Integration
- Modify all 10 agents to use AoT reasoning
- Reduce GPU memory per inference
- Enable parallel atom execution

---

## Phase 4: 10 AI Agents System (Week 10-12)

### 4.1 Agent Definitions
**Location:** `src-tauri/src/agents/`

| Agent | Role | Tools |
|-------|------|-------|
| Planner | Task decomposition | file_read, search |
| Coder | Code generation | file_write, lsp |
| Reviewer | Code review | diff, lint |
| Tester | Test generation | terminal, test_runner |
| Debugger | Bug fixing | debugger, logs |
| Refactorer | Code improvement | ast, lsp |
| Documenter | Documentation | file_write |
| Security | Vulnerability scan | security_tools |
| Performance | Optimization | profiler |
| Deployer | CI/CD | git, terminal |

### 4.2 Parallel Execution Orchestrator
**Location:** `src-tauri/src/swarm_ai/orchestrator.rs`
- Mission phases: Plan → Edit → Test → Review → Deploy
- Concurrent agent execution
- Shared context via RAG
- Result aggregation

### 4.3 Agent Manager UI
**Location:** `src/components/agent-manager/`
- Agent status dashboard
- Task queue visualization
- Artifact display (diffs, test results)
- Manual intervention controls

### 4.4 MCP (Model Context Protocol) Tools
**Location:** `src-tauri/src/mcp/`
- File operations
- Terminal execution
- LSP integration
- Git operations
- Web search (optional)

---

## Phase 5: Code Actions & Completions (Week 13-14)

### 5.1 Ghost Text Autocomplete
**Location:** `src/components/editor/GhostText.tsx`
- Multi-line suggestions
- Tab to accept
- Partial acceptance
- Context-aware completions

### 5.2 Inline Chat (Ctrl+K)
**Location:** `src/components/editor/InlineChat.tsx`
- In-place code editing via prompt
- Diff preview before apply
- Undo support

### 5.3 Code Actions
- Explain code
- Refactor selection
- Generate tests
- Fix errors
- Add documentation

### 5.4 Real LSP Integration
**Location:** `src-tauri/src/lsp/`
- stdio/socket transport
- Semantic completions
- Go to definition (real)
- Find references (real)
- Rename symbol (real)

---

## Phase 6: Collaboration & Advanced Features (Week 15-16)

### 6.1 Real-time Collaboration
**Location:** `src-tauri/src/collaboration/`
- Fix yrs (Yjs) CRDT integration
- WebSocket sync
- Shared cursors/selections
- 50+ member support

### 6.2 E2E Encryption
**Location:** `src-tauri/src/e2ee/`
- Fix Signal protocol implementation
- X3DH key exchange
- Double Ratchet messaging

### 6.3 Integrated Browser
- WebView for preview
- n8n workflow testing
- Documentation viewing

---

## Key Files Summary

| Area | Primary Files |
|------|--------------|
| Chat UI | `src/components/chat/AIChatPanel.tsx`, `StreamingChat.tsx` |
| LLM Backend | `src-tauri/src/ai/mod.rs`, `embedded_llm/`, `airllm/` |
| AoT Engine | `src-tauri/src/aot/mod.rs` (new) |
| Agents | `src-tauri/src/agents/`, `swarm_ai/` |
| Orchestrator | `src-tauri/src/orchestrator/mod.rs` |
| LSP | `src-tauri/src/lsp/`, `lsp_tower/` |
| Collaboration | `src-tauri/src/collaboration/`, `e2ee/` |

---

## Success Metrics

- [ ] `cargo build` passes with no errors
- [ ] IDE starts in < 1.5s
- [ ] Memory usage < 200MB idle
- [ ] Chat with streaming responses working
- [ ] 10 agents executable in parallel
- [ ] AoT reduces inference time by 30%+
- [ ] Ghost text completions functional
- [ ] Inline chat (Ctrl+K) working
- [ ] At least 10 languages with real LSP

---

## Immediate Next Steps

1. **Fix remaining 40+ compilation errors** (Phase 0)
2. **Implement AoT reasoning engine** (new module)
3. **Wire streaming chat to Ollama**
4. **Build agent orchestrator with AoT**
5. **Commit and push after each milestone**
