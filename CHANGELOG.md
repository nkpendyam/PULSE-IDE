# Changelog

All notable changes to Kyro IDE will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-01-15

### 🎉 Initial Release

The first stable release of Kyro IDE - The Open Source, Privacy-First AI-Powered IDE.

### Added

#### Core IDE Features
- Monaco Editor integration with full IntelliSense support
- Multi-tab editing with split view capabilities
- Integrated terminal with xterm.js and real PTY support
- File explorer with tree view and drag & drop
- Command palette for quick access to all features
- Status bar with Git branch, cursor position, and encoding info
- Activity bar with customizable panels
- Welcome page with quick actions

#### AI Features
- **10 Specialized AI Agents**:
  - Architect: System design and architecture decisions
  - Coder: Code generation and feature implementation
  - Reviewer: Code review and quality assurance
  - Debugger: Bug fixing and error analysis
  - Optimizer: Performance optimization
  - Documenter: Documentation generation
  - Tester: Test generation and coverage
  - Refactorer: Code refactoring and cleanup
  - Security: Vulnerability scanning and security audit
  - Researcher: Research and best practices
- AI Chat Panel for conversational assistance
- Intelligent code completion
- Context-aware code suggestions

#### Premium Features
- **Time Travel Debugging**:
  - Reverse execution
  - State snapshots
  - Variable history tracking
  - Call stack rewind
  - Breakpoint time machine
- **CRDT Collaborative Editing**:
  - YATA algorithm implementation
  - Real-time synchronization
  - Offline support
  - Cursor presence
  - Change attribution
- **Code Clone Detection**:
  - Type-1: Exact duplicates
  - Type-2: Renamed/modified duplicates
  - Type-3: Near-miss clones
  - Type-4: Semantic clones
- **Code Maps**:
  - Dependency visualization
  - Architecture diagrams
  - Code relationship graphs
- **Remote Development**:
  - SSH connection support
  - Container (Docker/Kubernetes) support
  - Port forwarding
  - Remote terminal access
  - File synchronization

#### Model Support
- Local AI models via Ollama:
  - Llama 3.2
  - DeepSeek Coder
  - Code Llama
  - Mistral
  - Dolphin Mixtral (Uncensored)
  - Nous Hermes (Uncensored)
- Cloud AI (Optional):
  - Claude 3.5 Sonnet
  - GPT-4o / GPT-4 Turbo
  - Gemini Pro

#### Platform Support
- Windows (x64): Installer, Portable, MSI
- Linux (x64): AppImage, .deb, .rpm, AUR, Snap
- macOS (Apple Silicon): .dmg, Homebrew

### Security
- Privacy-first architecture
- No telemetry or usage tracking
- Local model support for complete offline operation
- Encrypted settings storage
- Sandboxed code execution

### Documentation
- Comprehensive README with feature comparison
- CONTRIBUTING.md with development guidelines
- SECURITY.md with vulnerability reporting process
- CODE_OF_CONDUCT.md
- Setup guide and architecture documentation

---

## [0.9.0] - 2025-01-01 (Beta)

### Added
- Beta release with core functionality
- Basic AI chat integration
- Monaco editor setup
- Terminal integration
- File explorer

### Changed
- Performance improvements
- UI polish and theming

### Fixed
- Various bug fixes and stability improvements

---

## [0.8.0] - 2024-12-15 (Alpha)

### Added
- Initial alpha release
- Basic IDE functionality
- Proof of concept for AI integration

---

## [1.1.0] - 2025-01-15

### 🚀 Developer Tools Release

Major update adding professional developer tools for enhanced productivity.

### Added

#### Visual Debugger
- Variable watch panel with real-time updates
- Call stack visualization
- Breakpoint management with conditions
- Step over/into/out controls
- Scope inspection (local, global, closure)
- Watch expressions with evaluation
- Debug Adapter Protocol (DAP) support

#### Performance Profiler
- CPU profiling with function timing analysis
- Flame graph visualization
- Hot spot detection
- Call tree navigation
- Profile comparison
- Import/Export .cpuprofile format

#### Memory Profiler
- Heap snapshot capture
- Memory timeline tracking
- Leak detection engine
- Retainer path analysis
- Dominator tree computation
- Memory comparison between snapshots

#### Database Explorer
- Multi-database support (PostgreSQL, MySQL, SQLite, MongoDB)
- Query editor with syntax highlighting
- Result pagination and export
- Schema browser with table/column info
- Connection management
- Query history

#### REST Client
- All HTTP methods (GET, POST, PUT, DELETE, PATCH)
- Request builder with headers/auth
- Response viewer with formatting
- Collections/folders for organizing requests
- Environment variables
- Code generation (cURL, fetch, Axios)

---

## Roadmap

### [1.2.0] - Planned Q2 2025
- AI-powered test generation
- Intelligent code review
- Dependency vulnerability scanning
- Cloud sync for settings

### [2.0.0] - Planned Q3 2025
- Full JetBrains parity
- Visual Studio feature parity
- Enterprise features
- Team collaboration

---

[1.1.0]: https://github.com/nkpendyam/Kyro_IDE/releases/tag/v1.1.0
[1.0.0]: https://github.com/nkpendyam/Kyro_IDE/releases/tag/v1.0.0
[0.9.0]: https://github.com/nkpendyam/Kyro_IDE/releases/tag/v0.9.0
[0.8.0]: https://github.com/nkpendyam/Kyro_IDE/releases/tag/v0.8.0
