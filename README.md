# Kyro IDE

**The AI-native IDE built for 2026.** Competes with **VS Code, Cursor, Windsurf, and Zed** using **local-first AI models and swarm agents**—zero cloud required.

## ✨ What's New in 0.2.0

- 🎙️ **Voice Input** — speak to your AI assistant (Web Speech API, zero dependencies)
- 🚀 **Deploy Panel** — one-click deploy to Vercel, Netlify, Docker, or GitHub Pages
- ⚔️ **Arena Mode** — compare two AI models side-by-side (vote for the best response)
- 📓 **Notebook / REPL** — Jupyter-style interactive cells (JS, TS, Python, Bash)
- 🎨 **Theme Builder** — create and export custom color themes with live preview
- 🔴 **Problems Panel** — VS Code-style diagnostics with AI-Fix button
- 🔀 **Merge Conflict Editor** — 3-way merge conflict resolution
- 🔍 **Settings Search** — filter settings in real-time
- ⚙️ **25+ Editor Toggles** — smooth scrolling, format-on-paste, Zen mode, linked editing, and more

## Highlights

- **Local-only AI:** No cloud by default. [Ollama](https://ollama.ai), embedded LLM, [AirLLM](https://github.com/lyogavin/airllm) (70B on 4–8GB VRAM), [PicoClaw](https://github.com/sipeed/picoclaw)—optional premium API.
- **Atoms of Thought:** Agents reason in atomic subquestions to cut GPU use and deliver results efficiently.
- **Voice-to-Code:** Speak your prompt, AI generates the code.
- **Arena Mode:** Compare multiple local models simultaneously—choose the best one for your workflow.
- **One-click Deploy:** Deploy to Vercel, Netlify, Docker, or GitHub Pages from inside the IDE.
- **Integrated browser:** In-app browser for preview and testing.
- **Cross-OS:** Windows, macOS, Linux via [Tauri](https://tauri.app/) (Rust backend + web frontend).
- **Agents:** Up to 10 parallel AI agents; orchestrator for plan → edit → test → review → deploy.
- **Extensions:** [Open VSX](https://open-vsx.org); VS Code–compatible discovery and install.
- **Collaboration:** Real-time CRDT (Yjs/yrs), E2EE option, 50+ members.

## Feature Matrix (vs 2026 IDEs)

| Feature | Kyro IDE | VS Code | Cursor | Windsurf |
|---------|----------|---------|--------|----------|
| AI Chat (Inline) | ✅ | ✅ (Copilot) | ✅ | ✅ |
| Tab Completion | ✅ | ✅ | ✅ | ✅ |
| Voice Input | ✅ | ❌ | ❌ | ❌ |
| Local LLM (no cloud) | ✅ | ❌ | ❌ | ❌ |
| Arena Mode | ✅ | ❌ | ❌ | ❌ |
| Notebook/REPL | ✅ | ✅ (ext) | ❌ | ❌ |
| Deploy Panel | ✅ | ❌ | ❌ | ❌ |
| Theme Builder | ✅ | ✅ (ext) | ❌ | ❌ |
| Merge Conflict UI | ✅ | ✅ | ✅ | ✅ |
| RAG over Codebase | ✅ | ❌ | ✅ | ✅ |
| Agent Swarm | ✅ | ❌ | ❌ | ❌ |
| E2EE Collaboration | ✅ | ❌ | ❌ | ❌ |

## Tech Stack

| Layer | Technology |
|-------|------------|
| Desktop | Tauri v2 |
| Frontend | Next.js 16, React 19, Monaco Editor, Tailwind, shadcn/ui |
| Backend | Rust (LSP, CRDT, MCP, agents, embedded LLM, AirLLM bridge, PicoClaw) |
| AI | Ollama, Candle/llama.cpp, AirLLM (Python), PicoClaw; GLM5/Kimi K2.5 via AirLLM |
| Reasoning | Atoms-of-Thought (AoT) in agents |
| Browser | Integrated in-app browser preview |
| Extensions | Open VSX registry API |
| Collab | Yjs (yrs), WebSocket, E2EE (Signal-style) |

## Quick Start

```bash
# Install dependencies
npm install

# Development (web preview)
npm run dev

# Build frontend
npm run build

# Desktop app (requires Rust toolchain)
npm run tauri:dev    # development
npm run tauri:build  # production build
```

### Prerequisites

- **Node.js 18+** or **Bun**
- **Rust 1.75+** (for desktop app)
- **Ollama** (optional, for local AI): `curl -fsSL https://ollama.ai/install.sh | sh`

## Panels & Features

### AI Assistant
- `Ctrl+L` — Open AI Chat sidebar
- `Ctrl+K` — Inline edit (select code, ask AI to modify)
- `Ctrl+I` — Agent Autopilot (autonomous multi-file edits)
- `@file`, `@codebase`, `@web`, `@terminal`, `@git` — context injection in chat
- 🎙️ Voice button in chat sidebar

### Code Editor
- Monaco Editor with 25+ configurable options
- LSP support for 20+ languages
- Tab-to-accept ghost text completions
- Breadcrumbs & symbol outline
- Side-by-side diff viewer
- 3-way merge conflict editor

### Source Control
- Git staging panel
- Inline diff with hunk-level staging
- Merge conflict resolution UI
- CRDT-based real-time collaboration

### Deploy
- One-click deploy: Vercel, Netlify, Docker, GitHub Pages
- Build configuration (command, output dir)
- Recent deployments history

### AI Tools
- **Arena Mode**: Compare two models side-by-side with voting
- **RAG Search**: Semantic codebase search
- **Agent Stream**: Watch agents work in real-time
- **Model Selector**: Switch between local models
- **Hardware Info**: VRAM/RAM usage per model tier

### Productivity
- **Notebook/REPL**: Interactive cells (JS, Python, Bash)
- **Test Runner**: Run tests with AI-generated coverage
- **Browser Preview**: Live in-app preview
- **Remote Containers**: Dev Containers / Docker support

## Repository

- **GitHub:** [nkpendyam/Kyro_IDE](https://github.com/nkpendyam/Kyro_IDE)
- **Docs:** [docs/](docs/) — architecture, guides, and engineering plan.

## License

MIT (see repository for details).
