import { HEADER_SIZE } from './constants'
import { Layout } from './layout'
import { Packet, parsePackets } from './packets'
import { symbolsToBytes } from './symbols'

function paletteMeans(layout: Layout, cells: Uint8Array, row: Int32Array): Float32Array {
  const m = layout.palette.length
  const w = layout.w
  const reps = row.length / m
  const segments = Math.max(1, Math.floor(reps / 3))
  const segW = Math.floor(row.length / segments)
  const seg = new Float32Array(segments * m * 3)
  const cnt = new Float32Array(segments * m)
  for (let i = 0; i < row.length; i++) {
    const s = Math.min(segments - 1, Math.floor(i / segW))
    const k = i % m
    const p = row[i] * 4
    seg[(s * m + k) * 3] += cells[p]
    seg[(s * m + k) * 3 + 1] += cells[p + 1]
    seg[(s * m + k) * 3 + 2] += cells[p + 2]
    cnt[s * m + k]++
  }
  for (let i = 0; i < segments * m; i++) for (let ch = 0; ch < 3; ch++) seg[i * 3 + ch] /= cnt[i] || 1

  const perCol = new Float32Array(w * m * 3)
  const first = layout.zone
  for (let c = 0; c < w; c++) {
    const pos = (c - first) / segW - 0.5
    const s0 = Math.max(0, Math.min(segments - 1, Math.floor(pos)))
    const s1 = Math.min(segments - 1, s0 + 1)
    const t = Math.max(0, Math.min(1, pos - s0))
    for (let k = 0; k < m; k++) {
      for (let ch = 0; ch < 3; ch++) {
        const a = seg[(s0 * m + k) * 3 + ch]
        const b = seg[(s1 * m + k) * 3 + ch]
        perCol[(c * m + k) * 3 + ch] = a + (b - a) * t
      }
    }
  }
  return perCol
}

export interface DecodeResult {
  packets: Packet[]
  expected: number
  symbols: Uint8Array
}

export function decodeCells(layout: Layout, cells: Uint8Array, maxPackets = layout.packetsPerFrame): DecodeResult {
  const { w, h, palette, bits } = layout
  const m = palette.length
  const top = paletteMeans(layout, cells, layout.topPalette)
  const bottom = paletteMeans(layout, cells, layout.bottomPalette)

  const count = Math.min(layout.packetsPerFrame, maxPackets)
  const size = count * (HEADER_SIZE + layout.packetSize)
  const symbolCount = Math.min(layout.cellCount, Math.ceil((size * 8) / bits))
  const symbols = new Uint8Array(symbolCount)

  for (let s = 0; s < symbolCount; s++) {
    const idx = layout.dataCells[s]
    const c = idx % w
    const t = ((idx / w) | 0) / (h - 1)
    const p = idx * 4
    const r = cells[p]
    const g = cells[p + 1]
    const b = cells[p + 2]
    let best = 0
    let bestD = Infinity
    const base = c * m * 3
    for (let k = 0; k < m; k++) {
      const o = base + k * 3
      const dr = r - (top[o] + (bottom[o] - top[o]) * t)
      const dg = g - (top[o + 1] + (bottom[o + 1] - top[o + 1]) * t)
      const db = b - (top[o + 2] + (bottom[o + 2] - top[o + 2]) * t)
      const d = dr * dr + dg * dg + db * db
      if (d < bestD) {
        bestD = d
        best = k
      }
    }
    symbols[s] = best
  }
  return { packets: parsePackets(layout, symbolsToBytes(symbols, bits, size), count), expected: count, symbols }
}
