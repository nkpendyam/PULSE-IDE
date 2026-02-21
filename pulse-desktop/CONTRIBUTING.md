# Contributing to PULSE

Thank you for your interest in contributing to PULSE! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct. Please read [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for details.

## How to Contribute

### Reporting Bugs

1. Check existing issues to avoid duplicates
2. Use the bug report template
3. Include detailed steps to reproduce
4. Include system information and logs

### Suggesting Features

1. Check existing issues and discussions
2. Use the feature request template
3. Describe the use case clearly
4. Explain why this feature would benefit users

### Pull Requests

1. Fork the repository
2. Create a feature branch from `main`
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## Development Setup

### Prerequisites

- Rust 1.70 or later
- Python 3.10 or later
- Node.js 20 or later
- Git

### Getting Started

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/pulse.git
cd pulse

# Install Rust components
rustup component add rustfmt clippy

# Install Python dependencies
cd agents && pip install -e ".[dev]" && cd ..

# Install Node dependencies
cd ui && npm ci && cd ..
```

### Running Tests

```bash
# Rust tests
cargo test --workspace

# Python tests
cd agents && pytest && cd ..

# UI tests
cd ui && npm test && cd ..
```

### Code Style

- **Rust**: Use `cargo fmt` and `cargo clippy`
- **Python**: Use `black` and `ruff`
- **TypeScript**: Use `npm run lint`

### Commit Messages

Follow conventional commits:

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `test:` Test changes
- `refactor:` Code refactoring
- `chore:` Maintenance tasks

### Branch Naming

- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation
- `refactor/description` - Refactoring

## Project Structure

```
pulse/
├── runtime/          # Rust kernel
├── model-proxy/      # Model routing service
├── agents/           # Python agent runtime
├── ui/               # Tauri + TypeScript UI
├── installer/        # Installer scripts
├── docs/             # Documentation
└── tests/            # Integration tests
```

## Questions?

Open a discussion on GitHub or join our Discord community.
