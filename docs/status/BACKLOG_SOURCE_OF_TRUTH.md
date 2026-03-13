# Kyro IDE Backlog Source of Truth

**Last Updated:** 2026-03-13  
**Owner:** Core Engineering  
**Scope:** Active, auditable backlog replacing conflicting status claims in legacy docs.

---

## 0) Governance Rules

- This file is the **single authoritative backlog** for execution sequencing.
- Legacy status docs may contain historical claims and are not execution truth.
- Any item marked complete requires objective evidence:
  - code merged,
  - tests/validation logs,
  - docs updated.

Canonical references:
- [Project audit baseline](PROJECT_AUDIT_2026-03-13.md)
- [Competitive gap analysis](../IDE_GAP_ANALYSIS_2026.md)
- [Audit exception register](AUDIT_EXCEPTION_REGISTER.md)

---

## 1) Baseline Metrics (from latest audit)

- Open checkboxes in docs: **238**
- `fixme_tests` gated test blocks in `src-tauri/src/**`: **68**
- Backend TODO/FIXME markers: **6**
- Workflow files: **4**

These numbers are the initial debt baseline for burn-down tracking.

---

## 2) Phase A — Build/Release Substrate (In Progress)

### Completed
- [x] Hardened release workflow for macOS/Windows/Linux artifact handling.
- [x] Added cross-platform bundle verification workflow (`cross-platform-bundles.yml`).

### Remaining
- [ ] Execute cross-platform bundle workflow on PR and manual dispatch; capture artifact proof.
- [ ] Add release gate requiring expected bundle matrix before tag release.
- [ ] Add notarization/code-sign verification checklist outputs to release notes.

---

## 3) Phase B — Truthful Status + TODO Governance (Current)

- [x] Publish detailed repo-wide audit report.
- [x] Create this single source-of-truth backlog.
- [ ] Normalize top 50 high-impact open checklist items from docs into issue-ready tasks.
- [ ] Add owner + ETA + evidence links for each in-scope item.
- [ ] Deprecate contradictory “100% complete” status declarations in legacy docs.

---

## 4) Phase C — Competitive Parity Core (Priority)

Derived from `IDE_GAP_ANALYSIS_2026.md` and capability audit.

### Agentic UX
- [ ] Autopilot mode with approval policy levels.
- [ ] Conversation checkpoints + revert.
- [ ] Conversation forking UX.

### AI Editing
- [ ] Inline edit diff panel (`Ctrl+K`) with accept/reject.
- [ ] Edit prediction improvements with pluggable providers.

### Context/Mentions
- [x] `@file`, `@folder`, `@codebase`, `@terminal`, `@git`, `@web` mention resolver.
  - Implemented in chat with mention parsing, context enrichment, inline preview chips, keyboard navigation/removal.
  - `@web` currently resolves to explicit local-mode fallback notice (no remote web fetch execution yet).

### Terminal AI
- [ ] Explain/fix terminal error actions and command suggestion flow.

### Extension Compatibility
- [ ] Deepen VS Code API compatibility coverage and extension capability fallbacks.

---

## 5) Phase D — Reliability/Quality Hardening

- [ ] Reduce `fixme_tests` count from 68 to <= 20.
- [ ] Convert critical integration expectations into always-on tests.
- [ ] Add deterministic remote workflow tests (connect/exec/file transfer).
- [ ] Add performance gate for startup/memory targets with CI artifacts.
- [ ] Track and retire security exceptions per target date in `AUDIT_EXCEPTION_REGISTER.md`.

---

## 6) Phase E — Differentiation to Win

- [ ] Local-first AI controls (model selector, token/temperature UX, policy guardrails).
- [ ] Collaboration maturity (presence, reliability, recovery).
- [ ] Remote development UX polish and enterprise-grade guardrails.
- [ ] Deployment/release polish (trusted installers, update reliability, docs).

---

## 7) This Week Execution Slice

- [ ] Run bundle verification workflow and publish artifact matrix in docs/status.
- [ ] Open 10 issue-ready parity tasks from Phase C with acceptance criteria.
- [ ] Land first parity implementation (mentions resolver or checkpointing).
- [ ] Start `fixme_tests` burn-down by enabling first module group.

---

## 8) Definition of “IDE Competitive Ready”

Only claim readiness when all are true:
- [ ] Cross-platform installers produced and verified each release.
- [ ] Core parity tasks in Phase C complete with passing tests.
- [ ] `fixme_tests` reduced to near-zero for core workflows.
- [ ] Security exception register has no overdue items.
- [ ] User-journey acceptance tests pass for edit/build/debug/extension/remote/collab.
