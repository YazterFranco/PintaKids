#!/usr/bin/env node
/** Genera icon-192.png e icon-512.png desde cero (sin librerías): PNG RGBA + zlib.crc32. */
import { deflateSync, crc32 } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT = join(import.meta.dirname, '..', 'server', 'web', 'assets');

function png(size, pixel) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x, y, size);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
      raw[o + 3] = a;
    }
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
const VIOLETA = hex('#7c4dff');
const AMARILLO = hex('#ffd166');
const AMBAR = hex('#ffc233');
const ROSA = hex('#ef476f');
const CREMA = hex('#f6e7c9');
const TINTA = hex('#33334d');
const VERDE = hex('#06d6a0');
const AZUL = hex('#118ab2');

function pixel(x, y, size) {
  const u = x / size;
  const v = y / size;
  const R = 112 / 512;
  // fondo redondeado
  const inCornerX = Math.min(Math.max(R, u), 1 - R) - u;
  const inCornerY = Math.min(Math.max(R, v), 1 - R) - v;
  if (Math.hypot(inCornerX, inCornerY) > R) return [0, 0, 0, 0];
  // lápiz rotado -15° alrededor de (0.5, 0.527)
  const ang = (15 * Math.PI) / 180;
  const cx = 0.5;
  const cy = 270 / 512;
  const dx = u - cx;
  const dy = v - cy;
  const rx = dx * Math.cos(ang) - dy * Math.sin(ang);
  const ry = dx * Math.sin(ang) + dy * Math.cos(ang);
  const X = rx * 512;
  const Y = ry * 512;
  if (X >= -56 && X <= 56 && Y >= -150 && Y <= 170) {
    if (Y <= 86) {
      if (Y >= -60 && Y <= -40) return [...ROSA, 255];
      if (X <= -22) return [...AMBAR, 255];
      return [...AMARILLO, 255];
    }
    if (Y <= 170) {
      const frac = (Y - 86) / 84;
      const half = 56 * (1 - frac);
      if (-X <= half) {
        if (frac > 0.55 && -X <= half * 0.35) return [...TINTA, 255];
        return [...CREMA, 255];
      }
    }
  }
  const dot = (px, py, pr, col) => (Math.hypot(u - px, v - py) * 512 <= pr ? [...col, 255] : null);
  return (
    dot(120 / 512, 120 / 512, 26, VERDE) ??
    dot(400 / 512, 110 / 512, 20, AZUL) ??
    dot(420 / 512, 400 / 512, 24, ROSA) ??
    [...VIOLETA, 255]
  );
}

writeFileSync(join(OUT, 'icon-192.png'), png(192, pixel));
writeFileSync(join(OUT, 'icon-512.png'), png(512, pixel));
console.log('iconos PNG generados');
