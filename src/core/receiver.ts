import { BIT_MODES, Bits, Preset, PRESETS } from './constants'
import { decodeCells, DecodeResult } from './decode'
import { TEST_FILE_ID } from './diagnostics'
import { binarize, findMarkers, Marker, pickCorners, refineMarker } from './detect'
import { FountainDecoder } from './fountain'
import { homography, Matrix3, Point, project } from './homography'
import { CellOrder, getLayout, Layout } from './layout'

export interface FrameSource {
  readonly width: number
  readonly height: number
  small(maxWidth: number): { data: Uint8Array; w: number; h: number; scale: number }
  region(x: number, y: number, w: number, h: number): Uint8Array
  rectify(patches: Patch[], w: number, h: number): Uint8Array
}

export interface Patch {
  h: Matrix3
  x0: number
  y0: number
  x1: number
  y1: number
}

export interface MeshResult {
  patches: Patch[]
  nodes: Point[]
  found: number
  total: number
}

export interface Lock {
  preset: Preset
  bits: Bits
  order: CellOrder
  rotation: number
}

const ORDERS: CellOrder[] = ['rows', 'cols']

export interface FrameReport {
  corners: Point[] | null
  tracked: boolean
  lock: Lock | null
  packets: number
  expected: number
  finished: boolean
  decoded?: DecodeResult
  layout?: Layout
  alignment?: { nodes: Point[]; found: number; total: number }
  cellPx?: number
}

const COARSE_WIDTH = 640

function codeRing(layout: Layout, rotation: number): Point[] {
  const c = layout.markerCenters
  return [0, 1, 2, 3].map((i) => c[(i + rotation) % 4])
}

export class Receiver {
  decoder: FountainDecoder | null = null
  lock: Lock | null = null
  validPackets = 0
  expectedPackets = 0
  useAlignment = true
  private ring: Marker[] | null = null
  private misses = 0
  private offsets = new Map<string, Point[]>()

  reset() {
    this.decoder = null
    this.validPackets = 0
    this.expectedPackets = 0
  }

  process(src: FrameSource): FrameReport {
    let tracked = false
    let ring = this.ring ? this.refineAll(src, this.ring) : null
    if (ring) tracked = true
    else ring = this.detect(src)
    this.ring = ring

    const report: FrameReport = { corners: ring?.map((m) => [m.x, m.y]) ?? null, tracked, lock: this.lock, packets: 0, expected: 0, finished: false }
    if (!ring) return report

    if (!this.lock) this.lock = this.search(src, ring)
    report.lock = this.lock
    if (!this.lock) return report

    const layout = getLayout(this.lock.preset, this.lock.bits, this.lock.order)
    const mesh = this.mesh(src, layout, this.lock.rotation, ring)
    if (!mesh) return report
    report.alignment = { nodes: mesh.nodes, found: mesh.found, total: mesh.total }
    report.cellPx = ring.reduce((a, m) => a + m.size, 0) / ring.length / (7 * layout.u)
    const decoded = decodeCells(layout, src.rectify(mesh.patches, layout.w, layout.h))
    const { packets, expected } = decoded
    report.decoded = decoded
    report.layout = layout
    report.packets = packets.length
    report.expected = expected
    this.expectedPackets += expected

    if (!packets.length) {
      if (++this.misses > 30) {
        this.lock = null
        this.misses = 0
      }
      return report
    }
    this.misses = 0
    for (const p of packets) {
      if (p.fileId === TEST_FILE_ID) {
        this.validPackets++
        continue
      }
      if (!this.decoder || this.decoder.fileId !== p.fileId) {
        if (this.decoder?.done) continue
        this.decoder = new FountainDecoder(p.fileId, p.totalSize, p.blockSize)
      }
      if (this.decoder.blockSize !== p.blockSize || this.decoder.totalSize !== p.totalSize) continue
      this.decoder.add(p.seed, p.data)
      this.validPackets++
    }
    report.finished = !!this.decoder?.done
    return report
  }

  private detect(src: FrameSource): Marker[] | null {
    const small = src.small(COARSE_WIDTH)
    const corners = pickCorners(findMarkers(binarize(small.data, small.w, small.h), small.w, small.h))
    if (!corners) return null
    const scaled = corners.map((m) => ({ x: m.x * small.scale + (small.scale - 1) / 2, y: m.y * small.scale + (small.scale - 1) / 2, size: m.size * small.scale, hits: m.hits }))
    return this.refineAll(src, scaled)
  }

  private refineAll(src: FrameSource, ring: Marker[]): Marker[] | null {
    const out: Marker[] = []
    for (const m of ring) {
      const half = Math.ceil(m.size * 0.9)
      const x0 = Math.max(0, Math.round(m.x - half))
      const y0 = Math.max(0, Math.round(m.y - half))
      const x1 = Math.min(src.width, Math.round(m.x + half))
      const y1 = Math.min(src.height, Math.round(m.y + half))
      if (x1 - x0 < 8 || y1 - y0 < 8) return null
      const r = refineMarker(src.region(x0, y0, x1 - x0, y1 - y0), x1 - x0, y1 - y0, [m.x - x0, m.y - y0], m.size)
      if (!r) return null
      out.push({ x: r.x + x0, y: r.y + y0, size: r.size, hits: 1 })
    }
    const sizes = out.map((m) => m.size)
    if (Math.max(...sizes) > Math.min(...sizes) * 2) return null
    return out
  }

