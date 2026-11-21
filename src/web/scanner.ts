import { crc32, estimatePackets, FrameReport, Receiver, unpackSource } from '../core'
import { inflate } from './compress'
import { CameraControl, CameraState } from './camera-control'
import { GlSource } from './gl-source'
import { allowSleep, keepAwake } from './wake-lock'

export interface ScanStats {
  report: FrameReport
  frames: number
  trackedFrames: number
  validPackets: number
  expectedPackets: number
  known: number
  received: number
  needed: number
  blockCount: number
  blockSize: number
  elapsed: number
  processMs: number
  camera: CameraState | null
  fps: FpsInfo
}

export interface ReceivedFile {
  name: string
  data: Uint8Array
  valid: boolean
  seconds: number
}

type FrameMeta = { presentedFrames?: number }
type VideoWithCallback = HTMLVideoElement & { requestVideoFrameCallback?: (cb: (now: number, meta: FrameMeta) => void) => number }

export interface FpsInfo {
  requested: number
  reported: number | null
  camera: number
  processed: number
  width: number
  height: number
}

export type ScanErrorCode = 'no-camera' | 'no-webgl' | 'camera-denied' | 'camera-not-found' | 'camera-busy' | 'unknown'

/** Thrown by {@link Scanner.start}. `code` is stable, `message` is English and meant for logs. */
export class ScanError extends Error {
  constructor(
    readonly code: ScanErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'ScanError'
  }
}

export class Scanner {
  private receiver = new Receiver()
  private gl: GlSource | null = null
  private stream: MediaStream | null = null
  private frames = 0
  private tracked = 0
  private startedAt = 0
  private processMs = 0
  private delivered = false
  camera: CameraControl | null = null
  autoZoom = true
  lockExposure = true
  frameRate = 30
  private fps: FpsInfo = { requested: 30, reported: null, camera: 0, processed: 0, width: 0, height: 0 }
  private window = { start: 0, presented: 0, processed: 0, frames: 0 }

  constructor(
    private video: VideoWithCallback,
    private onStats: (s: ScanStats) => void,
    private onFile: (f: ReceivedFile) => void,
  ) {}

  get active() {
    return !!this.stream
  }

  async start() {
    if (!navigator.mediaDevices?.getUserMedia) throw new ScanError('no-camera', 'Camera is not available. Open this page over HTTPS or on localhost.')
    if (!GlSource.supported()) throw new ScanError('no-webgl', 'This browser does not support WebGL2.')
    this.gl ??= new GlSource()
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1920 }, frameRate: { ideal: this.frameRate } },
      })
    } catch (e) {
      const name = (e as Error)?.name
      const code: ScanErrorCode =
        name === 'NotAllowedError' || name === 'SecurityError' ? 'camera-denied'
        : name === 'NotFoundError' || name === 'OverconstrainedError' ? 'camera-not-found'
        : name === 'NotReadableError' || name === 'AbortError' ? 'camera-busy'
        : 'unknown'
      throw new ScanError(code, (e as Error)?.message || String(e))
    }
    const track = this.stream.getVideoTracks()[0]
    try {
      const caps = (track.getCapabilities?.() ?? {}) as { focusMode?: string[] }
      if (caps.focusMode?.includes('continuous')) await track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] })
    } catch {}
    const settings = track.getSettings()
    this.fps = { requested: this.frameRate, reported: settings.frameRate ?? null, camera: 0, processed: 0, width: settings.width ?? 0, height: settings.height ?? 0 }
    this.window = { start: 0, presented: 0, processed: 0, frames: 0 }
    this.camera = new CameraControl(track)
    this.camera.autoZoom = this.autoZoom
    this.camera.lockExposure = this.lockExposure
    this.video.srcObject = this.stream
    await this.video.play()
    keepAwake()
    this.loop()
  }

  stop() {
    this.stream?.getTracks().forEach((t) => t.stop())
    this.stream = null
    this.camera = null
    allowSleep()
  }

  reset() {
    this.receiver.reset()
    this.frames = 0
    this.tracked = 0
    this.startedAt = 0
    this.processMs = 0
    this.delivered = false
    this.camera?.reset()
  }

  get resolution() {
    return [this.video.videoWidth, this.video.videoHeight]
  }

  private measure(now: number, meta?: FrameMeta) {
    const win = this.window
    if (!win.start) {
      win.start = now
      win.presented = meta?.presentedFrames ?? 0
      win.processed = this.frames
      win.frames = 0
      return
    }
    win.frames++
    const dt = (now - win.start) / 1000
    if (dt < 1) return
    const presented = meta?.presentedFrames
    this.fps.camera = presented !== undefined ? (presented - win.presented) / dt : win.frames / dt
    this.fps.processed = (this.frames - win.processed) / dt
    this.fps.width = this.video.videoWidth
    this.fps.height = this.video.videoHeight
    win.start = now
    win.presented = presented ?? 0
    win.processed = this.frames
    win.frames = 0
  }

  private loop = (now = performance.now(), meta?: FrameMeta) => {
    if (!this.stream) return
    this.measure(now, meta)
    const { videoWidth: w, videoHeight: h } = this.video
    if (w && h && this.gl) {
      const t0 = performance.now()
      this.gl.update(this.video, w, h)
      const report = this.receiver.process(this.gl)
      const ms = performance.now() - t0
      this.processMs = this.frames ? this.processMs * 0.9 + ms * 0.1 : ms
      this.frames++
      if (report.tracked) this.tracked++
      if (report.packets && !this.startedAt) this.startedAt = performance.now()
      const rate = report.expected ? report.packets / report.expected : 0
      this.camera?.update(report, w, h, rate)
      this.emit(report)
    }
    if (this.video.requestVideoFrameCallback) this.video.requestVideoFrameCallback(this.loop)
    else requestAnimationFrame((t) => this.loop(t))
  }

  private emit(report: FrameReport) {
    const d = this.receiver.decoder
    const elapsed = this.startedAt ? (performance.now() - this.startedAt) / 1000 : 0
    this.onStats({
      report,
      frames: this.frames,
      trackedFrames: this.tracked,
      validPackets: this.receiver.validPackets,
      expectedPackets: this.receiver.expectedPackets,
      known: d?.known ?? 0,
      received: d?.received ?? 0,
      needed: d ? Math.max(estimatePackets(d.blockCount), d.received) : 0,
      blockCount: d?.blockCount ?? 0,
      blockSize: d?.blockSize ?? 0,
      elapsed,
      processMs: this.processMs,
      camera: this.camera?.state ?? null,
      fps: this.fps,
    })
    if (d?.done && !this.delivered) {
      this.delivered = true
      this.finish(d.result(), elapsed)
    }
  }

  private async finish(source: Uint8Array, seconds: number) {
    const info = unpackSource(source)
    const data = info.compressed ? await inflate(info.payload) : info.payload.slice()
    this.onFile({ name: info.name, data, valid: data.length === info.originalSize && crc32(data) === info.originalCrc, seconds })
  }
}
