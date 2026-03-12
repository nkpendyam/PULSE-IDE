# Kyro IDE — 2026 Competitive Gap Analysis

**Date**: March 12, 2026  
**Compared Against**: VS Code 1.111, Cursor 2.6, Windsurf (Codeium), Zed 0.218+, JetBrains Fleet/AI Assistant

---

## Executive Summary

Kyro IDE has **200+ backend commands, 30+ UI components, and 40+ core modules** — a genuinely impressive foundation for a local-first, AI-native IDE. However, compared to competitors shipping weekly in 2026, there are **53 concrete gaps** across 10 categories that separate Kyro from feature parity with the current IDE landscape.

**Kyro's Unique Strengths** (no competitor matches all of these):
- Embedded local LLM (Ollama/Phi/Qwen) — fully offline AI
- CRDT collaboration with E2E encryption (Signal Protocol)
- Graph-enhanced RAG (RepoWiki + knowledge graphs)
- Agent swarms with MCP tool dispatch
- Zero external service dependency
- Free & open source

---

## GAP ANALYSIS BY CATEGORY

### 🔴 CRITICAL GAPS (Competitors all have these — users expect them)

---

#### 1. AI AGENT AUTONOMY & AGENTIC MODE

| Feature | VS Code | Cursor | Windsurf | Zed | Kyro |
|---------|---------|--------|----------|-----|------|
| **Autopilot / full-auto agent mode** | ✅ Autopilot (1.111) | ✅ Agent mode | ✅ Cascade Code | ✅ Agent Panel | ❌ Missing |
| **Permission levels** (default/bypass/auto) | ✅ 3 levels | ✅ Autonomy slider | ✅ Auto-continue | ❌ | ❌ Missing |
| **Cloud/background agents** | ✅ Copilot Agents | ✅ Cloud Agents | ✅ Simultaneous Cascades | ✅ Background agents | ❌ Missing |
| **Agent plans & todo lists** | ✅ Plan agent | ✅ Composer plans | ✅ Built-in planning agent | ❌ | ⚠️ Partial (executor only) |
| **Named checkpoints & revert** | ❌ | ✅ Checkpoint | ✅ Named checkpoints | ❌ | ❌ Missing |
| **Conversation forking** | ✅ /fork command | ❌ | ❌ | ❌ | ❌ Missing |
| **Agent-scoped hooks** (pre/post processing) | ✅ .agent.md hooks | ❌ | ❌ | ❌ | ❌ Missing |

**What to build:**
- [ ] `AgentAutopilotMode` — let the orchestrator run to completion without user confirmation at each step
- [ ] `PermissionLevels` component — Default / Bypass Approvals / Autopilot toggle in chat panel
- [ ] `ConversationCheckpoints` — snapshot/revert codebase state at any chat turn
- [ ] `ConversationForking` — branch a chat to explore different approaches

---

#### 2. EDIT PREDICTION / NEXT-ACTION COMPLETION

| Feature | VS Code | Cursor | Windsurf | Zed | Kyro |
|---------|---------|--------|----------|-----|------|
| **Next-edit prediction** (Tab) | ✅ Copilot NES | ✅ Tab (proprietary RL model) | ✅ Supercomplete | ✅ Zeta/Mercury/Sweep/Ollama | ❌ Missing |
| **Multi-line edit suggestions** | ✅ | ✅ Multi-line + cross-file | ✅ | ✅ | ❌ Missing |
| **Pluggable prediction providers** | ✅ Copilot | ❌ Cursor-only | ❌ Codeium-only | ✅ 6 providers | ❌ Missing |
| **In-session context awareness** | ✅ | ✅ Sees recent changes | ✅ Real-time awareness | ✅ | ❌ Missing |

**What to build:**
- [ ] `EditPrediction` system — predict the next edit based on cursor position + recent changes, show as ghost text diff
- [ ] Pluggable provider architecture (Ollama local, cloud API optional)
- [ ] Tab-to-accept UX in Monaco editor

---

#### 3. INLINE EDITING (Cmd+K / Ctrl+K)

| Feature | VS Code | Cursor | Windsurf | Zed | Kyro |
|---------|---------|--------|----------|-----|------|
| **Inline edit** (select → prompt → apply) | ✅ Copilot inline | ✅ Cmd+K | ✅ Ctrl+K | ✅ Inline Assistant | ⚠️ Basic ghost text only |
| **Diff preview before accept** | ✅ | ✅ | ✅ | ✅ | ❌ Missing |
| **Multi-file inline edits** | ❌ | ✅ | ✅ | ❌ | ❌ Missing |

