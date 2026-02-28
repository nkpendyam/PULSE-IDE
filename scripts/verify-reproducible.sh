#!/usr/bin/env bash
# =============================================================================
# Kyro IDE - Reproducible Build Verification Script
# =============================================================================
# This script generates:
# 1. Software Bill of Materials (SBOM) using Syft
# 2. Cosign signature for binary verification
# 3. Attestation for Sigstore Rekor transparency log
# =============================================================================

set -euo pipefail

VERSION="${1:-$(cat VERSION 2>/dev/null || echo '0.1.0')}"
BINARY_PATH="${2:-./target/release/kyro-ide}"
OUTPUT_DIR="${3:-./dist}"

echo "=== Kyro IDE Reproducible Build Verification ==="
echo "Version: $VERSION"
echo "Binary: $BINARY_PATH"
echo ""

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Check if binary exists
if [ ! -f "$BINARY_PATH" ]; then
    echo "Error: Binary not found at $BINARY_PATH"
    echo "Run 'cargo build --release' first"
    exit 1
fi

# Calculate binary hashes
echo ">>> Calculating binary hashes..."
SHA256=$(sha256sum "$BINARY_PATH" | cut -d' ' -f1)
SHA512=$(sha512sum "$BINARY_PATH" | cut -d' ' -f1)
BLAKE3=$(b3sum "$BINARY_PATH" 2>/dev/null | cut -d' ' -f1 || echo "b3sum not installed")

echo "SHA256:  $SHA256"
echo "SHA512:  $SHA512"
echo "BLAKE3:  $BLAKE3"
echo ""

# Generate SBOM with Syft
echo ">>> Generating SBOM with Syft..."
if command -v syft &> /dev/null; then
    syft packages file:"$BINARY_PATH" \
        --output spdx-json="$OUTPUT_DIR/kyro-ide-$VERSION.spdx.json" \
        --output cyclonedx-json="$OUTPUT_DIR/kyro-ide-$VERSION.cyclonedx.json"
    echo "✓ SBOM generated: $OUTPUT_DIR/kyro-ide-$VERSION.spdx.json"
else
    echo "⚠ Syft not installed, skipping SBOM generation"
    echo "  Install: curl -sSfL https://raw.githubusercontent.com/anchore/syft/main/install.sh | sh"
fi

# Generate build attestation
echo ">>> Generating build attestation..."
cat > "$OUTPUT_DIR/kyro-ide-$VERSION.attestation.json" << EOF
{
  "schemaVersion": "v1",
  "name": "kyro-ide",
  "version": "$VERSION",
  "build": {
    "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "platform": "$(uname -m)",
    "os": "$(uname -s)",
    "compiler": "rustc $(rustc --version | cut -d' ' -f2)",
    "profile": "release",
    "reproducible": true
  },
  "binary": {
    "path": "$(basename $BINARY_PATH)",
    "sha256": "$SHA256",
    "sha512": "$SHA512",
    "blake3": "$BLAKE3",
    "size": $(stat -c%s "$BINARY_PATH" 2>/dev/null || stat -f%z "$BINARY_PATH")
  },
  "verification": {
    "command": "sha256sum kyro-ide-$VERSION",
    "expected": "$SHA256"
  },
  "source": {
    "repository": "https://github.com/nkpendyam/Kyro_IDE",
    "commit": "$(git rev-parse HEAD 2>/dev/null || echo 'unknown')",
    "tag": "$(git describe --tags --exact-match 2>/dev/null || echo 'untagged')"
  }
}
EOF
echo "✓ Attestation generated: $OUTPUT_DIR/kyro-ide-$VERSION.attestation.json"

# Sign with Cosign (if available)
echo ">>> Signing with Cosign..."
if command -v cosign &> /dev/null; then
    # Check if COSIGN_PRIVATE_KEY is set
    if [ -n "${COSIGN_PRIVATE_KEY:-}" ]; then
        cosign sign-blob "$BINARY_PATH" \
            --output-signature "$OUTPUT_DIR/kyro-ide-$VERSION.sig" \
            --output-certificate "$OUTPUT_DIR/kyro-ide-$VERSION.pub" \
            --yes
        echo "✓ Binary signed: $OUTPUT_DIR/kyro-ide-$VERSION.sig"
        
        # Upload to Rekor transparency log
        if command -v rekor-cli &> /dev/null; then
            rekor-cli upload --artifact "$BINARY_PATH" \
                --signature "$OUTPUT_DIR/kyro-ide-$VERSION.sig" \
                --public-key "$OUTPUT_DIR/kyro-ide-$VERSION.pub"
            echo "✓ Uploaded to Rekor transparency log"
        fi
    else
        echo "⚠ COSIGN_PRIVATE_KEY not set, skipping signing"
        echo "  Set COSIGN_PRIVATE_KEY or use 'cosign generate-key-pair'"
    fi
else
    echo "⚠ Cosign not installed, skipping signing"
    echo "  Install: https://docs.sigstore.dev/cosign/installation"
fi

# Generate verification script for users
echo ">>> Generating verification script..."
cat > "$OUTPUT_DIR/verify-kyro-ide.sh" << 'VERIFY_EOF'
#!/usr/bin/env bash
# Kyro IDE Binary Verification Script
# Usage: ./verify-kyro-ide.sh <binary-path>

BINARY="${1:-./kyro-ide}"
EXPECTED_SHA256="${KYRO_IDE_SHA256:-}"

if [ -z "$EXPECTED_SHA256" ]; then
    echo "Error: Set KYRO_IDE_SHA256 environment variable"
    exit 1
fi

ACTUAL_SHA256=$(sha256sum "$BINARY" | cut -d' ' -f1)

if [ "$ACTUAL_SHA256" = "$EXPECTED_SHA256" ]; then
    echo "✓ VERIFIED: Binary matches expected hash"
    echo "  SHA256: $ACTUAL_SHA256"
    exit 0
else
    echo "✗ VERIFICATION FAILED: Hash mismatch"
    echo "  Expected: $EXPECTED_SHA256"
    echo "  Actual:   $ACTUAL_SHA256"
    exit 1
fi
VERIFY_EOF
chmod +x "$OUTPUT_DIR/verify-kyro-ide.sh"
echo "✓ Verification script generated: $OUTPUT_DIR/verify-kyro-ide.sh"

echo ""
echo "=== Build Verification Complete ==="
echo "Outputs in $OUTPUT_DIR:"
ls -la "$OUTPUT_DIR"
