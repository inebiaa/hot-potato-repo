/**
 * Writes solid-color square PNGs for PWA manifest (no extra deps).
 * Theme matches index.html theme-color (#f8fafc).
 */
import { writeFileSync } from 'node:fs'
import { deflateSync, crc32 } from 'node:zlib'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const RGBA = { r: 0xf8, g: 0xfa, b: 0xfc, a: 255 }

function pngChunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])) >>> 0, 0)
  return Buffer.concat([length, typeBuf, data, crcBuf])
}

function solidRgbaPng(width, height, { r, g, b, a }) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  const rowBytes = 1 + width * 4
  const raw = Buffer.alloc(height * rowBytes)
  for (let y = 0; y < height; y++) {
    const rowStart = y * rowBytes
    raw[rowStart] = 0 // filter: None
    for (let x = 0; x < width; x++) {
      const p = rowStart + 1 + x * 4
      raw[p] = r
      raw[p + 1] = g
      raw[p + 2] = b
      raw[p + 3] = a
    }
  }

  const idat = deflateSync(raw)
  return Buffer.concat([signature, pngChunk('IHDR', ihdr), pngChunk('IDAT', idat), pngChunk('IEND', Buffer.alloc(0))])
}

const publicDir = resolve(__dirname, '..', 'public')
writeFileSync(resolve(publicDir, 'pwa-192x192.png'), solidRgbaPng(192, 192, RGBA))
writeFileSync(resolve(publicDir, 'pwa-512x512.png'), solidRgbaPng(512, 512, RGBA))
console.log('Wrote public/pwa-192x192.png and public/pwa-512x512.png')