**What to build:**
- [ ] `InlineEditPanel` — select code → type prompt → see diff preview → accept/reject
- [ ] Keyboard shortcut: `Ctrl+K` to trigger
- [ ] Diff-style preview (red/green) in Monaco overlay

---

#### 4. CODE REVIEW (AI-Powered PR Review)

| Feature | VS Code | Cursor | Windsurf | Zed | Kyro |
|---------|---------|--------|----------|-----|------|
| **AI code review bot** | ✅ Copilot Code Review | ✅ Bugbot (autofix) | ❌ | ❌ | ⚠️ Has AI review command but no PR integration |
| **PR diff review** | ✅ GitHub PR extension | ✅ Built-in | ❌ | ❌ | ❌ Missing |
| **Auto-fix suggestions in review** | ✅ | ✅ Bugbot Autofix | ❌ | ❌ | ❌ Missing |

**What to build:**
- [ ] `PRReviewPanel` — show PR diffs with AI-generated review comments
- [ ] Integration with GitHub/GitLab APIs for PR fetching
- [ ] One-click apply fix from review comment

---

#### 5. WEB SEARCH IN CHAT

| Feature | VS Code | Cursor | Windsurf | Zed | Kyro |
|---------|---------|--------|----------|-----|------|
| **Web search from chat** | ✅ @web | ✅ @web | ✅ Web Search tool | ❌ | ❌ Missing |
| **URL fetching as context** | ✅ | ✅ @url | ✅ | ❌ | ❌ Missing |
| **Documentation lookup** | ✅ @docs | ✅ @docs | ✅ | ❌ | ❌ Missing |

**What to build:**
- [ ] `WebSearchTool` — MCP tool + Tauri command to search the web and inject results into LLM context
- [ ] `@web` and `@url` mentions in chat input
- [ ] `@docs` for fetching library documentation

---

### 🟡 IMPORTANT GAPS (Most competitors have these — power users notice)

---

#### 6. TERMINAL AI INTEGRATION

| Feature | VS Code | Cursor | Windsurf | Zed | Kyro |
|---------|---------|--------|----------|-----|------|
| **AI terminal commands** | ✅ Copilot CLI | ✅ Terminal agent | ✅ Terminal tool calling | ❌ | ❌ Missing |
| **Terminal output as context** | ✅ #terminalLastCommand | ✅ | ✅ Auto-reads output | ❌ | ❌ Missing |
| **Explain terminal errors** | ✅ | ✅ | ✅ Explain & Fix | ❌ | ❌ Missing |
| **Run commands from chat** | ✅ Agent runs in terminal | ✅ | ✅ | ✅ | ⚠️ Executor only |

**What to build:**
- [ ] `TerminalAI` — context menu "Explain error" / "Fix this" on terminal output
- [ ] Send terminal output to chat as context with `@terminal`
- [ ] Agent writes + executes commands in terminal with approval

---

#### 7. MEMORIES & RULES (Persistent AI Context)

| Feature | VS Code | Cursor | Windsurf | Zed | Kyro |
|---------|---------|--------|----------|-----|------|
| **Project rules** (.cursorrules / .windsurfrules) | ✅ .github/copilot-instructions.md | ✅ .cursorrules | ✅ .windsurfrules + Memories | ✅ .rules files | ❌ Missing |
| **Auto-learned memories** | ❌ | ❌ | ✅ Cascade Memories | ❌ | ❌ Missing |
| **Global user preferences** | ✅ Settings sync | ✅ Profile | ✅ Global rules | ✅ Settings file | ⚠️ Settings only, no AI rules |
| **Per-workspace AI context** | ✅ | ✅ | ✅ | ✅ | ❌ Missing |

**What to build:**
- [ ] `.kyrorules` file support — load project-specific AI instructions
- [ ] `MemorySystem` — auto-learn from conversations (like Windsurf)
- [ ] Global + per-project AI context injection before every LLM call

---

#### 8. DEV CONTAINERS & REMOTE DEVELOPMENT

| Feature | VS Code | Cursor | Windsurf | Zed | Kyro |
|---------|---------|--------|----------|-----|------|
| **Dev Containers** | ✅ Full support | ✅ (VS Code compatible) | ✅ | ✅ v0.218+ | ❌ Missing |
| **SSH Remote** | ✅ Remote-SSH | ✅ | ✅ | ✅ SSH Remoting | ❌ Missing |
| **WSL** | ✅ | ✅ | ✅ | ❌ | ❌ Missing |
| **Codespaces / cloud dev** | ✅ GitHub Codespaces | ❌ | ❌ | ❌ | ❌ Missing |

