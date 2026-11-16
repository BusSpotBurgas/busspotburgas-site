// Прави иконите на приложението (PWA) от логото. Пускане: npm run icons
import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "public/icons");
mkdirSync(out, { recursive: true });

// pad = отстъп около автобуса; rx = заобляне (0 = пълен квадрат за maskable/iOS)
const svg = ({ pad = 0, rx = 15 } = {}) => {
  const s = 64 + pad * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad} ${s} ${s}">
  <rect x="${-pad}" y="${-pad}" width="${s}" height="${s}" rx="${rx}" fill="#0B6FA4"/>
  <rect x="14" y="13" width="36" height="34" rx="7" fill="#fff"/>
  <rect x="18" y="18" width="28" height="13" rx="3" fill="#0B6FA4"/>
  <rect x="18" y="36" width="7" height="4" rx="2" fill="#0B6FA4"/>
  <rect x="39" y="36" width="7" height="4" rx="2" fill="#0B6FA4"/>
  <rect x="17" y="47" width="7" height="6" rx="2" fill="#fff"/>
  <rect x="40" y="47" width="7" height="6" rx="2" fill="#fff"/>
</svg>`;
};

const png = (s, size, file) => sharp(Buffer.from(s)).resize(size, size).png().toFile(join(out, file));

await Promise.all([
  png(svg(), 192, "icon-192.png"),
  png(svg(), 512, "icon-512.png"),
  png(svg({ pad: 14, rx: 0 }), 512, "maskable-512.png"),
  png(svg({ pad: 6, rx: 0 }), 180, "apple-touch-icon.png"),
]);
writeFileSync(join(root, "src/app/icon.svg"), svg());
console.log("OK: иконите са в public/icons");
