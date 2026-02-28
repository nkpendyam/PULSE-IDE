#!/usr/bin/env bash
# =============================================================================
# Kyro IDE - macOS Build Script
# =============================================================================

set -euo pipefail

VERSION=$(cat VERSION 2>/dev/null || echo "0.1.0")
echo "=== Building Kyro IDE v${VERSION} for macOS ==="

# Check dependencies
echo ">>> Checking dependencies..."
command -v cargo >/dev/null 2>&1 || { echo "Error: Rust/Cargo not installed"; exit 1; }
command -v bun >/dev/null 2>&1 || { echo "Error: Bun not installed"; exit 1; }

# Build frontend
echo ">>> Building frontend..."
bun install
bun run build

# Build Rust backend
echo ">>> Building Rust backend..."
cd src-tauri

# Build for Intel and Apple Silicon
echo ">>> Building for x86_64-apple-darwin..."
cargo build --release --target x86_64-apple-darwin

echo ">>> Building for aarch64-apple-darwin..."
cargo build --release --target aarch64-apple-darwin

# Build Tauri app (universal binary)
echo ">>> Building Tauri application..."
cargo tauri build --target universal-apple-darwin

echo "=== Build Complete ==="
echo "Output: src-tauri/target/release/bundle/"
