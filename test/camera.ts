import { homography } from '../src/core'

export interface CameraOptions {
  width: number
  height: number
  fill: number
  skew: number
  offset: [number, number]
  noise: number
  blur: boolean
  gain: [number, number, number]
  distortion?: number
}

export function shoot(code: Uint8ClampedArray, cw: number, ch: number, o: CameraOptions): Uint8ClampedArray {
  const { width: w, height: h } = o
  const sw = w * o.fill
  const sh = (sw * ch) / cw
  const cx = w / 2 + o.offset[0]
  const cy = h / 2 + o.offset[1]
  const k = o.skew
  const dst: [number, number][] = [[cx - sw / 2 + k, cy - sh / 2], [cx + sw / 2 - k, cy - sh / 2 + k], [cx + sw / 2 + k * 0.5, cy + sh / 2], [cx - sw / 2, cy + sh / 2 - k]]
  const inv = homography(dst, [[0, 0], [cw, 0], [cw, ch], [0, ch]])!
  const out = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let px = x
      let py = y
      if (o.distortion) {
        const nx = (x - w / 2) / (w / 2)
        const ny = (y - h / 2) / (w / 2)
        const f = 1 + o.distortion * (nx * nx + ny * ny)
        px = w / 2 + nx * f * (w / 2)
        py = h / 2 + ny * f * (w / 2)
      }
      const d = inv[6] * px + inv[7] * py + 1
      const u = (inv[0] * px + inv[1] * py + inv[2]) / d
      const v = (inv[3] * px + inv[4] * py + inv[5]) / d
      let r = 25, g = 22, b = 30
      if (u >= 0 && v >= 0 && u < cw && v < ch) {
        const i = (Math.floor(v) * cw + Math.floor(u)) * 4
        const R = code[i], G = code[i + 1], B = code[i + 2]
        const vig = 1 - 0.25 * (((x - w / 2) / w) ** 2 + ((y - h / 2) / h) ** 2) * 4
        r = 30 + (0.85 * R + 0.1 * G + 0.05 * B) * o.gain[0] * 0.75 * vig
        g = 30 + (0.1 * R + 0.8 * G + 0.1 * B) * o.gain[1] * 0.75 * vig
        b = 35 + (0.05 * R + 0.15 * G + 0.8 * B) * o.gain[2] * 0.75 * vig
      }
      const p = (y * w + x) * 4
      out[p] = r + (Math.random() - 0.5) * o.noise
      out[p + 1] = g + (Math.random() - 0.5) * o.noise
      out[p + 2] = b + (Math.random() - 0.5) * o.noise
      out[p + 3] = 255
    }
  }
  if (!o.blur) return out
  const src = new Uint8ClampedArray(out)
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      for (let c = 0; c < 3; c++) {
        let s = 0
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += src[((y + dy) * w + x + dx) * 4 + c]
        out[(y * w + x) * 4 + c] = s / 9
      }
    }
  }
  return out
}
