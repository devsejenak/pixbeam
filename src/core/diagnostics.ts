import { HEADER_SIZE } from './constants'
import { DecodeResult } from './decode'
import { Layout } from './layout'
import { encodeFrame, PacketSource } from './packets'
import { mulberry32 } from './prng'
import { bytesToSymbols } from './symbols'

export const TEST_FILE_ID = 0xdeb06000

export class TestPattern implements PacketSource {
  readonly fileId = TEST_FILE_ID
  readonly totalSize = 0

  constructor(private seed = 1) {}

  next(out: Uint8Array): number {
    const seed = this.seed++
    const rnd = mulberry32(seed * 2654435761)
    for (let i = 0; i < out.length; i++) out[i] = (rnd() * 256) | 0
    return seed
  }
}

export type ErrorMode = 'exact' | 'packet'

/** Text used to build the human readable hint in {@link ErrorSummary}. */
export interface DiagnosticHints {
  /** Row names, top to bottom. */
  rows: [string, string, string]
  /** Column names, left to right. */
  cols: [string, string, string]
  area: (row: string, col: string) => string
  clean: string
  geometry: string
  cluster: (times: string) => string
  edge: string
  center: string
  spread: string
  worstArea: (area: string) => string
  someArea: (area: string) => string
  confusion: (from: string, to: string) => string
  usePattern: string
}

export const defaultDiagnosticHints: DiagnosticHints = {
  rows: ['top', 'middle', 'bottom'],
  cols: ['left', 'center', 'right'],
  area: (row, col) => `${row} ${col}`,
  clean: 'Almost no errors. You can raise the grid size or the fps.',
  geometry: 'Errors are cells shifted the same way in each area: a geometry problem, such as lens distortion or imprecise markers. More alignment markers would help.',
  cluster: (times) => `Errors gather in one area (${times}× the average): usually glare, an out-of-focus spot, or local distortion. Check its shape on the map.`,
  edge: 'Errors pile up at the edges: likely lens distortion or darker screen edges.',
  center: 'Errors pile up in the center: likely glare, focus, or an uneven screen.',
  spread: 'Errors are spread evenly: more likely a color problem, blur, or cells that are too small.',
  worstArea: (area) => `Worst area: ${area}.`,
  someArea: (area) => `Area: ${area}.`,
  confusion: (from, to) => `Most often swapped colors: ${from} read as ${to}.`,
  usePattern: 'For an accurate per-cell map, turn on the test pattern on the sender.',
}

export interface ErrorSummary {
  mode: ErrorMode
  frames: number
  measuredFrames: number
  cellErrorRate: number
  shiftShare: number
  directionBias: number
  concentration: number
  centerRate: number
  edgeRate: number
  worstRegion: string
  confusions: { from: number; to: number; rate: number }[]
  hint: string
}

export class ErrorMap {
  readonly errors: Uint32Array
  readonly samples: Uint32Array
  readonly confusion: Uint32Array
  private shiftErrors = 0
  private totalErrors = 0
  private directions = new Uint32Array(9 * 4)
  private expectedGrid: Int16Array
  frames = 0
  measuredFrames = 0
  mode: ErrorMode = 'packet'

  constructor(readonly layout: Layout) {
    this.errors = new Uint32Array(layout.w * layout.h)
    this.samples = new Uint32Array(layout.w * layout.h)
    const m = layout.palette.length
    this.confusion = new Uint32Array(m * m)
    this.expectedGrid = new Int16Array(layout.w * layout.h)
  }

  add(result: DecodeResult) {
    this.frames++
    const test = result.packets.find((p) => p.fileId === TEST_FILE_ID)
    if (test) this.addExact(result, test.seed - test.index)
    else this.addPacketLevel(result)
  }

  rate(idx: number) {
    return this.samples[idx] ? this.errors[idx] / this.samples[idx] : 0
  }

