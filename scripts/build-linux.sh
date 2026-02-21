#!/bin/bash
# Build Kyro IDE for Linux

set -e

echo "🐧 Building Kyro IDE for Linux..."

# Check for required tools
command -v rustc >/dev/null 2>&1 || { echo "❌ Rust is required but not installed. Install from https://rustup.rs"; exit 1; }
command -v bun >/dev/null 2>&1 || { echo "❌ Bun is required but not installed. Install from https://bun.sh"; exit 1; }

# Build frontend
echo "📦 Building frontend..."
bun run build

# Build Tauri application
echo "🔧 Building Tauri application..."
bun run tauri build --target x86_64-unknown-linux-gnu

echo "✅ Build complete!"
echo ""
echo "📦 Output files:"
echo "  - AppImage: src-tauri/target/x86_64-unknown-linux-gnu/release/bundle/appimage/"
echo "  - DEB: src-tauri/target/x86_64-unknown-linux-gnu/release/bundle/deb/"
echo "  - RPM: src-tauri/target/x86_64-unknown-linux-gnu/release/bundle/rpm/"
