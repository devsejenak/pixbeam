import { Bits, encodeFrame, FountainEncoder, getLayout, Layout, packSource, PacketSource, Preset, renderFrame, TestPattern } from '../core'
import { deflate } from './compress'
import { allowSleep, keepAwake } from './wake-lock'

export type Orientation = 'portrait' | 'landscape'

export interface SendInfo {
  name: string
  originalSize: number
  packedSize: number
  compressed: boolean
  layout: Layout
  blockCount: number
  frames: number
}

export class Sender {
  info: SendInfo | null = null
  fps = 15
  orientation: Orientation = 'portrait'
  private encoder: PacketSource | null = null
  private buffer = document.createElement('canvas')
  private image: ImageData | null = null
  private raf = 0
  private last = 0
  private shown: number[] = []
  actualFps = 0

  constructor(private canvas: HTMLCanvasElement, private onFrame: (info: SendInfo) => void) {}

  get running() {
    return !!this.raf
  }

  async start(name: string, bytes: Uint8Array, preset: Preset, bits: Bits) {
    this.stop()
    const packed = await deflate(bytes)
    const compressed = !!packed && packed.length < bytes.length
    const source = packSource(name, compressed ? packed! : bytes, compressed, bytes)
    const layout = this.layoutFor(preset, bits)
    const encoder = new FountainEncoder(source, layout.packetSize)
    this.begin(layout, encoder, { name, originalSize: bytes.length, packedSize: source.length, compressed, layout, blockCount: encoder.blockCount, frames: 0 })
  }

  startTestPattern(preset: Preset, bits: Bits) {
    this.stop()
    const layout = this.layoutFor(preset, bits)
    this.begin(layout, new TestPattern(), { name: 'pola uji', originalSize: 0, packedSize: 0, compressed: false, layout, blockCount: 0, frames: 0 })
  }

  private layoutFor(preset: Preset, bits: Bits) {
    return getLayout(preset, bits, this.orientation === 'portrait' ? 'cols' : 'rows')
  }

  private begin(layout: Layout, encoder: PacketSource, info: SendInfo) {
    this.encoder = encoder
    this.buffer.width = layout.totalW
    this.buffer.height = layout.totalH
    this.image = new ImageData(layout.totalW, layout.totalH)
    this.info = info
    this.fit()
    keepAwake()
    this.raf = requestAnimationFrame(this.tick)
  }

  stop() {
    cancelAnimationFrame(this.raf)
    this.raf = 0
    allowSleep()
  }

  fit() {
    if (!this.info) return
    const portrait = this.orientation === 'portrait'
    const { totalW, totalH } = this.info.layout
    const [w, h] = portrait ? [totalH, totalW] : [totalW, totalH]
    const box = this.canvas.parentElement!.getBoundingClientRect()
    const dpr = devicePixelRatio || 1
    const k = Math.max(1, Math.floor(Math.min((box.width * dpr) / w, (box.height * dpr) / h)))
    this.canvas.width = w * k
    this.canvas.height = h * k
    this.canvas.style.width = `${(w * k) / dpr}px`
    this.canvas.style.height = `${(h * k) / dpr}px`
  }

  private draw() {
    const ctx = this.canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    if (this.orientation === 'portrait') {
      ctx.setTransform(0, 1, -1, 0, this.canvas.width, 0)
      ctx.drawImage(this.buffer, 0, 0, this.canvas.height, this.canvas.width)
      ctx.setTransform(1, 0, 0, 1, 0, 0)
    } else ctx.drawImage(this.buffer, 0, 0, this.canvas.width, this.canvas.height)
  }

  private tick = (t: number) => {
    if (!this.raf || !this.info || !this.encoder || !this.image) return
    const interval = 1000 / this.fps
    if (t - this.last >= interval - 3) {
      this.last = t - this.last < interval * 2 ? this.last + interval : t
      this.shown.push(t)
      while (this.shown.length && t - this.shown[0] > 1000) this.shown.shift()
      this.actualFps = this.shown.length
      renderFrame(this.info.layout, encodeFrame(this.info.layout, this.encoder), this.image.data)
      this.buffer.getContext('2d')!.putImageData(this.image, 0, 0)
      this.draw()
      this.info.frames++
      this.onFrame(this.info)
    }
    this.raf = requestAnimationFrame(this.tick)
  }
}
