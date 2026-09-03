// Generator ikon PWA KOSFLOW — murni Node (tanpa dependensi eksternal).
// Menghasilkan PNG 8-bit RGBA langsung: latar gradien biru + ilustrasi rumah putih.
// Jalankan: node scripts/generate-pwa-icons.mjs

import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "public", "icons");

// ---------- Encoder PNG minimal ----------
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------- Seni ikon (koordinat basis 512) ----------
const TOP = [96, 208]; // sudut kiri atap
const APEX = [256, 56]; // puncak atap
const BOTTOM = [416, 208]; // sudut kanan atap
const BODY = { x1: 140, y1: 200, x2: 372, y2: 448 };
const DOOR = { x1: 224, y1: 296, x2: 288, y2: 448 };

function sign(ax, ay, bx, by, cx, cy) {
  return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
}

function insideTriangle(px, py) {
  const d1 = sign(px, py, TOP[0], TOP[1], APEX[0], APEX[1]);
  const d2 = sign(px, py, APEX[0], APEX[1], BOTTOM[0], BOTTOM[1]);
  const d3 = sign(px, py, BOTTOM[0], BOTTOM[1], TOP[0], TOP[1]);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}

function bgColor(yFrac) {
  // Gradien vertikal: #2f7bff (atas) -> #1e40af (bawah)
  const r = Math.round(47 + (30 - 47) * yFrac);
  const g = Math.round(123 + (64 - 123) * yFrac);
  const b = Math.round(255 + (175 - 255) * yFrac);
  return [r, g, b];
}

function renderIcon(size) {
  const k = size / 512;
  const rgba = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    const sy = y / k; // koordinat di ruang 512
    const yFrac = y / (size - 1);
    const [br, bg, bb] = bgColor(yFrac);
    const rowStart = y * size * 4;
    for (let x = 0; x < size; x++) {
      const sx = x / k;
      let r = br;
      let g = bg;
      let b = bb;

      const inRoof = insideTriangle(sx, sy);
      const inBody = sx >= BODY.x1 && sx <= BODY.x2 && sy >= BODY.y1 && sy <= BODY.y2;
      if (inRoof || inBody) {
        r = 255;
        g = 255;
        b = 255;
      }
      if (sx >= DOOR.x1 && sx <= DOOR.x2 && sy >= DOOR.y1 && sy <= DOOR.y2) {
        // pintu: warna latar lebih gelap agar tampak ceruk
        r = Math.round(r * 0.45);
        g = Math.round(g * 0.45);
        b = Math.round(b * 0.45);
      }

      const i = rowStart + x * 4;
      rgba[i] = r;
      rgba[i + 1] = g;
      rgba[i + 2] = b;
      rgba[i + 3] = 255;
    }
  }
  return encodePng(size, size, rgba);
}

mkdirSync(OUT_DIR, { recursive: true });

const targets = [
  ["icon-192.png", 192],
  ["icon-512.png", 512],
  ["maskable-512.png", 512],
  ["apple-touch-icon.png", 180],
];

for (const [name, size] of targets) {
  writeFileSync(join(OUT_DIR, name), renderIcon(size));
  console.log(`✓ ${name} (${size}x${size})`);
}

console.log(`Ikon tersimpan di ${OUT_DIR}`);
