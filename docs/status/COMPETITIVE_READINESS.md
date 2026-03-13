# Kyro IDE Competitive Readiness

Last updated: 2026-03-13

## Short answer

Kyro can compete in a focused lane today, but not yet on full ecosystem parity.

Kyro is already competitive when the user values:
- local-first AI
- Tauri/Rust desktop footprint
- built-in collaboration and presence
- Open VSX-based extensibility
- Windows-first scripted validation and build reliability

Kyro is not yet fully competitive where the market leaders still have clear advantages:
- extension ecosystem depth and compatibility breadth
- mature remote/SSH/devcontainer workflows end-to-end
- AI context tooling breadth (`@docs`, robust `@web`, problem panel to AI, PR review)
- notebook/REPL support
- polished settings/search/sync depth across all subsystems
- battle-tested autopilot safety, approvals, and long-running background agents

## Current status by area

| Area | Status | Notes |
|------|--------|-------|
| Core editor shell | Strong | Unified `CodeEditor`, ghost text, inline chat widget, minimap controls |
| LSP/editor intelligence | Strong | Current Rust `lsp_*` bridge wired and tested |
| Theme/accessibility | Strong | Global provider wiring in app layout |
| File operations | Strong | Routed through `lib/fileOperations` |
| Extensions UI | Moderate | Unified marketplace exists; ecosystem maturity still trails VS Code/Cursor |
| Collaboration | Moderate | Presence and collaboration surfaces exist; needs broader production hardening |
| Agent/autopilot | Moderate | Panels and permission modes exist; not yet top-tier autonomous workflow parity |
| Terminal AI | Moderate | Error explanation and send-to-chat exist |
| Settings UX | Improved | Searchable settings implemented |
| Remote/dev containers | Partial | UI exists; parity with VS Code Remote stack is not proven |
| PR/code review AI | Weak | No full PR review workflow surfaced in UI |
| Web/docs retrieval in chat | Partial | mention scaffolding exists; end-to-end tool flow still needs hardening |
| Notebook/REPL | Weak | not a parity feature today |

## Highest-priority remaining gaps

1. Make AI context mentions fully operational end-to-end: `@file`, `@folder`, `@codebase`, `@terminal`, `@web`, `@git`, `@docs`.
2. Add a production-ready PR review panel with AI comments and fix application.
3. Harden remote/devcontainer workflows beyond UI presence into validated execution flows.
4. Add notebook or REPL-style execution support for parity with mainstream IDEs.
5. Expand extension/runtime compatibility testing and document supported extension classes.
6. Tighten `ts-prune` and Rust `udeps` cleanup so status docs match actual shipped surface area.

## Honest conclusion

Kyro is no longer just a mockup or speculative IDE shell. It has a credible core and some differentiated strengths. But it is not honest to call the project “100% complete” or claim total parity with the strongest 2026 IDEs yet.

The practical target should be:
- competitive for local-first AI development workflows now
- production-ready for a narrower early-adopter audience
- steadily closing parity gaps through focused batches, not blanket “complete” claims
