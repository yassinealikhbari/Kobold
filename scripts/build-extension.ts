import { copyFile, mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

import { build } from 'esbuild';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const extensionRoot = resolve(root, 'extension');
const outputRoot = resolve(extensionRoot, 'dist');

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });

await Promise.all(
  ['background', 'content', 'popup'].map((name) =>
    build({
      entryPoints: [resolve(extensionRoot, `src/${name}.ts`)],
      outfile: resolve(outputRoot, `${name}.js`),
      bundle: true,
      format: 'iife',
      platform: 'browser',
      target: ['chrome120'],
      legalComments: 'none',
    }),
  ),
);

await Promise.all([
  copy('manifest.json'),
  copy('popup.html'),
  copy('popup.css'),
  copy('content.css'),
  copy('../public/fonts/bebas-neue-latin-400.woff2', 'fonts/bebas-neue-latin-400.woff2'),
  copy('../public/fonts/inter-latin-400.woff2', 'fonts/inter-latin-400.woff2'),
  copy('../public/fonts/inter-latin-600.woff2', 'fonts/inter-latin-600.woff2'),
  copy('../public/fonts/inter-latin-800.woff2', 'fonts/inter-latin-800.woff2'),
  ...[16, 32, 48, 128].map((size) => writeIcon(size)),
]);

async function copy(source: string, destination = source): Promise<void> {
  const target = resolve(outputRoot, destination);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(resolve(extensionRoot, source), target);
}

async function writeIcon(size: number): Promise<void> {
  const rowLength = size * 4 + 1;
  const pixels = Buffer.alloc(rowLength * size);
  const black = [11, 11, 11, 255] as const;
  const pink = [206, 177, 190, 255] as const;
  const border = Math.max(1, Math.round(size * 0.08));

  for (let y = 0; y < size; y += 1) {
    const rowStart = y * rowLength;
    pixels[rowStart] = 0;
    for (let x = 0; x < size; x += 1) {
      setPixel(pixels, size, x, y, x < border || y < border || x >= size - border || y >= size - border ? black : pink);
    }
  }

  const top = Math.round(size * 0.2);
  const bottom = Math.round(size * 0.8);
  const left = Math.round(size * 0.29);
  const joint = Math.round(size * 0.45);
  const right = Math.round(size * 0.75);
  const middle = (top + bottom) / 2;
  const thickness = Math.max(1, Math.round(size * 0.09));

  fillRect(pixels, size, left, top, thickness, bottom - top + 1, black);
  for (let y = top; y <= bottom; y += 1) {
    const progress = Math.abs(y - middle) / Math.max(1, middle - top);
    const x = Math.round(joint + (right - joint) * progress);
    fillRect(pixels, size, x, y, thickness, thickness, black);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(pixels)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
  await writeFile(resolve(outputRoot, `icon${size}.png`), png);
}

function fillRect(
  pixels: Buffer,
  size: number,
  startX: number,
  startY: number,
  width: number,
  height: number,
  color: readonly [number, number, number, number],
): void {
  for (let y = startY; y < startY + height; y += 1) {
    for (let x = startX; x < startX + width; x += 1) setPixel(pixels, size, x, y, color);
  }
}

function setPixel(
  pixels: Buffer,
  size: number,
  x: number,
  y: number,
  color: readonly [number, number, number, number],
): void {
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  const offset = y * (size * 4 + 1) + 1 + x * 4;
  pixels.set(color, offset);
}

function pngChunk(type: string, data: Buffer): Buffer {
  const name = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