**What to build:**
- [ ] `DevContainers` — detect `.devcontainer/devcontainer.json`, launch Docker, connect
- [ ] `SSHRemote` — connect to remote machine, run LSP/editor backend there
- [ ] WSL integration for Windows users

---

#### 9. VOICE INPUT

| Feature | VS Code | Cursor | Windsurf | Zed | Kyro |
|---------|---------|--------|----------|-----|------|
| **Voice-to-text in chat** | ✅ VS Code Speech | ❌ | ✅ Cascade voice input | ❌ | ❌ Missing |
| **Voice commands** | ✅ | ❌ | ⚠️ Transcription only | ❌ | ❌ Missing |

**What to build:**
- [ ] `VoiceInput` — microphone button in chat panel, use Whisper or system speech-to-text
- [ ] Voice-to-command for palette actions

---

#### 10. APP DEPLOYMENT FROM IDE

| Feature | VS Code | Cursor | Windsurf | Zed | Kyro |
|---------|---------|--------|----------|-----|------|
| **One-click deploy** | ✅ Azure extension | ❌ | ✅ App Deploys | ❌ | ❌ Missing |
| **Deploy preview** | ✅ | ❌ | ✅ | ❌ | ❌ Missing |

**What to build:**
- [ ] `DeployPanel` — simple deploy to Vercel/Netlify/Docker with progress tracking

---

### 🟢 NICE-TO-HAVE GAPS (Some competitors have — differentiators)

---

#### 11. MCP APPS (Interactive UI in Chat)

| Feature | VS Code | Cursor | Windsurf | Zed | Kyro |
|---------|---------|--------|----------|-----|------|
| **Charts/diagrams in chat** | ❌ | ✅ MCP Apps (Amplitude, Figma, tldraw) | ❌ | ❌ | ❌ Missing |
| **Interactive whiteboards** | ❌ | ✅ tldraw plugin | ❌ | ❌ | ❌ Missing |

---

#### 12. PLUGIN / EXTENSION MARKETPLACE

| Feature | VS Code | Cursor | Windsurf | Zed | Kyro |
|---------|---------|--------|----------|-----|------|
| **Team plugin marketplace** | ❌ | ✅ Team Marketplaces (2.6) | ❌ | ❌ | ❌ Missing |
| **Plugin marketplace** | ✅ 50k+ | ✅ Cursor Marketplace | ❌ | ✅ Zed Extensions | ⚠️ OpenVSX only |
| **Workflows / automations** | ❌ | ✅ Automations | ✅ Workflows | ❌ | ❌ Missing |

---

#### 13. SPLIT DIFF VIEW (Git)

| Feature | VS Code | Cursor | Windsurf | Zed | Kyro |
|---------|---------|--------|----------|-----|------|
| **Side-by-side diff** | ✅ | ✅ | ✅ | ✅ Split Diffs (Feb 2026) | ⚠️ Inline only |
| **3-way merge** | ✅ | ❌ | ❌ | ❌ | ❌ Missing |

---

#### 14. SETTINGS UI

| Feature | VS Code | Cursor | Windsurf | Zed | Kyro |
|---------|---------|--------|----------|-----|------|
| **Visual settings editor** | ✅ Full GUI | ✅ | ✅ | ✅ Settings Editor (Dec 2025) | ⚠️ Basic panel |
| **Settings search** | ✅ | ✅ | ✅ | ✅ | ❌ Missing |
| **Settings sync** | ✅ | ✅ | ❌ | ❌ | ❌ Missing |

---

#### 15. THEME BUILDER

| Feature | VS Code | Cursor | Windsurf | Zed | Kyro |
|---------|---------|--------|----------|-----|------|
| **Visual theme builder** | ❌ | ❌ | ❌ | ✅ Theme Builder (Feb 2026) | ❌ Missing |
| **Icon themes** | ✅ | ✅ | ✅ | ✅ Icon Themes | ❌ Missing |
| **Theme count** | 50k+ | 1k+ | 50+ | 200+ | 3 |

---

#### 16. RAINBOW BRACKETS

| Feature | VS Code | Cursor | Windsurf | Zed | Kyro |
|---------|---------|--------|----------|-----|------|
| **Rainbow brackets** | ✅ Built-in | ✅ | ✅ | ✅ (Dec 2025) | ⚠️ Basic bracket colorization |

---

#### 17. LINTER INTEGRATION IN CHAT

