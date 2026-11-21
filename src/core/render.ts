import { Layout } from './layout'
import { bytesToSymbols } from './symbols'

export function renderFrame(layout: Layout, frame: Uint8Array, out?: Uint8ClampedArray): Uint8ClampedArray {
  const { w, h, u, quiet, totalW, totalH, palette, zone } = layout
  const rgba = out ?? new Uint8ClampedArray(totalW * totalH * 4)
  rgba.fill(255)

  const put = (c: number, r: number, col: readonly number[]) => {
    const i = ((r + quiet) * totalW + c + quiet) * 4
    rgba[i] = col[0]
    rgba[i + 1] = col[1]
    rgba[i + 2] = col[2]
  }

  const size = 7 * u
  const black = [0, 0, 0]
  for (const [ox, oy] of [[0, 0], [w - size, 0], [0, h - size], [w - size, h - size]]) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const ring = Math.min(x, y, size - 1 - x, size - 1 - y)
        if (ring < u || ring >= 2 * u) put(ox + x, oy + y, black)
      }
    }
  }

  const { unit, size: asize, alignments } = layout.mesh
  for (const a of alignments) {
    for (let y = 0; y < asize; y++) {
      for (let x = 0; x < asize; x++) {
        const ring = Math.floor(Math.min(x, y, asize - 1 - x, asize - 1 - y) / unit)
        if (ring !== 1) put(a.left + x, a.top + y, black)
      }
    }
  }

  for (let c = zone; c < w - zone; c++) {
    const col = palette[(c - zone) % palette.length]
    put(c, 0, col)
    put(c, h - 1, col)
  }

  const symbols = bytesToSymbols(frame, layout.bits, layout.cellCount)
  for (let s = 0; s < layout.cellCount; s++) {
    const idx = layout.dataCells[s]
    put(idx % w, (idx / w) | 0, palette[symbols[s]])
  }
  return rgba
}
