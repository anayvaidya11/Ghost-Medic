/**
 * Generates site/assets/grain.png: the 72x72 paper-grain tile the stylesheet
 * layers over the body background. Deterministic (fixed LCG seed), grayscale
 * plus a constant low alpha, zero dependencies.
 *
 *   node tools/render/grain.mjs > site/assets/grain.png
 *
 * Why a file and not something cleverer, recorded so it is not re-litigated:
 * an SVG feTurbulence background stalled software rasterisers outright, and
 * a data-URI PNG deadlocked headless Chromium's screenshot capture. A plain
 * 5 KB asset does neither, and the site stays zero-external-request.
 */
import { deflateSync } from 'node:zlib';

const W = 72, H = 72, ALPHA = 12;
let seed = 12345;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

const raw = Buffer.alloc(H * (W * 2 + 1));
for (let y = 0; y < H; y++) {
  const row = y * (W * 2 + 1);
  raw[row] = 0;                                   // filter: none
  for (let x = 0; x < W; x++) {
    raw[row + 1 + x * 2] = Math.floor(rnd() * 256);
    raw[row + 2 + x * 2] = ALPHA;
  }
}

const crcTable = [...Array(256)].map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const cc = Buffer.alloc(4); cc.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, cc]);
};

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8;                                      // bit depth
ihdr[9] = 4;                                      // grayscale + alpha

process.stdout.write(Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]));