| Feature | VS Code | Cursor | Windsurf | Zed | Kyro |
|---------|---------|--------|----------|-----|------|
| **Auto-fix lint errors from AI** | ✅ | ✅ | ✅ Auto-fix (free credits) | ❌ | ❌ Missing |
| **Send problems to chat** | ✅ #problems | ✅ | ✅ Send to Cascade | ❌ | ❌ Missing |
| **Diagnostics panel → AI fix** | ✅ | ✅ | ✅ Explain & Fix | ✅ Quick fixes | ❌ Missing |

---

#### 18. @ MENTIONS (Context System)

| Feature | VS Code | Cursor | Windsurf | Zed | Kyro |
|---------|---------|--------|----------|-----|------|
| **@file** | ✅ | ✅ | ✅ | ✅ /file | ❌ Missing |
| **@folder** | ✅ | ✅ | ✅ | ❌ | ❌ Missing |
| **@codebase** | ✅ | ✅ | ✅ | ❌ | ❌ Missing |
| **@terminal** | ✅ | ✅ | ✅ | ❌ | ❌ Missing |
| **@web** | ✅ | ✅ | ✅ | ❌ | ❌ Missing |
| **@git** | ✅ | ✅ | ❌ | ❌ | ❌ Missing |
| **@previousConversation** | ❌ | ❌ | ✅ | ❌ | ❌ Missing |

**What to build:**
- [ ] `@-mention system` — parse `@file`, `@folder`, `@codebase`, `@terminal`, `@web`, `@git` in chat and inject relevant context

---

#### 19. ARENA MODE (Model Comparison)

| Feature | VS Code | Cursor | Windsurf | Zed | Kyro |
|---------|---------|--------|----------|-----|------|
| **Arena / side-by-side model comparison** | ❌ | ❌ | ✅ Arena Mode | ❌ | ❌ Missing |

---

#### 20. REPL / NOTEBOOK SUPPORT

| Feature | VS Code | Cursor | Windsurf | Zed | Kyro |
|---------|---------|--------|----------|-----|------|
| **Jupyter notebooks** | ✅ | ✅ | ✅ | ✅ REPL | ❌ Missing |
| **Inline code execution** | ✅ | ✅ | ✅ | ✅ | ❌ Missing |

---

## MISSING TOGGLES & SETTINGS

These are specific settings/toggles that competitor IDEs expose and Kyro does not:

| Toggle / Setting | Available In | Kyro Status |
|-----------------|--------------|-------------|
| `editor.stickyScroll.enabled` | VS Code, Zed | ⚠️ Hardcoded on |
| `editor.bracketPairColorization.enabled` | VS Code, Zed | ⚠️ Hardcoded on |
| `editor.inlineSuggest.enabled` | VS Code, Cursor | ❌ No toggle |
| `editor.formatOnPaste` | VS Code, JetBrains | ❌ Missing |
| `editor.linkedEditing` (auto-rename tags) | VS Code | ❌ Missing |
| `editor.guides.indentation` | VS Code, Zed | ❌ Missing |
| `editor.guides.bracketPairs` | VS Code | ❌ Missing |
| `editor.cursorSmoothCaret` | VS Code, Zed | ❌ Missing |
| `editor.smoothScrolling` | VS Code, Zed | ❌ Missing |
| `editor.renderWhitespace` | VS Code, Zed | ❌ Missing |
| `editor.rulers` (column guides) | VS Code, Zed | ❌ Missing |
| `editor.wordWrapColumn` | VS Code | ❌ Missing |
| `workbench.editor.wrapTabs` | VS Code | ❌ Missing |
| `workbench.editor.enablePreview` (preview tabs) | VS Code, Zed | ❌ Missing |
| `workbench.colorTheme` sync | VS Code | ❌ Missing |
| `zenMode` toggle | VS Code, JetBrains | ❌ Missing |
| `focusMode` (distraction-free) | JetBrains, Zed | ❌ Missing |
| `files.autoSaveDelay` (configurable delay) | VS Code | ⚠️ Fixed value |
| `terminal.integrated.fontSize` expose in UI | VS Code | ⚠️ No UI control |
| `AI model selector` in chat | VS Code, Cursor, Windsurf, Zed | ❌ Missing |
| `AI temperature` control | Cursor | ❌ Missing |
| `AI max tokens` control | Cursor | ❌ Missing |
| `codeActions on save` | VS Code, JetBrains | ❌ Missing |
| `auto-import` on completion | VS Code, JetBrains | ❌ Missing |
| `emmet.enabled` | VS Code | ❌ Missing |
| `git.autofetch` toggle | VS Code | ❌ Missing |
| `diffEditor.renderSideBySide` | VS Code | ❌ Missing |
| `search.smartCase` | Zed | ❌ Missing |

