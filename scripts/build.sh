#!/usr/bin/env bash
# Build Flow extension packages for both Chromium and Firefox.
#
# Produces:
#   dist/chromium/flow-chromium-v<version>.zip
#   dist/firefox/flow-firefox-v<version>.zip
#
# The Chromium build uses manifest.json (MV3 service_worker) as-is.
# The Firefox build swaps in manifest.firefox.json (MV3 background.scripts + gecko id).
#
# Usage: ./scripts/build.sh
set -euo pipefail

# Resolve repo root regardless of where the script is invoked from.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

DIST_DIR="dist"
rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR/chromium" "$DIST_DIR/firefox"

# Files/dirs that ship in the extension. Keep this in sync with the real payload.
PAYLOAD=(
  "background.js"
  "popup.html"
  "popup.js"
  "styles.css"
  "youtube-blocker.js"
  "youtube-blocker.css"
  "social-blocker.js"
  "social-blocker.css"
  "x-blocker.js"
  "x-blocker.css"
  "images"
)

# Read version once from the canonical manifest.
VERSION="$(node -e "console.log(require('./manifest.json').version)")"
echo "Building Flow v${VERSION}…"

# ---------------------------------------------------------------------------
# Chromium build: manifest.json as-is.
# ---------------------------------------------------------------------------
CHROMIUM_DIR="$DIST_DIR/chromium"
for item in "${PAYLOAD[@]}" "manifest.json"; do
  cp -R "$item" "$CHROMIUM_DIR/"
done
CHROMIUM_ZIP="flow-chromium-v${VERSION}.zip"
( cd "$CHROMIUM_DIR" && zip -qr "$CHROMIUM_ZIP" . && mv "$CHROMIUM_ZIP" "$ROOT_DIR/$DIST_DIR/" )
echo "✓ Chromium: $DIST_DIR/$CHROMIUM_ZIP"

# ---------------------------------------------------------------------------
# Firefox build: manifest.firefox.json installed as manifest.json.
# ---------------------------------------------------------------------------
FIREFOX_DIR="$DIST_DIR/firefox"
for item in "${PAYLOAD[@]}"; do
  cp -R "$item" "$FIREFOX_DIR/"
done
cp "manifest.firefox.json" "$FIREFOX_DIR/manifest.json"
FIREFOX_ZIP="flow-firefox-v${VERSION}.zip"
( cd "$FIREFOX_DIR" && zip -qr "$FIREFOX_ZIP" . && mv "$FIREFOX_ZIP" "$ROOT_DIR/$DIST_DIR/" )
echo "✓ Firefox:  $DIST_DIR/$FIREFOX_ZIP"

echo
echo "Done. Packages in $DIST_DIR/."
