import { FrameReport } from '../core'
import { AutoZoom } from './auto-zoom'

type Caps = MediaTrackCapabilities & {
  zoom?: { min: number; max: number; step: number }
  exposureMode?: string[]
  whiteBalanceMode?: string[]
  exposureTime?: { min: number; max: number }
  colorTemperature?: { min: number; max: number }
}

type Settings = MediaTrackSettings & { zoom?: number; exposureTime?: number; colorTemperature?: number }

const MAX_AUTO_ZOOM = 3

export interface CameraState {
  zoom: number | null
  zoomSupported: boolean
  exposureLocked: boolean
}

export class CameraControl {
  autoZoom = true
  lockExposure = true
  private zoomer: AutoZoom | null = null
  private caps: Caps
  private locked = false
  private goodSince = 0
  private lostSince = 0
  private busy = false

  constructor(private track: MediaStreamTrack) {
    this.caps = (track.getCapabilities?.() ?? {}) as Caps
    const z = this.caps.zoom
    if (z && z.max > z.min) {
      const current = (track.getSettings() as Settings).zoom ?? z.min
      this.zoomer = new AutoZoom({ min: z.min, max: Math.min(z.max, MAX_AUTO_ZOOM), step: z.step || 0.1 }, current)
    }
  }

  get state(): CameraState {
    return { zoom: this.zoomer?.zoom ?? null, zoomSupported: !!this.zoomer, exposureLocked: this.locked }
  }

  update(report: FrameReport, frameW: number, frameH: number, validRate: number) {
    const now = performance.now()
    if (this.zoomer && this.autoZoom && !this.busy) {
      const z = this.zoomer.next({ now, locked: !!report.lock, cellPx: report.cellPx ?? null, corners: report.corners, frameW, frameH })
      if (z !== null) this.apply({ zoom: z })
    }
    this.updateExposure(report, now, validRate)
  }

  reset() {
    this.goodSince = 0
    this.lostSince = 0
    if (this.locked) this.unlock()
  }

  private updateExposure(report: FrameReport, now: number, validRate: number) {
    if (!this.lockExposure) {
      if (this.locked) this.unlock()
      return
    }
    const good = !!report.lock && report.packets > 0 && validRate > 0.6
    if (good) {
      this.lostSince = 0
      this.goodSince ||= now
      if (!this.locked && now - this.goodSince > 1000) this.lock()
    } else {
      this.goodSince = 0
      if (!report.lock) {
        this.lostSince ||= now
        if (this.locked && now - this.lostSince > 2000) this.unlock()
      }
    }
  }

  private lock() {
    const s = this.track.getSettings() as Settings
    const set: Record<string, unknown> = {}
    if (this.caps.exposureMode?.includes('manual') && s.exposureTime) Object.assign(set, { exposureMode: 'manual', exposureTime: s.exposureTime })
    else if (this.caps.exposureMode?.includes('single-shot')) set.exposureMode = 'single-shot'
    if (this.caps.whiteBalanceMode?.includes('manual') && s.colorTemperature) Object.assign(set, { whiteBalanceMode: 'manual', colorTemperature: s.colorTemperature })
    else if (this.caps.whiteBalanceMode?.includes('single-shot')) set.whiteBalanceMode = 'single-shot'
    if (!Object.keys(set).length) return
    this.locked = true
    this.apply(set)
  }

  private unlock() {
    this.locked = false
    const set: Record<string, unknown> = {}
    if (this.caps.exposureMode?.includes('continuous')) set.exposureMode = 'continuous'
    if (this.caps.whiteBalanceMode?.includes('continuous')) set.whiteBalanceMode = 'continuous'
    if (Object.keys(set).length) this.apply(set)
  }

  private async apply(set: Record<string, unknown>) {
    this.busy = true
    try {
      await this.track.applyConstraints({ advanced: [set as MediaTrackConstraintSet] })
    } catch {}
    this.busy = false
  }
}
