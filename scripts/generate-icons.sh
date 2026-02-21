#!/bin/bash
# Generate icons for all platforms from a source PNG

set -e

SOURCE_ICON="src-tauri/icons/icon.png"
OUTPUT_DIR="src-tauri/icons"

if [ ! -f "$SOURCE_ICON" ]; then
    echo "❌ Source icon not found: $SOURCE_ICON"
    exit 1
fi

echo "🎨 Generating icons for all platforms..."

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Generate PNG icons for Linux and Windows
echo "📦 Generating PNG icons..."
sizes=(32 128 256 512)
for size in "${sizes[@]}"; do
    convert "$SOURCE_ICON" -resize ${size}x${size} "$OUTPUT_DIR/${size}x${size}.png"
    if [ $size -eq 128 ]; then
        cp "$OUTPUT_DIR/${size}x${size}.png" "$OUTPUT_DIR/${size}x${size}@2x.png"
    fi
done

# Generate ICO for Windows (using ImageMagick)
echo "🪟 Generating ICO for Windows..."
convert "$SOURCE_ICON" \
    \( -clone 0 -resize 16x16 \) \
    \( -clone 0 -resize 32x32 \) \
    \( -clone 0 -resize 48x48 \) \
    \( -clone 0 -resize 64x64 \) \
    \( -clone 0 -resize 128x128 \) \
    \( -clone 0 -resize 256x256 \) \
    -delete 0 \
    "$OUTPUT_DIR/icon.ico"

# Generate ICNS for macOS (using png2icns or sips on macOS)
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "🍎 Generating ICNS for macOS..."
    mkdir -p "$OUTPUT_DIR/icon.iconset"
    
    sips -z 16 16     "$SOURCE_ICON" --out "$OUTPUT_DIR/icon.iconset/icon_16x16.png"
    sips -z 32 32     "$SOURCE_ICON" --out "$OUTPUT_DIR/icon.iconset/icon_16x16@2x.png"
    sips -z 32 32     "$SOURCE_ICON" --out "$OUTPUT_DIR/icon.iconset/icon_32x32.png"
    sips -z 64 64     "$SOURCE_ICON" --out "$OUTPUT_DIR/icon.iconset/icon_32x32@2x.png"
    sips -z 128 128   "$SOURCE_ICON" --out "$OUTPUT_DIR/icon.iconset/icon_128x128.png"
    sips -z 256 256   "$SOURCE_ICON" --out "$OUTPUT_DIR/icon.iconset/icon_128x128@2x.png"
    sips -z 256 256   "$SOURCE_ICON" --out "$OUTPUT_DIR/icon.iconset/icon_256x256.png"
    sips -z 512 512   "$SOURCE_ICON" --out "$OUTPUT_DIR/icon.iconset/icon_256x256@2x.png"
    sips -z 512 512   "$SOURCE_ICON" --out "$OUTPUT_DIR/icon.iconset/icon_512x512.png"
    sips -z 1024 1024 "$SOURCE_ICON" --out "$OUTPUT_DIR/icon.iconset/icon_512x512@2x.png"
    
    iconutil -c icns "$OUTPUT_DIR/icon.iconset" -o "$OUTPUT_DIR/icon.icns"
    rm -rf "$OUTPUT_DIR/icon.iconset"
fi

echo "✅ Icon generation complete!"
echo ""
echo "Generated icons:"
ls -la "$OUTPUT_DIR"