---

## MISSING COMPONENTS (UI Panels / Views)

| Component | Available In | Priority |
|-----------|-------------|----------|
| **Inline Edit Panel** (Cmd+K) | Cursor, Windsurf, Zed | 🔴 Critical |
| **Agent Autopilot Controls** | VS Code 1.111, Cursor | 🔴 Critical |
| **Checkpoint/Revert Timeline** | Windsurf, Cursor | 🔴 Critical |
| **@ Mention Autocomplete** | VS Code, Cursor, Windsurf | 🔴 Critical |
| **Model Selector Dropdown** | All competitors | 🟡 Important |
| **Split Diff Viewer** | VS Code, Zed | 🟡 Important |
| **Merge Conflict Editor** (3-way) | VS Code, JetBrains | 🟡 Important |
| **Settings Search** | VS Code, Cursor, Zed | 🟡 Important |
| **Problems → AI Fix button** | Windsurf, VS Code | 🟡 Important |
| **Voice Input Button** | Windsurf, VS Code | 🟢 Nice |
| **Theme Builder** | Zed | 🟢 Nice |
| **Deploy Panel** | Windsurf | 🟢 Nice |
| **REPL / Notebook View** | VS Code, Zed | 🟢 Nice |
| **Arena Mode** (compare models) | Windsurf | 🟢 Nice |
| **Call Hierarchy View** | VS Code, JetBrains | 🟢 Nice |
| **Type Hierarchy View** | VS Code, JetBrains | 🟢 Nice |

---

## PRIORITIZED IMPLEMENTATION ROADMAP

### Phase 1 — Table Stakes (4 items, highest impact)
1. **Edit Prediction** — Tab-to-accept next-edit suggestions using Ollama
2. **@ Mention System** — `@file`, `@codebase`, `@terminal` context injection
3. **Inline Edit (Ctrl+K)** — select → prompt → diff preview → accept
4. **Agent Autopilot Mode** — orchestrator runs without manual confirmation

### Phase 2 — Competitive Parity (5 items)
5. **Conversation Checkpoints** — snapshot/revert at any turn
6. **Project Rules** (`.kyrorules`) — persistent AI context per project  
7. **Terminal AI** — explain errors, send output to chat
8. **Model Selector** — dropdown in chat to pick model
9. **Missing Settings Toggles** — expose 15+ Monaco/editor toggles in Settings UI

### Phase 3 — Differentiation (5 items)
10. **Web Search in Chat** — `@web` / `@url` for real-time information
11. **Voice Input** — Whisper-based speech-to-text in chat
12. **Split Diff Viewer** — side-by-side git diff like Zed
13. **Linter → AI Fix** — "Send to AI" button on diagnostics
14. **Dev Containers** — Docker-based reproducible environments

### Phase 4 — Polish (6 items)  
15. **AI Auto-learned Memories** (Windsurf-style)
16. **Arena Mode** — compare two models side-by-side
17. **REPL / Notebook** support
18. **Theme Builder** — visual theme creation
19. **Deploy Panel** — one-click deploy
20. **SSH Remote Development**

---

## SUMMARY SCORECARD

| Category | Kyro Score | Leader | Gap Size |
|----------|-----------|--------|----------|
| **Core Editing** | 9/10 | VS Code | Small |
| **AI Chat & Completion** | 7/10 | Cursor | Medium |
| **Agent Autonomy** | 4/10 | VS Code/Cursor | **Large** |
| **Edit Prediction** | 1/10 | Cursor/Zed | **Critical** |
| **Inline Editing** | 3/10 | Cursor | **Large** |
| **Git Integration** | 8/10 | JetBrains | Small |
| **Collaboration** | 9/10 | Kyro (leader!) | None |
| **Extensions** | 7/10 | VS Code | Medium |
| **Debugging** | 7/10 | Zed/VS Code | Small |
| **Context System (@mentions)** | 2/10 | Cursor/Windsurf | **Critical** |
| **Remote / Containers** | 0/10 | VS Code | **Critical** |
| **Settings & Customization** | 6/10 | VS Code | Medium |
| **Offline / Privacy** | 10/10 | Kyro (leader!) | None |

**Overall: 73/130 → 56%** competitive parity with 2026 leaders.  
Implementing Phase 1+2 would bring this to **~80%**.

---

*Generated by comprehensive analysis of VS Code 1.111, Cursor 2.6, Windsurf Cascade, Zed 0.218+, and JetBrains Fleet/AI Assistant feature sets as of March 2026.*
