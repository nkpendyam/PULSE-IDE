#!/usr/bin/env bash
# =============================================================================
# Kyro IDE - Linux Build Script
# =============================================================================

set -euo pipefail

VERSION=$(cat VERSION 2>/dev/null || echo "0.1.0")
echo "=== Building Kyro IDE v${VERSION} for Linux ==="

# Check dependencies
echo ">>> Checking dependencies..."
command -v cargo >/dev/null 2>&1 || { echo "Error: Rust/Cargo not installed"; exit 1; }
command -v bun >/dev/null 2>&1 || { echo "Error: Bun not installed"; exit 1; }

# Install Linux dependencies if needed
if command -v apt-get >/dev/null 2>&1; then
    echo ">>> Installing Linux dependencies..."
    sudo apt-get update
    sudo apt-get install -y \
        libgtk-3-dev \
        libwebkit2gtk-4.1-dev \
        libappindicator3-dev \
        librsvg2-dev \
        patchelf \
        libssl-dev \
        pkg-config
fi

# Build frontend
echo ">>> Building frontend..."
bun install
bun run build

# Build Rust backend
echo ">>> Building Rust backend..."
cd src-tauri
cargo build --release

# Build Tauri app
echo ">>> Building Tauri application..."
cargo tauri build --bundles deb,appimage

echo "=== Build Complete ==="
echo "Output: src-tauri/target/release/bundle/"
