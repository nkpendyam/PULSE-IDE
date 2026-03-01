# Kyro IDE – Cleanup Candidates

Modules or files that may be obsolete, incomplete, or candidates for removal/refactor. **Review before deleting.**

## Canonical Docs

- **Master plan:** [docs/KYRO_IDE_2026_ENGINEERING_PLAN.md](KYRO_IDE_2026_ENGINEERING_PLAN.md) — single source of truth for 2026 vision, stages, Atoms of Thought, n8n, browser, large models (GLM5, Kimi K2.5).
- Older plans (ENGINEERING_PLAN.md, ENGINEERING_PLAN_V2.md) are historical; refer to the 2026 plan for current direction.

## Incomplete / Experimental (consider archiving)

- `symbolic_verify` — Removed from build (was incomplete).
- `virtual_pico` — Removed from build (was incomplete).
- Some `benchmark` code — Uses deprecated APIs (e.g. TokioRuntime::default); fix or archive.

## Duplicate / Overlapping

- `vscode_compat` vs `extensions` — Two extension surfaces; `vscode_compat` is the canonical Tauri command set; `extensions`/`marketplace` commands were renamed to avoid duplicate `#[tauri::command]` names (`search_extensions_registry`, `get_github_extension_details`, `list_installed_agents`).
- Keep a single UX entry point for “install extension” (e.g. Open VSX via `vscode_compat`).

## Build Errors (fix in Stage 1)

See `cargo check` output. Key areas:

- auth/audit.rs, e2ee/key_exchange.rs
- rag/vector_store.rs, embeddings.rs
- collab/sync.rs, document.rs
- vscode_compat/*, lsp_tower/backend.rs
- p2p/*, AgentStore (e.g. `set_enabled`), yrs API, chrono, tree-sitter, sysinfo, hnsw

## Safe to Remove (after verification)

- Empty or stub source files (confirm no references).
- Duplicate docs that are fully superseded by the 2026 plan (only after team review).
- Unused dev scripts that are not referenced in CI or README.

## Do Not Remove

- `docs/status/archive/*` — Historical status; keep for reference.
- `docs/architecture/*` — Reference architecture; link from 2026 plan where relevant.
