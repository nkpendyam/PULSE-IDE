# PULSE - Programmable Intelligent Runtime Platform

[![CI](https://github.com/pulse/pulse/workflows/CI/badge.svg)](https://github.com/pulse/pulse/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**PULSE** is a programmable intelligent runtime platform designed for code intelligence, development automation, and cognitive assistance. It exposes a development interface rather than being architected as a conventional editor, with the runtime serving as the operating authority.

## 🚀 Features

- **Runtime Kernel** - Central authority managing lifecycle, events, capabilities, and resources
- **Event-Driven Architecture** - Priority-queued event processing with deterministic replay
- **Agent Runtime** - Autonomous Python agents with sandboxed execution
- **Model Integration** - Lightweight local models (MobileBERT, DistilGPT-2, TinyLlama) with hot-swap
- **PicoClaw Bridge** - Cognitive controller integration for intelligent planning
- **Policy Engine** - Configurable enforcement modes (Off, Review, Agent-driven)
- **Windows Desktop App** - Native Tauri application with Monaco editor

## 📋 System Requirements

- **OS**: Windows 10/11 (x64)
- **RAM**: Minimum 4GB, Recommended 8GB+
- **Disk**: 2GB for installation, additional space for models
- **CPU**: x64 processor

## 📦 Installation

### Download

Download the latest release from [GitHub Releases](https://github.com/pulse/pulse/releases):

- `PULSE-Setup-x.x.x.exe` - Windows installer
- `PULSE-Portable-x.x.x.zip` - Portable version

### Install

1. Run `PULSE-Setup-x.x.x.exe`
2. Follow the installation wizard
3. Launch PULSE from Start Menu or Desktop shortcut

### Offline Installation

For offline installation, download the offline package which includes all models:

```powershell
.\pulse-setup.ps1 -Offline -ModelsPath .\models
```

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      PULSE Desktop UI                        │
│                    (Tauri + TypeScript)                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Runtime Kernel                           │
│   ┌──────────┬──────────┬──────────┬──────────────────┐     │
│   │  State   │  Event   │Capability│    Scheduler     │     │
│   │ Machine  │   Bus    │ Manager  │                  │     │
│   └──────────┴──────────┴──────────┴──────────────────┘     │
│   ┌──────────┬──────────┬──────────┬──────────────────┐     │
│   │ Resource │  Policy  │ Sandbox  │    Storage       │     │
│   │ Manager  │  Engine  │ Manager  │                  │     │
│   └──────────┴──────────┴──────────┴──────────────────┘     │
└─────────────────────────────────────────────────────────────┘
        │                    │                    │
        ▼                    ▼                    ▼
┌───────────────┐  ┌─────────────────┐  ┌───────────────────┐
│  Model Proxy  │  │  PicoClaw Bridge│  │   Agent Runtime   │
│  (llama-swap) │  │  (JSON-RPC-WS)  │  │     (Python)      │
└───────────────┘  └─────────────────┘  └───────────────────┘
```

## 🔧 Configuration

Edit `pulse.toml` in the installation directory:

```toml
[models]
router_model = "mobilebert"
completion_model = "distilgpt2"
reasoning_model = "tinyllama-1.1b"
max_ram_budget = 4096

[security]
default_policy = "review"
sandbox_enabled = true

[picoclaw]
enabled = true
bridge_port = 9876
```

## 🛡️ Security

PULSE enforces security through:

- **Capability-based permissions** - Every operation requires explicit capability
- **Policy modes** - Choose between Off, Review, or Agent-driven execution
- **Sandboxed execution** - All external code runs in isolated processes
- **Audit logging** - Complete trail of all operations

### Policy Modes

| Mode | Description |
|------|-------------|
| `off` | No restrictions (not recommended) |
| `review` | All plans require manual approval |
| `agent` | Agents can auto-execute within bounds |

## 🧪 Development

### Prerequisites

- Rust 1.70+
- Python 3.10+
- Node.js 20+
- Just (task runner)

### Build from Source

```bash
# Clone repository
git clone https://github.com/pulse/pulse.git
cd pulse

# Build runtime kernel
cd runtime && cargo build --release

# Build model proxy
cd ../model-proxy && cargo build --release

# Build Python agents
cd ../agents && pip install -e ".[dev]"

# Build UI
cd ../ui && npm ci && npm run tauri build
```

### Run Tests

```bash
# Rust tests
cargo test --manifest-path runtime/Cargo.toml

# Python tests
cd agents && pytest

# Integration tests
just test-integration
```

## 📚 Documentation

- [Architecture Guide](docs/architecture.md)
- [Developer Guide](docs/developer-guide.md)
- [Extension SDK](docs/extension-sdk.md)
- [API Reference](docs/api-reference.md)
- [Security Guide](docs/security.md)

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Tauri](https://tauri.app/) for native cross-platform UI
- Powered by lightweight language models from Hugging Face
- Inspired by the vision of intelligent development environments

---

**PULSE Team** | [GitHub](https://github.com/pulse) | [Discord](https://discord.gg/pulse) | [Twitter](https://twitter.com/pulse_dev)
