# Contributing to Kyro IDE

Thank you for your interest in contributing to Kyro IDE! This document provides guidelines and instructions for contributing.

## 📜 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Coding Standards](#coding-standards)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Reporting Bugs](#reporting-bugs)
- [Feature Requests](#feature-requests)
- [Documentation](#documentation)

---

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to conduct@kyroide.dev.

---

## Getting Started

### Prerequisites

Ensure you have the following installed:

| Tool | Version | Purpose |
|------|---------|---------|
| **Rust** | 1.70+ | Backend/desktop framework |
| **Node.js** | 18+ or **Bun** | Frontend tooling |
| **Git** | Latest | Version control |
| **Ollama** | Latest | Local AI models (optional) |

### Platform-Specific Requirements

#### Windows
- Visual Studio Build Tools with C++ development workload
- Windows SDK

#### Linux (Ubuntu/Debian)
```bash
sudo apt install libwebkit2gtk-4.1-dev \
    build-essential curl wget libssl-dev \
    libgtk-3-dev libayatana-appindicator3-dev \
    librsvg2-dev
```

#### macOS
- Xcode Command Line Tools: `xcode-select --install`

---

## Development Setup

### 1. Fork and Clone

```bash
# Fork the repository on GitHub, then clone your fork
git clone https://github.com/YOUR_USERNAME/PULSE-IDE.git
cd PULSE-IDE

# Add upstream remote
git remote add upstream https://github.com/nkpendyam/PULSE-IDE.git
```

### 2. Install Dependencies

```bash
# Install frontend dependencies
bun install

# Rust dependencies are managed by Cargo automatically
```

### 3. Run Development Server

```bash
# Start the development server
bun run tauri:dev

# Or just the web version
bun run dev
```

### 4. Create a Branch

```bash
# Create a feature branch
git checkout -b feature/my-awesome-feature

# Or a bugfix branch
git checkout -b fix/issue-123
```

---

## Project Structure

```
PULSE-IDE/
├── src/                          # Frontend source code
│   ├── app/                      # Next.js app router
│   │   ├── page.tsx              # Main IDE page
│   │   ├── layout.tsx            # Root layout
│   │   └── api/                  # API routes
│   ├── components/               # React components
│   │   ├── ui/                   # shadcn/ui components
│   │   ├── editor/               # Monaco editor components
│   │   ├── terminal/             # Terminal components
│   │   ├── chat/                 # AI chat panel
│   │   ├── explorer/             # File explorer
│   │   ├── agents/               # Agent hub
│   │   ├── premium/              # Premium features panel
│   │   └── ...
│   ├── lib/                      # Utility libraries
│   │   ├── pulse/                # Core PULSE functionality
│   │   │   ├── ai/               # AI completion & agents
│   │   │   ├── analysis/         # Code analysis
│   │   │   ├── collab/           # CRDT collaboration
│   │   │   ├── debugger/         # Time travel debugging
│   │   │   ├── kernel/           # Event routing & state
│   │   │   ├── ide/              # IDE core features
│   │   │   ├── remote/           # Remote development
│   │   │   ├── semantic/         # Semantic analysis
│   │   │   └── ...
│   │   ├── tauri/                # Tauri API wrappers
│   │   ├── stores/               # Zustand stores
│   │   └── lsp/                  # LSP client
│   ├── types/                    # TypeScript types
│   └── hooks/                    # Custom React hooks
├── src-tauri/                    # Tauri/Rust backend
│   ├── src/
│   │   ├── main.rs               # Main entry point
│   │   ├── commands/             # Tauri commands
│   │   │   ├── fs.rs             # Filesystem operations
│   │   │   ├── ai.rs             # AI integration
│   │   │   ├── terminal.rs       # Terminal backend
│   │   │   ├── git.rs            # Git operations
│   │   │   └── system.rs         # System utilities
│   │   ├── terminal.rs           # PTY implementation
│   │   ├── fs_watcher.rs         # File watching
│   │   └── git.rs                # Git integration
│   ├── Cargo.toml                # Rust dependencies
│   └── tauri.conf.json           # Tauri configuration
├── docs/                         # Documentation
├── research/                     # Research & analysis
├── scripts/                      # Build scripts
├── installer/                    # Platform installers
├── prisma/                       # Database schema
├── public/                       # Static assets
└── package.json                  # Node.js configuration
```

---

## Coding Standards

### TypeScript/JavaScript

We use ESLint and TypeScript for code quality. Follow these standards:

```typescript
// Use explicit type annotations for function parameters and returns
function processData(data: string, options?: ProcessOptions): ProcessResult {
  // Implementation
}

// Prefer interfaces for object types
interface ProcessOptions {
  timeout?: number;
  retries?: number;
}

// Use const assertions for literal types
const AGENT_TYPES = ['architect', 'coder', 'reviewer'] as const;

// Use async/await over .then() chains
async function fetchData(): Promise<Data> {
  const response = await fetch(url);
  return response.json();
}

// Use meaningful variable names
const isEditorReady = editor !== null && editor.isReady;

// Document complex logic with comments
// CRDT conflict resolution using YATA algorithm
function resolveConflict(local: Operation, remote: Operation): Operation {
  // ...
}
```

### Rust

Follow standard Rust conventions:

```rust
// Use descriptive function names and document public APIs
/// Executes a command in the integrated terminal
/// 
/// # Arguments
/// * `command` - The command to execute
/// * `cwd` - Working directory for the command
/// 
/// # Returns
/// The exit code of the command
pub async fn execute_command(command: &str, cwd: Option<&Path>) -> Result<i32, TerminalError> {
    // Implementation
}

// Use Result for error handling
// Define custom error types in error.rs

// Prefer unwrap_or_default over unwrap for optional values
let count = optional_count.unwrap_or_default();

// Use ? operator for error propagation
let data = read_file(path).await?;
```

### Component Structure

```tsx
// Component file structure
import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import type { ComponentProps } from './types';

interface MyComponentProps {
  title: string;
  onAction?: () => void;
}

export function MyComponent({ title, onAction }: MyComponentProps) {
  // State
  const [isActive, setIsActive] = useState(false);

  // Effects
  useEffect(() => {
    // Effect logic
  }, []);

  // Handlers
  const handleClick = () => {
    setIsActive(!isActive);
    onAction?.();
  };

  // Render
  return (
    <Card className={isActive ? 'active' : ''}>
      <CardContent>
        <h2>{title}</h2>
        <button onClick={handleClick}>Toggle</button>
      </CardContent>
    </Card>
  );
}
```

---

## Commit Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/):

### Format

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Code style (formatting, etc.) |
| `refactor` | Code refactoring |
| `perf` | Performance improvement |
| `test` | Adding or modifying tests |
| `chore` | Build, CI, or tooling changes |
| `ci` | CI/CD configuration |

### Examples

```bash
# Feature
feat(editor): add multi-cursor support

# Bug fix
fix(terminal): resolve PTY buffer overflow

# Documentation
docs(readme): update installation instructions

# Breaking change
feat(api)!: change agent response format

BREAKING CHANGE: The agent response format has changed from
{ result: string } to { data: { result: string, metadata: object } }
```

---

## Pull Request Process

### Before Submitting

1. **Update your branch**
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Run tests and linting**
   ```bash
   bun run lint
   bun run typecheck
   bun test
   ```

3. **Build the project**
   ```bash
   bun run build
   ```

### Submitting

1. Push your branch to your fork
2. Open a Pull Request against `main`
3. Fill out the PR template completely
4. Link any related issues

### PR Template

```markdown
## Description
[Describe your changes]

## Type of Change
- [ ] Bug fix (non-breaking change fixing an issue)
- [ ] New feature (non-breaking change adding functionality)
- [ ] Breaking change (fix or feature causing breaking changes)
- [ ] Documentation update

## Testing
- [ ] Tests added/updated
- [ ] All tests pass

## Screenshots (if applicable)
[Add screenshots]

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No new warnings introduced
```

### Review Process

1. At least one maintainer approval required
2. All CI checks must pass
3. No merge conflicts
4. Squash and merge is used

---

## Reporting Bugs

### Before Reporting

1. Check existing issues
2. Try the latest version
3. Collect debugging information

### Bug Report Template

```markdown
**Description**
[Clear description of the bug]

**Steps to Reproduce**
1. Go to '...'
2. Click on '...'
3. Scroll down to '...'
4. See error

**Expected Behavior**
[What you expected to happen]

**Actual Behavior**
[What actually happened]

**Screenshots**
[If applicable]

**Environment**
- OS: [e.g., Windows 11, Ubuntu 22.04]
- Kyro IDE Version: [e.g., 1.0.0]
- AI Model: [e.g., Llama 3.2]

**Logs**
[Paste relevant logs]
```

---

## Feature Requests

### Before Requesting

1. Check if the feature already exists
2. Check existing feature requests
3. Consider if it fits the project scope

### Feature Request Template

```markdown
**Is your feature request related to a problem?**
[Clear description of the problem]

**Describe the solution you'd like**
[Clear description of what you want to happen]

**Describe alternatives you've considered**
[Clear description of alternatives]

**Additional context**
[Any other context or screenshots]

**Would you be willing to implement this?**
[Yes/No]
```

---

## Documentation

### Improving Docs

Documentation is in the `docs/` directory:

- `SETUP_GUIDE.md` - Installation and setup
- `FEATURE_COMPARISON.md` - Feature comparisons
- `PREMIUM_FEATURES_ARCHITECTURE.md` - Architecture docs
- Inline code documentation

### Writing Guidelines

- Be clear and concise
- Include code examples
- Update table of contents
- Test all code snippets

---

## Development Tips

### Debugging

```bash
# Enable debug logging
RUST_LOG=debug bun run tauri:dev

# Check Tauri console
# Open DevTools: Ctrl+Shift+I (Windows/Linux) or Cmd+Option+I (macOS)
```

### Testing

```bash
# Run all tests
bun test

# Run specific test file
bun test path/to/test.ts

# Run Rust tests
cd src-tauri && cargo test
```

### Performance

```bash
# Profile Rust code
cd src-tauri && cargo bench

# Analyze bundle size
bun run build && npx next-bundle-analyzer
```

---

## Getting Help

- **Discord**: [discord.gg/kyroide](https://discord.gg/kyroide)
- **GitHub Discussions**: [discussions](https://github.com/nkpendyam/PULSE-IDE/discussions)
- **Email**: dev@kyroide.dev

---

## Recognition

Contributors are recognized in:

- GitHub Contributors page
- Release notes for significant contributions
- Our README.md (major contributors)

---

Thank you for contributing to Kyro IDE! 🚀
