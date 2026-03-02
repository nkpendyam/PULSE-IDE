#!/bin/bash
# Production build script for Kyro IDE
# This script creates optimized production builds

set -e

echo "🏗️  Building Kyro IDE for production..."

# Check environment
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed."
    exit 1
fi

if ! command -v cargo &> /dev/null; then
    echo "❌ Rust is not installed."
    exit 1
fi

# Determine package manager
if command -v bun &> /dev/null; then
    PKG_MANAGER="bun"
else
    PKG_MANAGER="npm"
fi

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf .next
rm -rf src-tauri/target/release

# Install dependencies
echo "📦 Installing dependencies..."
$PKG_MANAGER install --frozen-lockfile 2>/dev/null || $PKG_MANAGER install

# Build frontend
echo "⚛️  Building Next.js frontend..."
$PKG_MANAGER run build

# Build Rust backend (release mode)
echo "🦀 Building Rust backend (release mode)..."
cd src-tauri
cargo build --release
cd ..

# Build Tauri app
echo "📦 Building Tauri application..."
$PKG_MANAGER run tauri:build

echo "✅ Production build complete!"
echo ""
echo "Build artifacts:"
echo "  - Frontend: .next/standalone/"
echo "  - Backend: src-tauri/target/release/"
echo "  - Tauri app: src-tauri/target/release/bundle/"
