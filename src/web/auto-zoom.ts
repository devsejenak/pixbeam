import type { Point } from '../core'
export type { Point }

export interface ZoomInput {
  now: number
  locked: boolean
  cellPx: number | null
  corners: Point[] | null
  frameW: number
  frameH: number
}

export interface ZoomRange {
  min: number
  max: number
  step: number
}

export class AutoZoom {
  target = 6
  cooldown = 800
  lostDelay = 1500
  zoom: number
  private lastChange = -Infinity
  private lastSeen = 0
  private unlockedSince = 0

  constructor(readonly range: ZoomRange, initial = range.min) {
    this.zoom = initial
  }

  next(input: ZoomInput): number | null {
    const { now, corners } = input
    if (corners) this.lastSeen = now
    if (input.locked || !corners) this.unlockedSince = 0
    else this.unlockedSince ||= now
    if (now - this.lastChange < this.cooldown) return null

    let factor = 1
    if (!corners) {
      if (now - this.lastSeen < this.lostDelay || this.zoom <= this.range.min) return null
      factor = 1 / 1.25
    } else {
      const cx = input.frameW / 2
      const cy = input.frameH / 2
      const reach = Math.max(...corners.map(([x, y]) => Math.max(Math.abs(x - cx) / cx, Math.abs(y - cy) / cy)))
      if (reach > 0.9) factor = 1 / 1.12
      else if (!input.locked && this.unlockedSince && now - this.unlockedSince > 600 && reach < 0.8) factor = Math.min(1.25, 0.85 / reach)
      else if (input.locked && input.cellPx && input.cellPx < this.target * 0.9) factor = Math.max(1, Math.min(this.target / input.cellPx, 0.85 / reach, 1.3))
      else return null
    }

    const z = this.clamp(this.zoom * factor)
    if (Math.abs(z - this.zoom) < Math.max(this.range.step, 0.04)) return null
    this.zoom = z
    this.lastChange = now
    return z
  }

  private clamp(z: number) {
    const { min, max, step } = this.range
    const snapped = step > 0 ? Math.round(z / step) * step : z
    return Math.min(max, Math.max(min, Number(snapped.toFixed(3))))
  }
}
