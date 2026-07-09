#!/usr/bin/env bash
# Build the Safari Web Extension Xcode project from the Chrome store bundle.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/dist/chrome-store"
OUT="$ROOT/safari"

"$ROOT/scripts/package-extension.sh"

xcrun safari-web-extension-converter "$SRC" \
  --project-location "$OUT" \
  --app-name "Nomon" \
  --bundle-identifier com.nomon.extension \
  --macos-only \
  --copy-resources \
  --swift \
  --no-open \
  --force

# Converter sets the host app bundle id to com.nomon.Nomon; extension must be prefixed.
node - "$OUT/Nomon/Nomon.xcodeproj/project.pbxproj" <<'NODE'
const fs = require("fs");
const path = process.argv[2];
let src = fs.readFileSync(path, "utf8");
src = src.replace(
  /PRODUCT_BUNDLE_IDENTIFIER = com\.nomon\.Nomon;/g,
  "PRODUCT_BUNDLE_IDENTIFIER = com.nomon.extension;"
);
fs.writeFileSync(path, src);
NODE

echo "Safari project: $OUT/Nomon/Nomon.xcodeproj"
echo "Open in Xcode, set your Team for signing, then Product → Run."
