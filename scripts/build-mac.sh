#!/bin/bash
# Build Kyro IDE for macOS

set -e

echo "🍎 Building Kyro IDE for macOS..."

# Check for required tools
command -v rustc >/dev/null 2>&1 || { echo "❌ Rust is required but not installed. Install from https://rustup.rs"; exit 1; }
command -v bun >/dev/null 2>&1 || { echo "❌ Bun is required but not installed. Install from https://bun.sh"; exit 1; }

# Add macOS targets if not present
rustup target add aarch64-apple-darwin
rustup target add x86_64-apple-darwin

# Build frontend
echo "📦 Building frontend..."
bun run build

# Build for Apple Silicon (M1/M2)
echo "🔧 Building for Apple Silicon (aarch64)..."
bun run tauri build --target aarch64-apple-darwin

# Build for Intel Mac (optional)
echo "🔧 Building for Intel Mac (x86_64)..."
bun run tauri build --target x86_64-apple-darwin

echo "✅ Build complete!"
echo ""
echo "📦 Output files:"
echo "  - DMG (Apple Silicon): src-tauri/target/aarch64-apple-darwin/release/bundle/dmg/"
echo "  - DMG (Intel): src-tauri/target/x86_64-apple-darwin/release/bundle/dmg/"
echo "  - APP (Apple Silicon): src-tauri/target/aarch64-apple-darwin/release/bundle/macos/"
echo "  - APP (Intel): src-tauri/target/x86_64-apple-darwin/release/bundle/macos/"
