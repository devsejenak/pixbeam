import { ErrorMap, ErrorSummary, FrameReport, Layout } from '../core'

const NAMES: Record<number, string[]> = {
  3: ['hitam', 'biru', 'hijau', 'cyan', 'merah', 'magenta', 'kuning', 'putih'],
  2: ['putih', 'merah', 'hijau', 'biru'],
  1: ['hitam', 'putih'],
}

const pct = (v: number, digits = 2) => `${(v * 100).toFixed(digits)}%`

function heatColor(rate: number): [number, number, number] {
  const t = Math.min(1, Math.sqrt(rate / 0.25))
  if (t < 0.5) {
    const k = t / 0.5
    return [40 + 210 * k, 40 + 170 * k, 40 - 20 * k]
  }
  const k = (t - 0.5) / 0.5
  return [250, 210 - 190 * k, 20]
}

export class DebugPanel {
  enabled = false
  private map: ErrorMap | null = null
  private lastSummary: ErrorSummary | null = null
  private portrait = false
  private frames = 0

  constructor(
    private root: HTMLElement,
    private canvas: HTMLCanvasElement,
    private text: HTMLElement,
  ) {}

  setEnabled(on: boolean) {
    this.enabled = on
    this.root.hidden = !on
  }

  reset() {
    this.map = null
    this.lastSummary = null
    this.frames = 0
    this.text.textContent = 'Menunggu frame terkunci…'
    this.canvas.getContext('2d')?.clearRect(0, 0, this.canvas.width, this.canvas.height)
  }

  update(report: FrameReport) {
    if (!this.enabled || !report.decoded || !report.layout) return
    if (!this.map || this.map.layout !== report.layout) this.map = new ErrorMap(report.layout)
    this.portrait = report.layout.order === 'cols'
    this.map.add(report.decoded)
    if (++this.frames % 4 === 1) this.render()
  }

  copyReport(): string {
    if (!this.map || !this.lastSummary) return ''
    const l = this.map.layout
    return JSON.stringify({ grid: `${l.w}x${l.h}`, colors: l.palette.length, order: l.order, ...this.lastSummary }, null, 2)
  }

  private render() {
    const map = this.map!
    const layout: Layout = map.layout
    const { w, h } = layout
    const [cw, ch] = this.portrait ? [h, w] : [w, h]
    if (this.canvas.width !== cw || this.canvas.height !== ch) {
      this.canvas.width = cw
      this.canvas.height = ch
    }
    const ctx = this.canvas.getContext('2d')!
    const img = ctx.createImageData(cw, ch)
    const isData = new Uint8Array(w * h)
    for (const idx of layout.dataCells) isData[idx] = 1
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        const idx = r * w + c
        const [x, y] = this.portrait ? [h - 1 - r, c] : [c, r]
        const o = (y * cw + x) * 4
        const col = isData[idx] ? (map.samples[idx] ? heatColor(map.rate(idx)) : [30, 30, 30]) : [90, 90, 90]
        img.data[o] = col[0]
        img.data[o + 1] = col[1]
        img.data[o + 2] = col[2]
        img.data[o + 3] = 255
      }
    }
    ctx.putImageData(img, 0, 0)

    const names = NAMES[layout.palette.length === 8 ? 3 : layout.palette.length === 4 ? 2 : 1]
    const s = map.summary(names)
    this.lastSummary = s
    const confusions = s.mode === 'exact' && s.confusions.length
      ? s.confusions.map((c) => `${names[c.from]}→${names[c.to]} ${pct(c.rate, 1)}`).join(' · ')
      : '-'
    this.text.innerHTML = [
      `<div><span>Mode</span><b>${s.mode === 'exact' ? 'pola uji (per sel)' : 'per paket (perkiraan)'}</b></div>`,
      `<div><span>Error sel</span><b>${pct(s.cellErrorRate, 3)}</b></div>`,
      `<div><span>Tengah / tepi</span><b>${pct(s.centerRate)} / ${pct(s.edgeRate)}</b></div>`,
      `<div><span>Arah geser</span><b>${s.mode === 'exact' ? s.directionBias.toFixed(2) : '-'}</b></div>`,
      `<div class="wide"><span>Tertukar</span><b>${confusions}</b></div>`,
      `<p>${s.hint}</p>`,
    ].join('')
  }
}
