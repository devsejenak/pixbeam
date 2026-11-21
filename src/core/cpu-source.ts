import { Matrix3 } from './homography'
import { FrameSource, Patch } from './receiver'

const TAP = 0.22
const TAPS: [number, number][] = [[0, 0], [TAP, 0], [-TAP, 0], [0, TAP], [0, -TAP]]

export class CpuSource implements FrameSource {
  constructor(readonly rgba: Uint8Array | Uint8ClampedArray, readonly width: number, readonly height: number) {}

  small(maxWidth: number) {
    const scale = Math.max(1, Math.ceil(this.width / maxWidth))
    const w = Math.floor(this.width / scale)
    const h = Math.floor(this.height / scale)
    const out = new Uint8Array(w * h * 4)
    const n = scale * scale
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let r = 0
        let g = 0
        let b = 0
        for (let dy = 0; dy < scale; dy++) {
          for (let dx = 0; dx < scale; dx++) {
            const i = ((y * scale + dy) * this.width + x * scale + dx) * 4
            r += this.rgba[i]
            g += this.rgba[i + 1]
            b += this.rgba[i + 2]
          }
        }
        const o = (y * w + x) * 4
        out[o] = r / n
        out[o + 1] = g / n
        out[o + 2] = b / n
        out[o + 3] = 255
      }
    }
    return { data: out, w, h, scale }
  }

  region(x: number, y: number, w: number, h: number) {
    const out = new Uint8Array(w * h * 4)
    for (let r = 0; r < h; r++) out.set(this.rgba.subarray(((y + r) * this.width + x) * 4, ((y + r) * this.width + x + w) * 4), r * w * 4)
    return out
  }

  rectify(patches: Patch[], w: number, h: number) {
    const out = new Uint8Array(w * h * 4)
    for (const p of patches) this.rectifyPatch(out, p.h, w, p.x0, p.y0, p.x1, p.y1)
    return out
  }

  private rectifyPatch(out: Uint8Array, m: Matrix3, w: number, x0: number, y0: number, x1: number, y1: number) {
    for (let r = y0; r < y1; r++) {
      for (let c = x0; c < x1; c++) {
        let sr = 0
        let sg = 0
        let sb = 0
        for (const [du, dv] of TAPS) {
          const u = c + 0.5 + du
          const v = r + 0.5 + dv
          const d = m[6] * u + m[7] * v + m[8]
          const [pr, pg, pb] = this.bilinear((m[0] * u + m[1] * v + m[2]) / d, (m[3] * u + m[4] * v + m[5]) / d)
          sr += pr
          sg += pg
          sb += pb
        }
        const o = (r * w + c) * 4
        out[o] = sr / TAPS.length
        out[o + 1] = sg / TAPS.length
        out[o + 2] = sb / TAPS.length
        out[o + 3] = 255
      }
    }
  }

  private bilinear(x: number, y: number): [number, number, number] {
    const x0 = Math.max(0, Math.min(this.width - 1, Math.floor(x)))
    const y0 = Math.max(0, Math.min(this.height - 1, Math.floor(y)))
    const x1 = Math.min(this.width - 1, x0 + 1)
    const y1 = Math.min(this.height - 1, y0 + 1)
    const fx = Math.max(0, Math.min(1, x - x0))
    const fy = Math.max(0, Math.min(1, y - y0))
    const out: [number, number, number] = [0, 0, 0]
    for (let ch = 0; ch < 3; ch++) {
      const a = this.rgba[(y0 * this.width + x0) * 4 + ch]
      const b = this.rgba[(y0 * this.width + x1) * 4 + ch]
      const c = this.rgba[(y1 * this.width + x0) * 4 + ch]
      const d = this.rgba[(y1 * this.width + x1) * 4 + ch]
      out[ch] = (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy
    }
    return out
  }
}
