# Kyro Product Blueprint 2026

## Executive Verdict

Kyro can survive in the 2026 IDE market, but not as a general replacement for VS Code, Cursor, or Zed in its current state.

It is strongest as a local-first, privacy-first, AI-native desktop IDE for developers who value offline models, Rust/Tauri packaging, and built-in collaboration more than maximum extension compatibility.

The current codebase has a real product core:

- Next.js + React shell with a working editor workbench
- Tauri + Rust backend with broad command coverage
- Real git, terminal, file system, search, debug, and LSP surfaces
- Early but meaningful AI, RAG, MCP, CRDT, and security architecture

The current product is blocked by productization gaps rather than a missing foundation.

## What Is Real Today

### Product core

- Main workbench shell in `src/app/page.tsx`
- Global state in `src/store/kyroStore.ts`
- Monaco-based editing in `src/components/editor`
- File tree, search, git, status bar, breadcrumbs, settings, terminal, debug, and chat panels in `src/components`

### Backend core

- Tauri command registration in `src-tauri/src/main.rs`
- Rust command surfaces in `src-tauri/src/commands`
- Git integration in `src-tauri/src/git`
- Terminal PTY integration in `src-tauri/src/terminal`
- LSP and parsing infrastructure in `src-tauri/src/lsp`, `src-tauri/src/lsp_transport`, and `src-tauri/crates/kyro-lsp`
- Collaboration/security architecture in `src-tauri/src/collab`, `src-tauri/src/git_crdt`, `src-tauri/src/e2ee`, and `src-tauri/src/trust`

### Release/build baseline

- Cross-platform CI in `.github/workflows/ci.yml`
- Tagged release workflow in `.github/workflows/release.yml`
- Tauri packaging in `src-tauri/tauri.conf.json`

## What Is Weak Or Not Product-Ready

### Product truth and documentation

- `docs/status/PROJECT_STATUS.md` claims `v1.0.0` and `100%` completion while the live repo is `0.2.0`
- Gap docs, roadmap docs, and status docs disagree about what is complete

### Security and release engineering

- `src-tauri/tauri.conf.json` still allows `unsafe-inline` and `unsafe-eval`
- Update plumbing exists in dependencies but is not wired as a signed Tauri updater flow
- Release workflow builds artifacts but does not show code signing or notarization

### Product gaps users will feel immediately

- Remote development UI exists, but `remote_connect` and `remote_disconnect` are not present in the Rust command surface
- Internal extensions point to `./extension.js` manifests without corresponding runtime implementation
- The update panel uses custom placeholder commands instead of the official updater path
- Some advanced AI/autopilot surfaces are UI-level scaffolding rather than a finished operator experience

## Verified Evidence

- `next.config.ts` sets `typescript.ignoreBuildErrors = true`
- `src-tauri/tauri.conf.json` uses a permissive CSP with `unsafe-inline` and `unsafe-eval`
- `src/components/remote/RemoteDevContainers.tsx` invokes `remote_connect` and `remote_disconnect`
- `internal-extensions/kyro-agents/package.json` points to `./extension.js`
- `src/components/update/UpdatePanel.tsx` talks to custom update commands
- `src-tauri/src/commands/update.rs` explicitly notes that real download/install is not implemented there

## Market Positioning That Can Work

Kyro should not chase "all developers, all workflows" in the short term.

The viable wedge is:

- Local-first AI IDE
- Privacy-sensitive teams and solo developers
- Rust/TypeScript developers
- Users who want built-in collaboration and agent tooling without mandatory cloud dependency

In that position, Kyro competes more credibly with Continue + VS Code, OpenHands local GUI, and privacy-focused developer tooling than with full enterprise VS Code parity.

## Recommended Product Strategy

### Strategic choice

Do not fork VS Code or attempt to clone the entire VS Code platform.

Keep the current Tauri + Rust + Next/Monaco architecture, then harden and narrow the product until it is excellent in one lane.

### Lane to own

"The best free local AI desktop IDE for offline/private coding workflows."

### Features to treat as differentiators

- Local model support
- MCP-native workflows
- Built-in repo knowledge and RAG
- Privacy-first collaboration and trust controls

### Features to treat as table stakes

