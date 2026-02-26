{
  description = "Kyro IDE - GPU-Accelerated AI-Native Code Editor";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    rust-overlay.url = "github:oxalica/rust-overlay";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, rust-overlay, flake-utils, ... }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        overlays = [ (import rust-overlay) ];
        pkgs = import nixpkgs {
          inherit system overlays;
        };

        # pinned Rust version for reproducibility
        rustToolchain = pkgs.rust-bin.stable."1.75.0".default.override {
          extensions = [ "rust-src" "rust-analyzer" ];
          targets = [ "x86_64-unknown-linux-gnu" "aarch64-apple-darwin" "x86_64-pc-windows-msvc" ];
        };

        # Platform-specific dependencies
        platformDeps = with pkgs; {
          linux = [
            pkg-config
            gtk3
            webkitgtk_4_1
            libsoup_3
            openssl
            glib
            pango
            cairo
            atk
            gdk-pixbuf
            harfbuzz
            zlib
          ] ++ lib.optionals stdenv.isLinux [
            libayatana-appindicator
          ];

          darwin = with darwin.apple_sdk.frameworks; [
            Foundation
            CoreServices
            Security
            AppKit
            WebKit
            Carbon
            Cocoa
          ];

          windows = [];
        };

        buildInputs = with pkgs; platformDeps.${pkgs.stdenv.hostPlatform.parsed.kernel.name} or [];

      in {
        packages.default = pkgs.rustPlatform.buildRustPackage {
          pname = "kyro-ide";
          version = builtins.readFile ./VERSION or "0.1.0";

          src = ./.;

          cargoLock.lockFile = ./Cargo.lock;

          inherit buildInputs;

          nativeBuildInputs = with pkgs; [
            rustToolchain
            pkg-config
            wrapGAppsHook
          ];

          # Reproducible build settings
          CARGO_INCREMENTAL = "0";
          RUSTFLAGS = "-C codegen-units=1";
          NIX_BUILD_CORES = "1";

          meta = with pkgs.lib; {
            description = "GPU-Accelerated AI-Native Code Editor with Embedded LLM";
            homepage = "https://github.com/nkpendyam/Kyro_IDE";
            license = licenses.mit;
            platforms = platforms.unix;
          };
        };

        # Development shell
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            rustToolchain
            pkg-config
            openssl
            git
          ] ++ buildInputs;

          shellHook = ''
            echo "Kyro IDE Development Environment"
            echo "Rust version: $(rustc --version)"
            echo "Run 'cargo build --release' to build"
          '';
        };

        # Reproducible build verification
        apps.verify-reproducible = flake-utils.lib.mkApp {
          drv = pkgs.writeShellScriptBin "verify-reproducible" ''
            echo "Building Kyro IDE twice to verify reproducibility..."
            
            # Build #1
            nix build . --rebuild --out-path ./build1
            HASH1=$(sha256sum ./build1/bin/kyro-ide | cut -d' ' -f1)
            
            # Clean and build #2
            rm -rf ./build1
            nix build . --rebuild --out-path ./build2
            HASH2=$(sha256sum ./build2/bin/kyro-ide | cut -d' ' -f1)
            
            if [ "$HASH1" = "$HASH2" ]; then
              echo "✓ REPRODUCIBLE: Both builds are byte-for-byte identical"
              echo "  SHA256: $HASH1"
              exit 0
            else
              echo "✗ NOT REPRODUCIBLE: Hashes differ"
              echo "  Build 1: $HASH1"
              echo "  Build 2: $HASH2"
              exit 1
            fi
          '';
        };
      }
    );
}
