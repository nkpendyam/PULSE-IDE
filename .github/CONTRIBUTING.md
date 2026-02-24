# KRO_IDE Contribution Guide

## Development Setup

### Prerequisites
- **Rust** 1.70+ (install via [rustup](https://rustup.rs))
- **Node.js** 18+ or **Bun**
- **Platform-specific dependencies**:
  - **Linux**: `libgtk-3-dev`, `libwebkit2gtk-4.1-dev`, `libappindicator3-dev`
  - **macOS**: Xcode Command Line Tools
  - **Windows**: Microsoft Visual Studio Build Tools

### Quick Start
```bash
# Clone the repository
git clone https://github.com/nkpendyam/Kyro_IDE.git
cd Kyro_IDE

# Install dependencies
bun install

# Run in development mode
bun run tauri dev
```

## Project Structure

```
Kyro_IDE/
├── src/                    # Next.js frontend
│   ├── app/               # App Router pages
│   ├── components/        # React components
│   └── store/             # Zustand state management
├── src-tauri/             # Rust backend
│   ├── src/
│   │   ├── embedded_llm/  # Local LLM engine
│   │   ├── mcp/           # Model Context Protocol
│   │   ├── update/        # Auto-update system
│   │   ├── plugin_sandbox/# WASM plugin system
│   │   ├── swarm_ai/      # AI agent swarm
│   │   └── ...            # Other modules
│   └── Cargo.toml
└── .github/               # CI/CD workflows
```

## Coding Standards

### Rust
- Run `cargo fmt` before committing
- Run `cargo clippy` and fix all warnings
- Add tests for new functionality
- Document public APIs with doc comments

### TypeScript/React
- Use TypeScript strict mode
- Follow the existing component patterns
- Use Tailwind CSS for styling
- Keep components small and focused

## Pull Request Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests and linting
5. Commit with conventional commits (`feat:`, `fix:`, `docs:`, etc.)
6. Push to your fork
7. Open a Pull Request

## Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation only
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `perf:` - Performance improvements
- `test:` - Adding/updating tests
- `chore:` - Maintenance tasks

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