- Stable editing
- Build/test/debug loop
- Search/replace
- Git diff/review
- Extension compatibility through Open VSX where possible
- Reliable updates/installers

## Open Source Blueprint

### 1. Editor/platform lessons from VS Code and VSCodium

Use the VS Code and VSCodium model for product discipline, not codebase cloning.

- Keep one authoritative product metadata source, similar to `product.json` style distribution practices
- Ship frequent stable releases and package-manager installs
- Lean on Open VSX for extension legality and ecosystem reach

Useful references:

- VS Code OSS: https://github.com/microsoft/vscode
- VSCodium: https://github.com/VSCodium/vscodium
- Open VSX: https://open-vsx.org/

### 2. AI/agent lessons from Continue and OpenHands

Use Continue and OpenHands for agent workflow patterns rather than trying to invent everything.

- Continue contributes source-controlled AI checks and repo-local rules/check definitions
- OpenHands contributes stronger agent lifecycle, local GUI expectations, and cloud/local split thinking

Useful references:

- Continue: https://github.com/continuedev/continue
- OpenHands: https://github.com/OpenHands/OpenHands

### 3. Dev environment standard

Adopt the Dev Container spec rather than building a custom remote model first.

- Support `.devcontainer/devcontainer.json`
- Start with local Docker-backed containers before SSH/WSL orchestration

Useful reference:

- Dev Containers specification: https://containers.dev/

### 4. Distribution and updates

Use Tauri's signed updater artifacts and GitHub Releases as the first free delivery backend.

- Generate updater artifacts and signatures
- Host static update JSON on GitHub Releases or a CDN later
- Add code signing as soon as distribution credibility matters

Useful reference:

- Tauri updater: https://v2.tauri.app/plugin/updater/

## Implementation Plan

### Phase 1. Truth and hardening

- Reconcile all status docs and version declarations
- Remove `typescript.ignoreBuildErrors`
- tighten CSP in `src-tauri/tauri.conf.json`
- make CI fail on real build/test/security failures instead of masking them

### Phase 2. Daily-driver baseline

- finish update flow with signed Tauri updater integration
- finish remote/devcontainer story using the standard Dev Container spec
- replace placeholder internal extensions with working extension code or remove them
- add project rules and persistent AI memory surfaces
- tighten debugger, test runner, and browser-preview workflow

### Phase 3. AI product differentiation

- build a real agent run view with plan, approvals, logs, diffs, and test results
- add checkpoint/revert linked to git and file snapshots
- add terminal AI loop and error-to-fix workflow
- add repo rules plus memory injection into every AI call

### Phase 4. Free productization

- GitHub Releases for binaries
- package-manager distribution on winget, scoop, homebrew, and AppImage/deb
- Open VSX-backed marketplace
- opt-in telemetry and crash reporting
- reproducible builds and published checksums

## Priority Backlog

### P0

- remove fake status claims
- unify versioning across root, frontend, and Rust
- remove hidden build failures
- wire real updater path
- harden CSP

### P1

- real devcontainers workflow
- real project rules and memory
- real agent execution stream and checkpoints
- stronger test/debug/build loop UX

### P2

- package-manager distribution
- signed releases and notarization
- stronger extension compatibility
- hosted collaboration or optional cloud relay

## Non-Goals For The Next 6 Months

- full VS Code extension parity
- all-language enterprise IDE parity
- full cloud IDE
- full JetBrains-grade refactoring depth

## Success Criteria

Kyro is ready to be promoted as a serious free/open product when all of the following are true:

- `main` builds cleanly without ignored TypeScript errors
- cross-platform signed installers are produced from CI
- updater works end-to-end with signed artifacts
- docs reflect actual product state
- remote/devcontainer flow works for at least one mainstream stack
- AI/autopilot surfaces are honest, observable, and recoverable
- the repo has a credible wedge: local/private AI development

## Bottom Line

Kyro should be built forward from its current architecture, not restarted and not rewritten as a VS Code clone.

If the team focuses on truth, hardening, release discipline, and one strong market wedge, the project can become a viable free product.

If the team keeps optimizing for breadth and status claims over shipping quality, it will remain an impressive demo rather than a market-surviving IDE.