# Kyro IDE Organization

This document describes the project organization and GitHub configuration.

## 📁 Repository Structure

```
Kyro_IDE/
├── .github/                    # GitHub configuration
│   ├── workflows/              # GitHub Actions
│   │   ├── ci.yml             # CI pipeline (lint, build, test)
│   │   └── release.yml        # Release automation
│   ├── ISSUE_TEMPLATE/         # Issue templates
│   │   ├── bug_report.md
│   │   ├── feature_request.md
│   │   └── question.md
│   └── FUNDING.yml            # GitHub Sponsors
│
├── docs/                       # Documentation
│   └── API.md                  # API documentation
│
├── kyro-desktop/               # Desktop app components
│   ├── agents/                 # Python AI agents
│   ├── model-proxy/            # Rust model proxy
│   ├── runtime/                # Rust runtime kernel
│   ├── ui/                     # Tauri UI
│   └── kyro.toml               # Configuration
│
├── prisma/                     # Database schema
│
├── public/                     # Static assets
│
├── scripts/                    # Build scripts
│
├── src/                        # Source code
│   ├── app/                    # Next.js App Router
│   │   ├── api/                # API routes
│   │   └── page.tsx            # Main IDE page
│   │
│   ├── components/             # React components
│   │   ├── editor/             # Monaco editor
│   │   ├── terminal/           # xterm.js terminal
│   │   ├── chat/               # AI chat panel
│   │   ├── git/                # Git integration
│   │   ├── debugger/           # Debugger panel
│   │   └── ui/                 # shadcn/ui components
│   │
│   ├── lib/                    # Core libraries
│   │   ├── parser/             # Tree-sitter parsing
│   │   ├── indexing/           # Code indexing & RAG
│   │   ├── ai/                 # AI services
│   │   ├── debug/              # Debugger
│   │   ├── extensions/         # Extension system
│   │   ├── collaboration/      # Real-time collab
│   │   ├── remote/             # Remote development
│   │   └── pulse/              # IDE core logic
│   │
│   ├── hooks/                  # React hooks
│   │
│   └── types/                  # TypeScript types
│
├── src-tauri/                  # Tauri desktop app
│   ├── icons/                  # App icons
│   ├── src/                    # Rust source
│   └── tauri.conf.json         # Tauri config
│
├── installer/                  # Platform installers
│   ├── linux/
│   └── windows/
│
├── CHANGELOG.md                # Version history
├── CONTRIBUTING.md             # Contribution guidelines
├── README.md                   # Project overview
├── SECURITY.md                 # Security policy
├── package.json                # Dependencies
├── vercel.json                 # Vercel deployment
└── tsconfig.json               # TypeScript config
```

## 🏷️ Issue Labels

| Label | Description | Color |
|-------|-------------|-------|
| `bug` | Something isn't working | Red |
| `enhancement` | New feature or request | Blue |
| `documentation` | Improvements to docs | Yellow |
| `good first issue` | Good for newcomers | Purple |
| `help wanted` | Extra attention needed | Orange |
| `roadmap` | Planned features | Green |
| `question` | Further information requested | Gray |

## 📊 Milestones

| Milestone | Description |
|-----------|-------------|
| v1.0.0 | Initial release (completed) |
| v1.1.0 | Live Share, Cloud Sync |
| v1.2.0 | Enterprise features |

## 🔄 Workflows

### CI Pipeline (`ci.yml`)
Runs on every push to `main` and pull requests:
1. **Lint** - ESLint checks
2. **Build** - Next.js build
3. **Test** - Run test suite

### Release Pipeline (`release.yml`)
Runs on version tags (`v*`):
1. Build the application
2. Create GitHub release
3. Generate release notes

## 📝 Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines.

## 🔐 Security

See [SECURITY.md](../SECURITY.md) for security policy.

---

*Last updated: February 2025*
