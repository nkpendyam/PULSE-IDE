#!/bin/bash
# Build Kyro IDE for Windows

set -e

echo "🪟 Building Kyro IDE for Windows..."

# Check for required tools
command -v rustc >/dev/null 2>&1 || { echo "❌ Rust is required but not installed. Install from https://rustup.rs"; exit 1; }
command -v bun >/dev/null 2>&1 || { echo "❌ Bun is required but not installed. Install from https://bun.sh"; exit 1; }

# Add Windows target if not present
rustup target add x86_64-pc-windows-msvc

# Build frontend
echo "📦 Building frontend..."
bun run build

# Build Tauri application
echo "🔧 Building Tauri application..."
bun run tauri build --target x86_64-pc-windows-msvc

echo "✅ Build complete!"
echo ""
echo "📦 Output files:"
echo "  - MSI: src-tauri/target/x86_64-pc-windows-msvc/release/bundle/msi/"
echo "  - NSIS: src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/"
