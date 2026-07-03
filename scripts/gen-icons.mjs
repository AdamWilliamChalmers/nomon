// Rasterises the four-dot brand SVGs into the PNGs the extension and web app
// ship. Run from repo root: `node scripts/gen-icons.mjs`. Requires sharp
// (devDependency of this scripts package).
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const iconSrc = resolve(root, "icons/icon-source.svg");

const targets = [
  { src: iconSrc, out: "icons/icon16.png", size: 16 },
  { src: iconSrc, out: "icons/icon48.png", size: 48 },
  { src: iconSrc, out: "icons/icon128.png", size: 128 },
  { src: iconSrc, out: "icons/icon.png", size: 128 },
  { src: iconSrc, out: "web/public/icon.png", size: 512 },
];

for (const { src, out, size } of targets) {
  await sharp(src, { density: 384 })
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(resolve(root, out));
  console.log(`wrote ${out} (${size}px)`);
}
