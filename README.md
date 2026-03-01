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

```bash
# Frontend
bun install
bun run dev

# Backend (from repo root, with Rust toolchain)
cd src-tauri
cargo build
```

See [ROADMAP.md](ROADMAP.md) for version goals and [docs/KYRO_IDE_2026_ENGINEERING_PLAN.md](docs/KYRO_IDE_2026_ENGINEERING_PLAN.md) for the full 2026 engineering plan (VS Code/Antigravity comparison, stages, and open-source stack).

## Repository

- **GitHub:** [nkpendyam/Kyro_IDE](https://github.com/nkpendyam/Kyro_IDE)
- **Docs:** [docs/](docs/) — architecture, guides, and engineering plan.

## License

MIT (see repository for details).
