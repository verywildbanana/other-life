/**
 * PWA 아이콘 생성 (외부 의존성 없음 — 순수 Node.js)
 * 실행: node scripts/gen-icons.mjs
 * 나중에 실제 로고로 교체 시: public/icons/ 폴더에 같은 파일명으로 덮어쓰면 됨
 */
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import zlib from 'zlib'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '../public/icons')
mkdirSync(OUT_DIR, { recursive: true })

// ── 미니멀 PNG 인코더 (no deps) ─────────────────────────────────────────────
function crc32(buf) {
  const table = (() => {
    const t = new Uint32Array(256)
    for (let i = 0; i < 256; i++) {
      let c = i
      for (let j = 0; j < 8; j++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      t[i] = c
    }
    return t
  })()
  let c = 0xffffffff
  for (const b of buf) c = table[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii')
  const len = Buffer.allocUnsafe(4)
  len.writeUInt32BE(data.length)
  const crcBuf = Buffer.concat([typeBytes, data])
  const crc = Buffer.allocUnsafe(4)
  crc.writeUInt32BE(crc32(crcBuf))
  return Buffer.concat([len, typeBytes, data, crc])
}

function encodePNG(pixels, width, height) {
  // IHDR
  const ihdr = Buffer.allocUnsafe(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8   // bit depth
  ihdr[9] = 2   // color type: RGB
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0

  // raw scanlines (filter byte 0 + RGB)
  const raw = Buffer.allocUnsafe(height * (1 + width * 3))
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 3)] = 0  // filter: None
    for (let x = 0; x < width; x++) {
      const pi = (y * width + x) * 3
      const ri = y * (1 + width * 3) + 1 + x * 3
      raw[ri]     = pixels[pi]
      raw[ri + 1] = pixels[pi + 1]
      raw[ri + 2] = pixels[pi + 2]
    }
  }
  const compressed = zlib.deflateSync(raw)

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ── 아이콘 픽셀 생성 ──────────────────────────────────────────────────────────
function makeIconPixels(size) {
  const pixels = new Uint8Array(size * size * 3)

  // 배경: zinc-950 (#09090b)
  const bg = [9, 9, 11]
  // 카드 배경: zinc-900 (#18181b)
  const card = [24, 24, 27]
  // 텍스트: zinc-100 (#f4f4f5)
  const fg = [244, 244, 245]
  // 빨간 dot: red-500 (#ef4444)
  const red = [239, 68, 68]

  for (let i = 0; i < size * size; i++) {
    pixels[i * 3]     = bg[0]
    pixels[i * 3 + 1] = bg[1]
    pixels[i * 3 + 2] = bg[2]
  }

  // 둥근 카드 영역
  const pad = Math.round(size * 0.06)
  const r = Math.round(size * 0.18)
  for (let y = pad; y < size - pad; y++) {
    for (let x = pad; x < size - pad; x++) {
      // 코너 둥글게
      const dx = Math.max(0, pad + r - x, x - (size - pad - r - 1))
      const dy = Math.max(0, pad + r - y, y - (size - pad - r - 1))
      if (dx * dx + dy * dy > r * r) continue
      const i = y * size + x
      pixels[i * 3]     = card[0]
      pixels[i * 3 + 1] = card[1]
      pixels[i * 3 + 2] = card[2]
    }
  }

  // "P" 글자 — 비트맵 폰트 (5×7 grid, 각 픽셀 두께 size/12)
  const pBitmap = [
    [1,1,1,1,0],
    [1,0,0,0,1],
    [1,1,1,1,0],
    [1,0,0,0,0],
    [1,0,0,0,0],
    [1,0,0,0,0],
    [1,0,0,0,0],
  ]
  // "F" 글자
  const fBitmap = [
    [1,1,1,1,1],
    [1,0,0,0,0],
    [1,1,1,1,0],
    [1,0,0,0,0],
    [1,0,0,0,0],
    [1,0,0,0,0],
    [1,0,0,0,0],
  ]

  const cellSize = Math.max(2, Math.round(size / 14))
  const charW = 5 * cellSize
  const charH = 7 * cellSize
  const gap = cellSize * 2
  const totalW = charW * 2 + gap
  const startX = Math.round((size - totalW) / 2)
  const startY = Math.round(size * 0.28)

  function drawChar(bitmap, ox) {
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 5; col++) {
        if (!bitmap[row][col]) continue
        for (let dy = 0; dy < cellSize; dy++) {
          for (let dx = 0; dx < cellSize; dx++) {
            const px = ox + col * cellSize + dx
            const py = startY + row * cellSize + dy
            if (px < 0 || px >= size || py < 0 || py >= size) continue
            const i = py * size + px
            pixels[i * 3]     = fg[0]
            pixels[i * 3 + 1] = fg[1]
            pixels[i * 3 + 2] = fg[2]
          }
        }
      }
    }
  }

  drawChar(pBitmap, startX)
  drawChar(fBitmap, startX + charW + gap)

  // 빨간 dot
  const dotCx = Math.round(size / 2)
  const dotCy = Math.round(size * 0.74)
  const dotR  = Math.max(2, Math.round(size * 0.055))
  for (let y = dotCy - dotR; y <= dotCy + dotR; y++) {
    for (let x = dotCx - dotR; x <= dotCx + dotR; x++) {
      if ((x - dotCx) ** 2 + (y - dotCy) ** 2 > dotR * dotR) continue
      if (x < 0 || x >= size || y < 0 || y >= size) continue
      const i = y * size + x
      pixels[i * 3]     = red[0]
      pixels[i * 3 + 1] = red[1]
      pixels[i * 3 + 2] = red[2]
    }
  }

  return pixels
}

// ── 파일 출력 ──────────────────────────────────────────────────────────────────
const sizes = [192, 512, 180]
for (const size of sizes) {
  const pixels = makeIconPixels(size)
  const png = encodePNG(pixels, size, size)

  if (size === 180) {
    writeFileSync(join(OUT_DIR, 'apple-touch-icon.png'), png)
    console.log('✅ apple-touch-icon.png (180×180)')
  } else {
    writeFileSync(join(OUT_DIR, `icon-${size}.png`), png)
    writeFileSync(join(OUT_DIR, `icon-maskable-${size}.png`), png)
    console.log(`✅ icon-${size}.png + icon-maskable-${size}.png`)
  }
}

console.log('\n아이콘 생성 완료 → public/icons/')
console.log('나중에 실제 로고로 교체 시: public/icons/ 에 같은 파일명으로 덮어쓰면 됩니다.')
