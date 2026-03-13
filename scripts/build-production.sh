#!/bin/bash
# Production build script for Kyro IDE
# This script creates optimized production builds

set -e

echo "🏗️  Building Kyro IDE for production..."

# Check environment
if ! command -v bun &> /dev/null; then
    echo "❌ Bun is not installed."
    echo "Install from: https://bun.sh"
    exit 1
fi

if ! command -v cargo &> /dev/null; then
    echo "❌ Rust is not installed."
    exit 1
fi

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf .next
rm -rf out
rm -rf src-tauri/target/release

# Install dependencies
echo "📦 Installing dependencies..."
bun install --frozen-lockfile 2>/dev/null || bun install

# Build frontend
echo "⚛️  Building Next.js frontend..."
bun run build

# Build Rust backend (release mode)
echo "🦀 Building Rust backend (release mode)..."
cd src-tauri
cargo build --release
cd ..

# Build Tauri app
echo "📦 Building Tauri application..."
bun run tauri:build

echo "✅ Production build complete!"
echo ""
echo "Build artifacts:"
echo "  - Frontend: out/"
echo "  - Backend: src-tauri/target/release/"
echo "  - Tauri app: src-tauri/target/release/bundle/"
