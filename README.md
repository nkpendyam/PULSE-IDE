# Kyro IDE

**The lightest AI-native IDE.** Competes with **VS Code, Antigravity, and Cursor** using **only local LLM models and agents**—with **Atoms-of-Thought reasoning** (less GPU load, get things done), **AirLLM + browser + Ollama** integrated, and **n8n automation development** (GLM5, Kimi K2.5, and other large local models).

## Highlights

- **Local-only AI:** No cloud by default. [Ollama](https://ollama.ai), embedded LLM, [AirLLM](https://github.com/lyogavin/airllm) (70B on 4–8GB VRAM), [PicoClaw](https://github.com/sipeed/picoclaw)—optional premium API.
- **Atoms of Thought:** Agents reason in atomic subquestions to cut GPU use and deliver results efficiently.
- **Lightest IDE:** Target &lt;100MB RAM idle; heavy work in optional model processes.
- **Integrated browser:** In-app browser for preview, testing, and n8n-style flows.
- **n8n automations:** Build and edit [n8n](https://n8n.io) workflows with local LLMs; large models (GLM5, Kimi K2.5, Qwen2.5) via AirLLM.
- **Cross-OS:** Windows, macOS, Linux via [Tauri](https://tauri.app/) (Rust backend + web frontend).
- **Agents:** Up to 10 parallel AI agents; orchestrator for plan → edit → test → review → deploy; chat + PicoClaw control.
- **Extensions:** [Open VSX](https://open-vsx.org); VS Code–compatible discovery and install.
- **Collaboration:** Real-time CRDT (Yjs/yrs), E2EE option, 50+ members.

## Editor Architecture

- **Single editor abstraction:** `CodeEditor` is the canonical editor surface (Monaco, LSP bridge, ghost text, inline chat widget, minimap controls).
- **Single theme system:** `ThemeProvider` + `lib/themeSystem` own app theme and Monaco theme registration/application.
- **Single file operations layer:** UI components route file read/write/tree/create/rename/delete via `lib/fileOperations`.
- **Single extensions UI:** Sidebar extensions view is powered by `UnifiedMarketplace`.
- **Accessibility baseline:** Global `AccessibilityProvider` + skip link are mounted in `layout.tsx`.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Desktop | Tauri v2 |
| Frontend | Next.js 16, React 19, Monaco Editor, Tailwind, shadcn/ui |
| Backend | Rust (LSP, CRDT, MCP, agents, embedded LLM, AirLLM bridge, PicoClaw) |
| AI | Ollama, Candle/llama.cpp, AirLLM (Python), PicoClaw; GLM5/Kimi K2.5 via AirLLM |
| Reasoning | Atoms-of-Thought (AoT) in agents |
| Browser / n8n | Integrated browser; n8n workflow editing with local LLMs |
| Extensions | Open VSX registry API |
| Collab | Yjs (yrs), WebSocket, E2EE (Signal-style) |

## Quick Start

```powershell
# Windows 10/11 (PowerShell)
./scripts/setup.ps1
./scripts/check-all.ps1
bun run tauri:dev
```

```bash
# macOS / Linux
bun install
bun run build
bun run tauri:dev
```

Production build:

```powershell
bun run tauri:build
```

Windows installer build (recommended):

```powershell
.\scripts\build-windows.ps1
```

This generates a standard setup `.exe` at `src-tauri/target/release/bundle/nsis/` with desktop/start menu shortcuts and `kyro` terminal launcher support.

See [docs/status/ROADMAP.md](docs/status/ROADMAP.md) for version goals and [docs/KYRO_IDE_2026_ENGINEERING_PLAN.md](docs/KYRO_IDE_2026_ENGINEERING_PLAN.md) for the full 2026 engineering plan (VS Code/Antigravity comparison, stages, and open-source stack).

For production-ready local setup and platform dependencies, see [docs/INSTALLATION.md](docs/INSTALLATION.md).

## Repository

- **GitHub:** [nkpendyam/Kyro_IDE](https://github.com/nkpendyam/Kyro_IDE)
- **Docs:** [docs/](docs/) — architecture, guides, and engineering plan.

## License

MIT (see repository for details).
