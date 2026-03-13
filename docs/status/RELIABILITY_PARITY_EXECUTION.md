# Reliability + Polish Parity Execution Tracker

_Last updated: 2026-03-13_

## Objective

Reach **production parity** against top IDEs for reliability and polish with:

- 0 lint/type/test failures on required checks
- 0 failing required CI jobs
- 0 open P0/P1 bugs
- Proven stability under heavy workflows

## Definition of Done (Release Gates)

1. **Frontend quality gates pass**
   - `npm run lint`
   - `npm run type-check`
   - `npm test`
2. **Backend quality gates pass**
   - `cargo fmt -- --check`
   - `cargo clippy --workspace --all-targets -- -D warnings`
   - `cargo test --workspace --lib --tests`
3. **Security gate passes**
   - `cargo audit` returns no non-ignored vulnerabilities
4. **Performance & stress gates pass**
   - sustained stability targets for heavy workflows
5. **CI governance**
   - all required checks enforced for merge to `main`

## Current Status Snapshot

- ✅ Frontend lint: passing
- ✅ Frontend type-check: passing
- ✅ Frontend unit tests: 53/53 passing
- ✅ Backend clippy strict mode: passing
- ✅ Security audit: passing with policy exceptions in `.cargo/audit.toml`

## CI Hardening Changes Applied

Updated `.github/workflows/ci.yml` to:

- Add frontend quality job (`lint`, `type-check`, `test`)
- Remove Rust warning suppression (`RUSTFLAGS: -A warnings`)
- Make clippy fail on warnings (`-D warnings`)
- Make `cargo audit` a hard gate (no `continue-on-error`)

Security policy config:

- `src-tauri/.cargo/audit.toml` defines explicit temporary ignores for transitive/unmaintained advisories.

## Security Remediation Status

### Resolved in this pass

- `quinn-proto` upgraded to `0.11.14` (resolves `RUSTSEC-2026-0037`)
- `wasmtime` upgraded to `24.0.6` (addresses prior wasmtime vulnerability advisories)
- `git2` aligned to `0.20` across workspace crates (`src-tauri/Cargo.toml` and `src-tauri/crates/kyro-git/Cargo.toml`)

### Remaining (policy exceptions, tracked)

- GTK3/Tauri transitive advisory chain (unmaintained/unsound notices)
- Other unmaintained transitive advisories (`unic-*`, `paste`, `number_prefix`, `serial`, etc.)

### Completed hardening

- Migrated RAG vector store persistence from `bincode` to `serde_json`
- Removed direct `bincode` dependency from `src-tauri/Cargo.toml`

## Remediation Plan

### Phase A — Immediate (this sprint)

1. Classify remaining advisories:
   - `must-fix` (security/unsound/high)
   - `time-boxed` (unmaintained but low exploitability)

Status: ✅ Completed (see `docs/status/AUDIT_EXCEPTION_REGISTER.md`)

### Phase B — Containment (next sprint)

1. Introduce `audit.toml` policy:
   - temporary, reviewed ignores only for non-exploitable transitive advisories
   - ticket + expiry date required for each ignore
2. Reduce risky optional surface area:
   - remove or gate unused optional crates/features

Status: ✅ Completed for current cycle (`src-tauri/.cargo/audit.toml` + direct `bincode` removal)

### Phase C — Reliability Proof

1. Add heavy workflow test matrix (long sessions, collaboration, large repos)
2. Track weekly trend: pass rate, flaky tests, crash-free sessions
3. Require a 14-day green stabilization window before parity claim

Status: 🟡 Automation completed (`scripts/stability-proof.sh`, `scripts/stability-proof.ps1`, `.github/workflows/stability-proof.yml`); 14-day elapsed-time window pending execution history.

## Owner Checklist

- [x] Fix baseline frontend lint blockers
- [x] Validate local lint/type/test baseline
- [x] Harden CI quality/security gates
- [x] Upgrade vulnerable Rust dependencies
- [x] Add `audit.toml` with documented policy exceptions
- [ ] Run 14-day stabilization period (time-bound)
- [x] Publish parity report
