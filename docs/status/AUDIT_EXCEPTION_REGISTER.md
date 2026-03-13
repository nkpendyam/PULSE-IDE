# Audit Exception Register

_Last updated: 2026-03-13_

This register tracks advisory exceptions currently allowed via `src-tauri/.cargo/audit.toml`.
Each exception is classified and must have an owner and expiration/review target.

## Must-Fix (remove by migration/upgrade)

| Advisory | Current Source | Rationale | Target Action | Review By |
|---|---|---|---|---|
| RUSTSEC-2024-0429 (`glib` unsound) | GTK3/Tauri transitive chain | Unsound advisory in legacy gtk-rs 0.18 stack | Upgrade ecosystem path to GTK4-capable dependency chain when available in Tauri stack | 2026-06-30 |
| RUSTSEC-2025-0141 (`bincode`) | Removed direct dependency | No longer direct; ensure not reintroduced transitively | Keep blocked in dependency review; migrate any future use to serde_json/postcard | 2026-04-15 |

## Time-Boxed (non-exploitable/transitive, monitor)

| Advisory | Class | Current Source | Rationale | Exit Criteria | Review By |
|---|---|---|---|---|---|
| RUSTSEC-2017-0008 | unmaintained | `serial` via `portable-pty` | Transitive; no maintained drop-in yet in current stack | Replace PTY dep chain when stable option validated | 2026-05-31 |
| RUSTSEC-2023-0089 | unmaintained | `atomic-polyfill` transitive | No known active exploit path in this app context | Upstream replacement lands | 2026-05-31 |
| RUSTSEC-2024-0370 | unmaintained | `proc-macro-error` transitive | Build-time macro dependency only | Upstream migration to maintained alternative | 2026-05-31 |
| RUSTSEC-2024-0411..0420 | unmaintained GTK3 set | Tauri/wry Linux GTK3 chain | Ecosystem-level unmaintained notice | Upstream GTK4 migration in dependency chain | 2026-06-30 |
| RUSTSEC-2024-0436 | unmaintained | `paste` transitive | No known exploit in runtime path | Upstream move to maintained macro helper | 2026-05-31 |
| RUSTSEC-2025-0057 | unmaintained | `fxhash` transitive | Transitive utility crate | Upstream switch to `rustc-hash`/alternative | 2026-05-31 |
| RUSTSEC-2025-0075 | unmaintained | `unic-char-range` via `tauri-utils/urlpattern` | Transitive, parser utility path | Upstream replacement in tauri-utils | 2026-06-30 |
| RUSTSEC-2025-0080 | unmaintained | `unic-common` via `tauri-utils/urlpattern` | Transitive, parser utility path | Upstream replacement in tauri-utils | 2026-06-30 |
| RUSTSEC-2025-0081 | unmaintained | `unic-char-property` via `tauri-utils/urlpattern` | Transitive, parser utility path | Upstream replacement in tauri-utils | 2026-06-30 |
| RUSTSEC-2025-0098 | unmaintained | `unic-ucd-version` via `tauri-utils/urlpattern` | Transitive, parser utility path | Upstream replacement in tauri-utils | 2026-06-30 |
| RUSTSEC-2025-0100 | unmaintained | `unic-ucd-ident` via `tauri-utils/urlpattern` | Transitive, parser utility path | Upstream replacement in tauri-utils | 2026-06-30 |
| RUSTSEC-2025-0119 | unmaintained | `number_prefix` transitive | Utility/developer-facing output dependency | Upstream replacement | 2026-05-31 |

## Policy

- Exceptions are temporary and must be reviewed on or before `Review By`.
- Any newly introduced direct dependency with advisory status is blocked.
- Security gate remains strict for vulnerabilities; only documented non-vulnerability advisories are excepted.