  summary(names: string[], hints: DiagnosticHints = defaultDiagnosticHints): ErrorSummary {
    const { w, h, dataCells } = this.layout
    let err = 0
    let tot = 0
    const region = { center: [0, 0], edge: [0, 0] }
    const areas: Record<string, [number, number]> = {}
    for (const idx of dataCells) {
      const c = idx % w
      const r = (idx / w) | 0
      err += this.errors[idx]
      tot += this.samples[idx]
      const nx = c / (w - 1)
      const ny = r / (h - 1)
      const inner = nx > 0.25 && nx < 0.75 && ny > 0.25 && ny < 0.75
      const bucket = inner ? region.center : region.edge
      bucket[0] += this.errors[idx]
      bucket[1] += this.samples[idx]
      const key = hints.area(hints.rows[ny < 1 / 3 ? 0 : ny < 2 / 3 ? 1 : 2], hints.cols[nx < 1 / 3 ? 0 : nx < 2 / 3 ? 1 : 2])
      const a = (areas[key] ??= [0, 0])
      a[0] += this.errors[idx]
      a[1] += this.samples[idx]
    }
    const pct = (a: number[]) => (a[1] ? a[0] / a[1] : 0)
    const worst = Object.entries(areas).sort((a, b) => pct(b[1]) - pct(a[1]))[0]
    const concentration = worst && tot && err ? pct(worst[1]) / (err / tot) : 0
    const m = this.layout.palette.length
    const confusions: ErrorSummary['confusions'] = []
    for (let from = 0; from < m; from++) {
      let row = 0
      for (let to = 0; to < m; to++) row += this.confusion[from * m + to]
      for (let to = 0; to < m; to++) {
        if (to === from || !row) continue
        const rate = this.confusion[from * m + to] / row
        if (rate > 0) confusions.push({ from, to, rate })
      }
    }
    confusions.sort((a, b) => b.rate - a.rate)
    const cellErrorRate = tot ? err / tot : 0
    const shiftShare = this.totalErrors ? this.shiftErrors / this.totalErrors : 0
    let dominant = 0
    let matched = 0
    for (let a = 0; a < 9; a++) {
      const d = this.directions.subarray(a * 4, a * 4 + 4)
      dominant += Math.max(...d)
      matched += d[0] + d[1] + d[2] + d[3]
    }
    const directionBias = matched > 20 ? dominant / matched : 0
    const centerRate = pct(region.center)
    const edgeRate = pct(region.edge)
    return {
      mode: this.mode,
      frames: this.frames,
      measuredFrames: this.measuredFrames,
      cellErrorRate,
      shiftShare,
      directionBias,
      concentration,
      centerRate,
      edgeRate,
      worstRegion: worst ? worst[0] : '-',
      confusions: confusions.slice(0, 3),
      hint: hintFor(this.mode, cellErrorRate, directionBias, concentration, centerRate, edgeRate, worst ? worst[0] : '', confusions, names, hints),
    }
  }

  private addExact(result: DecodeResult, firstSeed: number) {
    this.mode = 'exact'
    this.measuredFrames++
    const { layout } = this
    const expected = bytesToSymbols(encodeFrame(layout, new TestPattern(firstSeed)), layout.bits, layout.cellCount)
    const m = layout.palette.length
    const n = result.symbols.length
    const { w } = layout
    const grid = this.expectedGrid
    grid.fill(-1)
    for (let s = 0; s < n; s++) grid[layout.dataCells[s]] = expected[s]
    for (let s = 0; s < n; s++) {
      const idx = layout.dataCells[s]
      const want = expected[s]
      const got = result.symbols[s]
      this.samples[idx]++
      this.confusion[want * m + got]++
      if (want === got) continue
      this.errors[idx]++
      this.totalErrors++
      const c = idx % w
      const r = (idx / w) | 0
      const area = Math.min(2, Math.floor((r * 3) / layout.h)) * 3 + Math.min(2, Math.floor((c * 3) / w))
      const hits = [c > 0 && grid[idx - 1] === got, c < w - 1 && grid[idx + 1] === got, grid[idx - w] === got, grid[idx + w] === got]
      if (hits.some(Boolean)) this.shiftErrors++
      hits.forEach((hit, d) => hit && this.directions[area * 4 + d]++)
    }
  }

  private addPacketLevel(result: DecodeResult) {
    if (this.mode === 'exact') return
    this.measuredFrames++
    const { layout } = this
    const stride = (HEADER_SIZE + layout.packetSize) * 8
    const ok = new Uint8Array(result.expected)
    for (const p of result.packets) ok[p.index] = 1
    for (let p = 0; p < result.expected; p++) {
      const a = Math.floor((p * stride) / layout.bits)
      const b = Math.min(layout.cellCount, Math.ceil(((p + 1) * stride) / layout.bits))
      for (let s = a; s < b; s++) {
        const idx = layout.dataCells[s]
        this.samples[idx]++
        if (!ok[p]) this.errors[idx]++
      }
    }
  }
}

function hintFor(
  mode: ErrorMode,
  total: number,
  bias: number,
  concentration: number,
  center: number,
  edge: number,
  worst: string,
  confusions: ErrorSummary['confusions'],
  names: string[],
  t: DiagnosticHints,
): string {
  if (total < 0.0005) return t.clean
  const parts: string[] = []
  if (mode === 'exact' && bias > 0.47) parts.push(t.geometry)
  else if (concentration > 2.5) parts.push(t.cluster(concentration.toFixed(1)))
  else if (edge > center * 2 && edge > 0.002) parts.push(t.edge)
  else if (center > edge * 2 && center > 0.002) parts.push(t.center)
  else parts.push(t.spread)
  if (worst && concentration <= 2.5) parts.push(t.worstArea(worst))
  else if (worst) parts.push(t.someArea(worst))
  const top = confusions[0]
  if (mode === 'exact' && bias <= 0.47 && top && top.rate > 0.01) parts.push(t.confusion(names[top.from], names[top.to]))
  if (mode === 'packet') parts.push(t.usePattern)
  return parts.join(' ')
}
