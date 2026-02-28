# =============================================================================
# Kyro IDE - Windows Build Script (PowerShell)
# =============================================================================

param(
    [string]$Target = "release"
)

$VERSION = if (Test-Path "VERSION") { Get-Content "VERSION" } else { "0.1.0" }
Write-Host "=== Building Kyro IDE v$VERSION for Windows ===" -ForegroundColor Cyan

# Check dependencies
Write-Host ">>> Checking dependencies..." -ForegroundColor Yellow

if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
    Write-Host "Error: Rust/Cargo not installed" -ForegroundColor Red
    Write-Host "Install from: https://rustup.rs" -ForegroundColor Yellow
    exit 1
}

if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {
    Write-Host "Error: Bun not installed" -ForegroundColor Red
    Write-Host "Install from: https://bun.sh" -ForegroundColor Yellow
    exit 1
}

# Install Visual Studio Build Tools if needed
$vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
if (-not (Test-Path $vswhere)) {
    Write-Host ">>> Installing Visual Studio Build Tools..." -ForegroundColor Yellow
    winget install Microsoft.VisualStudio.2022.BuildTools --silent --override "--wait --quiet --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
}

# Build frontend
Write-Host ">>> Building frontend..." -ForegroundColor Yellow
bun install
bun run build

# Build Rust backend
Write-Host ">>> Building Rust backend..." -ForegroundColor Yellow
Set-Location src-tauri
cargo build --release

# Build Tauri app
Write-Host ">>> Building Tauri application..." -ForegroundColor Yellow
cargo tauri build --bundles msi,nsis

Write-Host "=== Build Complete ===" -ForegroundColor Green
Write-Host "Output: src-tauri\target\release\bundle\" -ForegroundColor Cyan