  private search(src: FrameSource, ring: Marker[]): Lock | null {
    const dist = (a: Marker, b: Marker) => Math.hypot(a.x - b.x, a.y - b.y)
    const horizontal = dist(ring[0], ring[1]) + dist(ring[3], ring[2])
    const vertical = dist(ring[0], ring[3]) + dist(ring[1], ring[2])
    const rotations = horizontal >= vertical ? [0, 2] : [1, 3]
    for (const preset of PRESETS) {
      for (const rotation of rotations) {
        const mesh = this.mesh(src, getLayout(preset, 3), rotation, ring)
        if (!mesh) continue
        const cells = src.rectify(mesh.patches, preset.w, preset.h)
        for (const bits of BIT_MODES) {
          for (const order of ORDERS) {
            if (decodeCells(getLayout(preset, bits, order), cells, 4).packets.length) return { preset, bits, order, rotation }
          }
        }
      }
    }
    return null
  }

  private mesh(src: FrameSource, layout: Layout, rotation: number, ring: Marker[]): MeshResult | null {
    const global = homography(codeRing(layout, rotation), ring.map((m) => [m.x, m.y]))
    if (!global) return null
    const { xs, ys, alignments, size } = layout.mesh
    const cols = xs.length
    const rows = ys.length
    const nodes: Point[] = new Array(cols * rows)
    const code: Point[] = new Array(cols * rows)
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) code[i * cols + j] = [xs[j], ys[i]]
    for (const a of alignments) code[a.row * cols + a.col] = [a.x, a.y]
    const cornerOf = (q: number) => ring[(q - rotation + 4) % 4]
    const corners: [number, number, number][] = [[0, 0, 0], [0, cols - 1, 1], [rows - 1, cols - 1, 2], [rows - 1, 0, 3]]
    for (const [i, j, q] of corners) {
      const m = cornerOf(q)
      nodes[i * cols + j] = [m.x, m.y]
    }

    const cellPx = ring.reduce((a, m) => a + m.size, 0) / ring.length / (7 * layout.u)
    const key = `${layout.preset.id}:${rotation}`
    const offsets = this.offsets.get(key) ?? alignments.map(() => [0, 0] as Point)
    let found = 0
    alignments.forEach((a, k) => {
      const [px, py] = project(global, a.x, a.y)
      const guess: Point = [px + offsets[k][0], py + offsets[k][1]]
      let hit: Point | null = null
      if (this.useAlignment) {
        const px2 = size * cellPx
        const half = Math.ceil(px2 * 1.3)
        const x0 = Math.max(0, Math.round(guess[0] - half))
        const y0 = Math.max(0, Math.round(guess[1] - half))
        const x1 = Math.min(src.width, Math.round(guess[0] + half))
        const y1 = Math.min(src.height, Math.round(guess[1] + half))
        if (x1 - x0 >= 8 && y1 - y0 >= 8 && px2 >= 5) {
          const r = refineMarker(src.region(x0, y0, x1 - x0, y1 - y0), x1 - x0, y1 - y0, [guess[0] - x0, guess[1] - y0], px2, 1, 0.5)
          if (r) hit = [r.x + x0, r.y + y0]
        }
      }
      if (hit) {
        found++
        offsets[k] = [hit[0] - px, hit[1] - py]
        nodes[a.row * cols + a.col] = hit
      } else {
        nodes[a.row * cols + a.col] = [px, py]
      }
    })
    this.offsets.set(key, offsets)

    if (!this.useAlignment || found === 0) {
      return { patches: [{ h: global, x0: 0, y0: 0, x1: layout.w, y1: layout.h }], nodes: nodes.filter((_, i) => !isCorner(i, rows, cols)), found, total: alignments.length }
    }

    const patches: Patch[] = []
    for (let i = 0; i < rows - 1; i++) {
      for (let j = 0; j < cols - 1; j++) {
        const at = (r: number, c: number) => code[r * cols + c]
        const src4: Point[] = [at(i, j), at(i, j + 1), at(i + 1, j + 1), at(i + 1, j)]
        const dst4: Point[] = [nodes[i * cols + j], nodes[i * cols + j + 1], nodes[(i + 1) * cols + j + 1], nodes[(i + 1) * cols + j]]
        const h = homography(src4, dst4) ?? global
        patches.push({
          h,
          x0: j === 0 ? 0 : Math.round(xs[j]),
          x1: j === cols - 2 ? layout.w : Math.round(xs[j + 1]),
          y0: i === 0 ? 0 : Math.round(ys[i]),
          y1: i === rows - 2 ? layout.h : Math.round(ys[i + 1]),
        })
      }
    }
    return { patches, nodes: nodes.filter((_, i) => !isCorner(i, rows, cols)), found, total: alignments.length }
  }
}

function isCorner(index: number, rows: number, cols: number) {
  const i = Math.floor(index / cols)
  const j = index % cols
  return (i === 0 || i === rows - 1) && (j === 0 || j === cols - 1)
}
