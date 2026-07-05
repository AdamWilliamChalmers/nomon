#!/usr/bin/env bash
# Build a Chrome Web Store upload zip (production manifest — no localhost).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="$ROOT/dist/chrome-store"
ZIP="$ROOT/dist/nomon-extension.zip"

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"

copy() {
  cp -R "$1" "$OUT_DIR/"
}

copy "$ROOT/manifest.json"
copy "$ROOT/background.js"
copy "$ROOT/config.js"
copy "$ROOT/userId.js"
copy "$ROOT/content.js"
copy "$ROOT/engine.js"
copy "$ROOT/goals.js"
copy "$ROOT/judge.js"
copy "$ROOT/net.js"
copy "$ROOT/nudges.js"
copy "$ROOT/rules.js"
copy "$ROOT/session.js"
copy "$ROOT/sparkline.js"
copy "$ROOT/widget.js"
copy "$ROOT/widget.css"
copy "$ROOT/adapters"
copy "$ROOT/icons"

# Production manifest: drop localhost host permission (dev-only).
node - "$OUT_DIR/manifest.json" <<'NODE'
const fs = require("fs");
const path = process.argv[2];
const manifest = JSON.parse(fs.readFileSync(path, "utf8"));
manifest.host_permissions = (manifest.host_permissions || []).filter(
  (p) => !p.includes("localhost")
);
if (!manifest.content_scripts?.[0]?.js?.includes("userId.js")) {
  const js = manifest.content_scripts[0].js;
  const idx = js.indexOf("config.js");
  if (idx >= 0) js.splice(idx + 1, 0, "userId.js");
}
fs.writeFileSync(path, JSON.stringify(manifest, null, 2) + "\n");
NODE

# Production background allowlist: no localhost.
node - "$OUT_DIR/background.js" <<'NODE'
const fs = require("fs");
const path = process.argv[2];
let src = fs.readFileSync(path, "utf8");
src = src.replace(/\n\s*"localhost",\n/, "\n");
fs.writeFileSync(path, src);
NODE

rm -f "$ZIP"
(
  cd "$OUT_DIR"
  zip -r "$ZIP" . -x "*.DS_Store"
)

echo "Built $ZIP ($(du -h "$ZIP" | cut -f1))"
echo "Upload this file in the Chrome Web Store developer dashboard."
