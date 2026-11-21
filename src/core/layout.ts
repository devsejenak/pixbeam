import { Bits, HEADER_SIZE, PALETTES, Preset, RGB, TARGET_PACKET } from './constants'
import { mulberry32 } from './prng'

export type CellOrder = 'rows' | 'cols'

export interface Alignment {
  row: number
  col: number
  x: number
  y: number
  left: number
  top: number
}

export interface Mesh {
  xs: number[]
  ys: number[]
  alignments: Alignment[]
  unit: number
  size: number
}

export interface Layout {
  preset: Preset
  bits: Bits
  order: CellOrder
  w: number
  h: number
  u: number
  zone: number
  quiet: number
  totalW: number
  totalH: number
  palette: RGB[]
  dataCells: Int32Array
  topPalette: Int32Array
  bottomPalette: Int32Array
  cellCount: number
  capacity: number
  packetSize: number
  packetsPerFrame: number
  whitening: Uint8Array
  markerCenters: [number, number][]
  mesh: Mesh
}

const cache = new Map<string, Layout>()

function buildMesh(w: number, h: number, u: number): Mesh {
  const unit = Math.max(1, Math.round(u / 2))
  const size = 5 * unit
  const m = 3.5 * u
  const cols = w >= 240 ? 4 : 3
  const rows = 3
  const snap = (v: number) => Math.round(v - size / 2) + size / 2
  const xs = Array.from({ length: cols }, (_, j) => (j === 0 ? m : j === cols - 1 ? w - m : snap(m + (j * (w - 2 * m)) / (cols - 1))))
  const ys = Array.from({ length: rows }, (_, i) => (i === 0 ? m : i === rows - 1 ? h - m : snap(m + (i * (h - 2 * m)) / (rows - 1))))
  const alignments: Alignment[] = []
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const corner = (i === 0 || i === rows - 1) && (j === 0 || j === cols - 1)
      if (corner) continue
      const x = snap(xs[j])
      const y = snap(ys[i])
      alignments.push({ row: i, col: j, x, y, left: x - size / 2, top: y - size / 2 })
    }
  }
  return { xs, ys, alignments, unit, size }
}

export function getLayout(preset: Preset, bits: Bits, order: CellOrder = 'rows'): Layout {
  const key = `${preset.id}:${bits}:${order}`
  const hit = cache.get(key)
  if (hit) return hit

  const { w, h, u } = preset
  const zone = 8 * u
  const mesh = buildMesh(w, h, u)
  const pad = mesh.unit
  const inZone = (c: number, r: number) => (r < zone || r >= h - zone) && (c < zone || c >= w - zone)
  const inAlignment = (c: number, r: number) =>
    mesh.alignments.some((a) => c >= a.left - pad && c < a.left + mesh.size + pad && r >= a.top - pad && r < a.top + mesh.size + pad)
  const usable = (c: number, r: number) => !inZone(c, r) && !inAlignment(c, r)

  const cells: number[] = []
  if (order === 'rows') {
    for (let r = 1; r < h - 1; r++) for (let c = 0; c < w; c++) if (usable(c, r)) cells.push(r * w + c)
  } else {
    for (let c = 0; c < w; c++) for (let r = 1; r < h - 1; r++) if (usable(c, r)) cells.push(r * w + c)
  }
  const top: number[] = []
  const bottom: number[] = []
  for (let c = zone; c < w - zone; c++) {
    top.push(c)
    bottom.push((h - 1) * w + c)
  }

  const cellCount = cells.length
  const capacity = Math.floor((cellCount * bits) / 8)
  const count = Math.max(1, Math.round(capacity / (TARGET_PACKET + HEADER_SIZE)))
  const packetSize = Math.max(16, Math.floor(capacity / count) - HEADER_SIZE)
  const packetsPerFrame = Math.floor(capacity / (packetSize + HEADER_SIZE))

  const whitening = new Uint8Array(capacity)
  const rnd = mulberry32(0x4b58 + w * 31 + h * 7 + bits)
  for (let i = 0; i < capacity; i++) whitening[i] = (rnd() * 256) | 0

  const m = 3.5 * u
  const layout: Layout = {
    preset, bits, order, w, h, u, zone,
    quiet: 2 * u,
    totalW: w + 4 * u,
    totalH: h + 4 * u,
    palette: PALETTES[bits],
    dataCells: Int32Array.from(cells),
    topPalette: Int32Array.from(top),
    bottomPalette: Int32Array.from(bottom),
    cellCount, capacity, packetSize, packetsPerFrame, whitening,
    markerCenters: [[m, m], [w - m, m], [w - m, h - m], [m, h - m]],
    mesh,
  }
  cache.set(key, layout)
  return layout
}
