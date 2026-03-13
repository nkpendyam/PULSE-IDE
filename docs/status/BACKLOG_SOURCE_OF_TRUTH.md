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
- [x] Open 10 issue-ready parity tasks from Phase C with acceptance criteria.
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

---

## 9) Issue-Ready Top 10 (Phase C Seed)

Each task includes owner, ETA target, acceptance criteria, and evidence expectation.

### C-01 Autopilot Approval Levels
- **Owner:** AI Platform
- **ETA:** 2026-03-27
- **Acceptance Criteria:**
  - Implement `ask`, `safe-auto`, `full-auto` policy levels.
  - Gate file edits, terminal commands, and installs per selected policy.
  - Persist policy in settings and surface in UI.
- **Evidence:** merged code + policy tests + UI screenshot.

### C-02 Checkpoint Revert UX Completion
- **Owner:** Editor UX
- **ETA:** 2026-03-24
- **Acceptance Criteria:**
  - Restore checkpoint applies file snapshots deterministically.
  - Failed restore reports actionable error and partial-apply summary.
  - Add unit tests for checkpoint restore edge cases.
- **Evidence:** tests + demo recording + changelog note.

### C-03 Conversation Forking UX
- **Owner:** Chat UX
- **ETA:** 2026-04-03
- **Acceptance Criteria:**
  - Fork from any historical message.
  - Fork maintains independent message timeline and checkpoint lineage.
  - Fork switch UI supports clear current-branch indicator.
- **Evidence:** state tests + UI screenshots.

### C-04 Inline Diff Panel Parity (`Ctrl+K`)
- **Owner:** AI Editing
- **ETA:** 2026-04-10
- **Acceptance Criteria:**
  - Show inline proposed edits as diff blocks.
  - Accept/reject at hunk and full-change granularity.
  - Apply operations preserve cursor and undo stack behavior.
- **Evidence:** integration tests + before/after clip.

### C-05 Edit Prediction Provider Hardening
- **Owner:** Editor Intelligence
- **ETA:** 2026-04-10
- **Acceptance Criteria:**
  - Support pluggable prediction provider interface.
  - Fallback heuristic remains available offline.
  - Add confidence calibration metrics and telemetry hooks.
- **Evidence:** provider tests + metrics sample output.

### C-06 Terminal AI Explain/Fix Parity Finalization
- **Owner:** Terminal UX
- **ETA:** 2026-03-21
- **Acceptance Criteria:**
  - Terminal AI detects errors from live output.
  - `Run Fix` uses risk guardrails and post-run analysis.
  - History row supports retry + copy summary.
- **Evidence:** feature demo + type/lint checks + docs update.

### C-07 Terminal Fix Guardrail Expansion
- **Owner:** Security + Terminal UX
- **ETA:** 2026-03-28
- **Acceptance Criteria:**
  - Add configurable denylist/allowlist policy for terminal fix commands.
  - High-risk execution requires explicit double confirmation.
  - Audit log entry recorded for executed fix commands.
- **Evidence:** policy tests + sample audit log.

### C-08 VS Code API Fallback Coverage (Tier 1)
- **Owner:** Extension Runtime
- **ETA:** 2026-04-17
- **Acceptance Criteria:**
  - Document unsupported API surface and fallback behavior.
  - Add compatibility stubs for top failing extension APIs.
  - Marketplace UI surfaces compatibility warnings before install.
- **Evidence:** compatibility matrix + extension smoke tests.

### C-09 Mention Resolver `@web` Real Backend
- **Owner:** Chat Context
- **ETA:** 2026-04-03
- **Acceptance Criteria:**
  - Replace local-mode fallback with optional web context retrieval path.
  - Add feature flag and offline fallback to existing behavior.
  - Add tests for resolved vs fallback flows.
- **Evidence:** tests + runtime config docs.

### C-10 Phase C E2E Journey Test Pack
- **Owner:** QA Automation
- **ETA:** 2026-04-24
- **Acceptance Criteria:**
  - Add journey tests for mentions, terminal explain/fix, and inline diff approval.
  - Run in CI on PR with artifact outputs.
  - Failures include reproducible diagnostics.
- **Evidence:** CI workflow links + test artifacts.
