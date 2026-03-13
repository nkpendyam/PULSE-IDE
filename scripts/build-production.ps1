# Production build script for Kyro IDE (Windows)
# This script creates optimized production builds

$ErrorActionPreference = "Stop"

Write-Host "🏗️  Building Kyro IDE for production..." -ForegroundColor Cyan

# Check environment
if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Bun is not installed." -ForegroundColor Red
    Write-Host "Install from: https://bun.sh" -ForegroundColor Yellow
    exit 1
}

if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Rust is not installed." -ForegroundColor Red
    exit 1
}

# Clean previous builds
Write-Host "🧹 Cleaning previous builds..." -ForegroundColor Cyan
if (Test-Path .next) { Remove-Item -Recurse -Force .next }
if (Test-Path out) { Remove-Item -Recurse -Force out }
if (Test-Path src-tauri/target/release) { Remove-Item -Recurse -Force src-tauri/target/release }

# Install dependencies
Write-Host "📦 Installing dependencies..." -ForegroundColor Cyan
bun install

# Build frontend
Write-Host "⚛️  Building Next.js frontend..." -ForegroundColor Cyan
bun run build

# Build Rust backend (release mode)
Write-Host "🦀 Building Rust backend (release mode)..." -ForegroundColor Cyan
Push-Location src-tauri
cargo build --release
Pop-Location

# Build Tauri app
Write-Host "📦 Building Tauri application..." -ForegroundColor Cyan
bun run tauri:build

Write-Host "✅ Production build complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Build artifacts:"
Write-Host "  - Frontend: out/"
Write-Host "  - Backend: src-tauri/target/release/"
Write-Host "  - Tauri app: src-tauri/target/release/bundle/"
