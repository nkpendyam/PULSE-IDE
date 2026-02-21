#!/bin/bash
# PULSE IDE - Linux Build Script
# Creates AppImage, .deb, and .rpm packages

set -e

echo "🚀 Building PULSE IDE for Linux..."

# Configuration
VERSION="1.0.0"
APP_NAME="pulse-ide"
BUILD_DIR="./dist"
APPDIR="${BUILD_DIR}/AppDir"

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf "${BUILD_DIR}"
mkdir -p "${BUILD_DIR}"

# Build the application
echo "📦 Building Tauri application..."
bun run tauri build --target x86_64-unknown-linux-gnu

# Create AppImage
echo "📱 Creating AppImage..."
mkdir -p "${APPDIR}/usr/bin"
mkdir -p "${APPDIR}/usr/lib"
mkdir -p "${APPDIR}/usr/share/applications"
mkdir -p "${APPDIR}/usr/share/icons/hicolor/512x512/apps"
mkdir -p "${APPDIR}/usr/share/icons/hicolor/128x128/apps"

# Copy binary
cp ./src-tauri/target/release/pulse-ide "${APPDIR}/usr/bin/"
chmod +x "${APPDIR}/usr/bin/pulse-ide"

# Copy resources
cp ./installer/linux/pulse-ide.desktop "${APPDIR}/usr/share/applications/"
cp ./src-tauri/icons/512x512.png "${APPDIR}/usr/share/icons/hicolor/512x512/apps/pulse-ide.png"
cp ./src-tauri/icons/128x128.png "${APPDIR}/usr/share/icons/hicolor/128x128/apps/pulse-ide.png"

# Create AppRun
cat > "${APPDIR}/AppRun" << 'EOF'
#!/bin/bash
SELF=$(readlink -f "$0")
HERE=${SELF%/*}
export PATH="${HERE}/usr/bin:${PATH}"
export LD_LIBRARY_PATH="${HERE}/usr/lib:${LD_LIBRARY_PATH}"
exec "${HERE}/usr/bin/pulse-ide" "$@"
EOF
chmod +x "${APPDIR}/AppRun"

# Create .DirIcon
cp ./src-tauri/icons/512x512.png "${APPDIR}/.DirIcon"

# Download appimagetool if not present
if [ ! -f "./appimagetool" ]; then
    echo "📥 Downloading appimagetool..."
    wget -q https://github.com/AppImage/AppImageKit/releases/download/continuous/appimagetool-x86_64.AppImage -O appimagetool
    chmod +x appimagetool
fi

# Build AppImage
./appimagetool "${APPDIR}" "${BUILD_DIR}/${APP_NAME}-${VERSION}-x86_64.AppImage"

# Create .deb package
echo "📦 Creating .deb package..."
DEB_DIR="${BUILD_DIR}/deb"
mkdir -p "${DEB_DIR}/DEBIAN"
mkdir -p "${DEB_DIR}/usr/bin"
mkdir -p "${DEB_DIR}/usr/share/applications"
mkdir -p "${DEB_DIR}/usr/share/icons/hicolor/512x512/apps"
mkdir -p "${DEB_DIR}/usr/share/icons/hicolor/128x128/apps"

# Copy files
cp ./src-tauri/target/release/pulse-ide "${DEB_DIR}/usr/bin/"
chmod 755 "${DEB_DIR}/usr/bin/pulse-ide"
cp ./installer/linux/pulse-ide.desktop "${DEB_DIR}/usr/share/applications/"
cp ./src-tauri/icons/512x512.png "${DEB_DIR}/usr/share/icons/hicolor/512x512/apps/pulse-ide.png"
cp ./src-tauri/icons/128x128.png "${DEB_DIR}/usr/share/icons/hicolor/128x128/apps/pulse-ide.png"

# Create control file
cat > "${DEB_DIR}/DEBIAN/control" << EOF
Package: pulse-ide
Version: ${VERSION}
Section: devel
Priority: optional
Architecture: amd64
Depends: libwebkit2gtk-4.1-0, libgtk-3-0, libssl3, libayatana-appindicator3-1
Maintainer: PULSE Team <team@pulseide.dev>
Description: Open Source AI-Powered IDE
 PULSE IDE is a privacy-first, open-source AI-powered
 development environment with multi-agent orchestration,
 local model support via Ollama, and a powerful plugin architecture.
EOF

# Build .deb
dpkg-deb --build "${DEB_DIR}" "${BUILD_DIR}/${APP_NAME}_${VERSION}_amd64.deb"

echo "✅ Build complete!"
echo ""
echo "Generated packages:"
ls -la "${BUILD_DIR}"/*.AppImage
ls -la "${BUILD_DIR}"/*.deb
