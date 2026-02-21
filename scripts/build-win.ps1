# PULSE IDE - Windows Build Script
# Creates MSI and NSIS installer packages

param(
    [string]$Configuration = "Release",
    [string]$Version = "1.0.0"
)

Write-Host "🚀 Building PULSE IDE for Windows..." -ForegroundColor Cyan

# Configuration
$AppName = "pulse-ide"
$BuildDir = ".\dist"
$StagingDir = "$BuildDir\staging"

# Clean previous builds
Write-Host "🧹 Cleaning previous builds..." -ForegroundColor Yellow
if (Test-Path $BuildDir) {
    Remove-Item -Recurse -Force $BuildDir
}
New-Item -ItemType Directory -Path $BuildDir -Force | Out-Null
New-Item -ItemType Directory -Path $StagingDir -Force | Out-Null

# Build the application
Write-Host "📦 Building Tauri application..." -ForegroundColor Yellow
bun run tauri build --target x86_64-pc-windows-msvc

# Copy outputs
Write-Host "📋 Copying build outputs..." -ForegroundColor Yellow

# MSI installer
$MsiPath = ".\src-tauri\target\release\bundle\msi\PULSE IDE_${Version}_x64.msi"
if (Test-Path $MsiPath) {
    Copy-Item $MsiPath "$BuildDir\PULSE-IDE-${Version}-x64.msi"
    Write-Host "✅ MSI installer created" -ForegroundColor Green
}

# NSIS installer
$NsisPath = ".\src-tauri\target\release\bundle\nsis\PULSE IDE_${Version}_x64-setup.exe"
if (Test-Path $NsisPath) {
    Copy-Item $NsisPath "$BuildDir\PULSE-IDE-${Version}-x64-setup.exe"
    Write-Host "✅ NSIS installer created" -ForegroundColor Green
}

# Create portable version
Write-Host "📱 Creating portable version..." -ForegroundColor Yellow
$PortableDir = "$BuildDir\portable"
New-Item -ItemType Directory -Path $PortableDir -Force | Out-Null

$ExePath = ".\src-tauri\target\release\pulse-ide.exe"
if (Test-Path $ExePath) {
    Copy-Item $ExePath $PortableDir
    
    # Create config directory
    New-Item -ItemType Directory -Path "$PortableDir\config" -Force | Out-Null
    
    # Create README for portable
    @"
PULSE IDE - Portable Version
=============================

This is a portable version of PULSE IDE. No installation required.

Usage:
1. Run pulse-ide.exe
2. Configuration files will be stored in the 'config' folder

For AI features, install Ollama from https://ollama.ai

System Requirements:
- Windows 10 or later
- 4GB RAM (8GB+ recommended for local AI)
- Internet connection for cloud AI features

"@ | Out-File -FilePath "$PortableDir\README.txt" -Encoding UTF8
    
    # Create ZIP archive
    Compress-Archive -Path "$PortableDir\*" -DestinationPath "$BuildDir\PULSE-IDE-${Version}-portable-win-x64.zip"
    Write-Host "✅ Portable version created" -ForegroundColor Green
}

# Summary
Write-Host ""
Write-Host "✅ Build complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Generated packages:" -ForegroundColor Cyan
Get-ChildItem $BuildDir -Filter "*.msi" | ForEach-Object { Write-Host "  📦 $($_.Name)" }
Get-ChildItem $BuildDir -Filter "*.exe" | ForEach-Object { Write-Host "  📦 $($_.Name)" }
Get-ChildItem $BuildDir -Filter "*.zip" | ForEach-Object { Write-Host "  📦 $($_.Name)" }
