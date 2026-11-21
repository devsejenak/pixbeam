import { useEffect, useRef, useState } from 'react'
import { PixbeamConfig } from '../config'
import { PixbeamMessages } from '../i18n'
import { DebugPanel } from '../web/debug-panel'
import { ReceivedFile, ScanError, Scanner, ScanStats } from '../web/scanner'
import { formatBytes, formatTime, throttle } from './format'

interface Props {
  config: PixbeamConfig
  messages: PixbeamMessages
  active: boolean
}

interface Hud {
  status: string
  tone: '' | 'ok' | 'bad'
  progress: number
  packets: string
  blocks: string
  speed: string
  valid: string
  time: string
  ms: string
  camera: string
  process: string
  zoom: string
  align: string
  exposure: string
}

interface Result {
  name: string
  size: number
  valid: boolean
  seconds: number
  url: string
  text: string | null
}

const emptyHud = (m: PixbeamMessages): Hud => ({
  status: m.receive.searching, tone: '', progress: 0, packets: '0 / -', blocks: '-', speed: '-', valid: '-',
  time: '-', ms: '-', camera: '-', process: '-', zoom: '-', align: '-', exposure: m.receive.exposureAuto,
})

const TEXT_FILE = /\.(txt|md|json|csv|js|ts|html|css|xml|log)$/i

function drawOverlay(canvas: HTMLCanvasElement, video: HTMLVideoElement, stats: ScanStats) {
  const dpr = devicePixelRatio || 1
  const cw = canvas.clientWidth
  const ch = canvas.clientHeight
  if (canvas.width !== Math.round(cw * dpr)) canvas.width = Math.round(cw * dpr)
  if (canvas.height !== Math.round(ch * dpr)) canvas.height = Math.round(ch * dpr)
  const ctx = canvas.getContext('2d')!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, cw, ch)
  const corners = stats.report.corners
  const vw = video.videoWidth
  const vh = video.videoHeight
  if (!corners || !vw) return
  const scale = Math.max(cw / vw, ch / vh)
  const ox = (cw - vw * scale) / 2
  const oy = (ch - vh * scale) / 2
  const map = ([x, y]: [number, number]) => [x * scale + ox, y * scale + oy]
  ctx.strokeStyle = ctx.fillStyle = stats.report.packets ? '#4ade80' : '#ffffff'
  ctx.lineWidth = 2
  ctx.beginPath()
  corners.map(map).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
  ctx.closePath()
  ctx.stroke()
  for (const [x, y] of corners.map(map)) {
    ctx.beginPath()
    ctx.arc(x, y, 5, 0, Math.PI * 2)
    ctx.fill()
  }
  for (const [x, y] of (stats.report.alignment?.nodes ?? []).map(map)) {
    ctx.beginPath()
    ctx.arc(x, y, 3, 0, Math.PI * 2)
    ctx.fill()
  }
}

function toHud(s: ScanStats, m: PixbeamMessages): Hud {
  const { report, fps, camera } = s
  const t = m.receive
  const hud = emptyHud(m)
  if (!report.corners) hud.status = t.searchingCorners
  else if (!report.lock) hud.status = t.matching
  else {
    hud.status = t.locked(report.lock.preset.w, report.lock.preset.h, 2 ** report.lock.bits)
    hud.tone = 'ok'
  }
  hud.ms = `${Math.round(s.processMs)} ${t.msPerFrame}`
  hud.valid = s.expectedPackets ? `${Math.round((s.validPackets / s.expectedPackets) * 100)}%` : '-'
  if (fps.camera) {
    hud.camera = `${fps.width}×${fps.height} · ${Math.round(fps.camera)} fps`
    hud.process = `${Math.round(fps.processed)} fps`
  }
  hud.zoom = camera?.zoomSupported ? `${camera.zoom!.toFixed(1)}×` : t.none
  hud.align = report.alignment ? `${report.alignment.found}/${report.alignment.total}` : '-'
  hud.exposure = camera?.exposureLocked ? t.exposureLocked : t.exposureAuto
  if (s.blockCount) {
    hud.progress = Math.min(99, (s.received / s.needed) * 100)
    hud.packets = `${s.received.toLocaleString(m.numberLocale)} / ±${s.needed.toLocaleString(m.numberLocale)}`
    hud.blocks = `${s.known}/${s.blockCount}`
    hud.speed = s.elapsed > 0 ? `${formatBytes(Math.round((s.received * s.blockSize) / s.elapsed))}/s` : '-'
    hud.time = formatTime(s.elapsed, m.time)
  }
  return hud
}

export function ReceiveView({ config, messages: m, active }: Props) {
  const t = m.receive
  const mRef = useRef(m)
  mRef.current = m
  const videoRef = useRef<HTMLVideoElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const debugRootRef = useRef<HTMLDivElement>(null)
  const heatmapRef = useRef<HTMLCanvasElement>(null)
  const debugInfoRef = useRef<HTMLDivElement>(null)
  const scannerRef = useRef<Scanner | null>(null)
  const debugRef = useRef<DebugPanel | null>(null)
  const doneRef = useRef(false)
  const [open, setOpen] = useState(false)
  const [autoZoom, setAutoZoom] = useState(config.autoZoom)
  const [lockExposure, setLockExposure] = useState(config.lockExposure)
  const [hud, setHud] = useState<Hud>(() => emptyHud(m))
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState('')

  useEffect(() => {
    const tick = throttle(150)
    const onStats = (s: ScanStats) => {
      drawOverlay(overlayRef.current!, videoRef.current!, s)
      debugRef.current?.update(s.report)
      if (!doneRef.current && tick()) setHud(toHud(s, mRef.current))
    }
    const onFile = (f: ReceivedFile) => {
      doneRef.current = true
      setHud((h) => ({
        ...h,
        progress: 100,
        blocks: mRef.current.receive.complete,
        status: f.valid ? mRef.current.receive.doneValid : mRef.current.receive.doneInvalid,
        tone: f.valid ? 'ok' : 'bad',
      }))
      setResult({
        name: f.name,
        size: f.data.length,
        valid: f.valid,
        seconds: f.seconds,
        url: URL.createObjectURL(new Blob([f.data as BlobPart])),
        text: TEXT_FILE.test(f.name) && f.data.length < 200000 ? new TextDecoder().decode(f.data) : null,
      })
      navigator.vibrate?.(80)
    }
    scannerRef.current = new Scanner(videoRef.current!, onStats, onFile)
    if (config.debug) debugRef.current = new DebugPanel(debugRootRef.current!, heatmapRef.current!, debugInfoRef.current!, mRef.current.debug)
    return () => scannerRef.current?.stop()
  }, [config.debug])

  const reset = () => {
    doneRef.current = false
    scannerRef.current?.reset()
    debugRef.current?.reset()
    setResult((r) => {
      if (r) URL.revokeObjectURL(r.url)
      return null
    })
    setHud(emptyHud(m))
  }

  const close = () => {
    scannerRef.current?.stop()
    setOpen(false)
    document.body.classList.remove('pb-scanning')
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
  }

  useEffect(() => {
    if (!active && open) close()
  }, [active])

  const startScan = async () => {
    const scanner = scannerRef.current!
    reset()
    debugRef.current?.setEnabled(config.debug)
    scanner.autoZoom = autoZoom
    scanner.lockExposure = lockExposure
    scanner.frameRate = config.cameraFps
    setError('')
    setOpen(true)
    document.body.classList.add('pb-scanning')
    document.documentElement.requestFullscreen?.().catch(() => {})
    try {
      await scanner.start()
    } catch (e) {
      close()
      setError(e instanceof ScanError ? (t.errors[e.code] ?? e.message) : t.errors.unknown)
    }
  }

  const copyReport = async () => {
    const text = debugRef.current?.copyReport()
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setCopied(t.copied)
    } catch {
      setCopied(t.copyFailed)
    }
    setTimeout(() => setCopied(''), 1500)
  }

  return (
    <>
      <div className="pb-grid pb-grid-single" hidden={!active}>
        <div className="pb-panel">
          <h2>{t.title}</h2>
          <p className="pb-msg">{t.intro}</p>
          <label className="pb-check">
            <input type="checkbox" checked={autoZoom} onChange={(e) => setAutoZoom(e.target.checked)} /> {t.autoZoom}
          </label>
          <label className="pb-check">
            <input type="checkbox" checked={lockExposure} onChange={(e) => setLockExposure(e.target.checked)} /> {t.lockExposure}
          </label>
          <div className="pb-row">
            <button className="pb-primary" onClick={startScan}>
              {t.start}
            </button>
          </div>
          {error && <p className="pb-msg bad">{error}</p>}
        </div>
      </div>

      <div className="pb-scan" hidden={!open}>
        <video ref={videoRef} playsInline muted />
        <canvas ref={overlayRef} />
        <div className="pb-hud">
          <div className="pb-hud-top">
            <span className={`pb-hud-status ${hud.tone}`}>{hud.status}</span>
            <button className="pb-close" onClick={close} aria-label={t.closeCamera}>
              ✕
            </button>
          </div>
          <div className="pb-bar">
            <i style={{ width: `${hud.progress}%` }} />
          </div>
          <div className="pb-hud-line">
            <span>{t.hud.packets} <b>{hud.packets}</b></span>
            <span>{t.hud.blocks} <b>{hud.blocks}</b></span>
            <span><b>{hud.speed}</b></span>
          </div>
          <div className="pb-hud-line">
            <span>{t.hud.valid} <b>{hud.valid}</b></span>
            <span>{t.hud.time} <b>{hud.time}</b></span>
            <span><b>{hud.ms}</b></span>
          </div>
          <div className="pb-hud-line">
            <span>{t.hud.camera} <b>{hud.camera}</b></span>
            <span>{t.hud.process} <b>{hud.process}</b></span>
          </div>
          <div className="pb-hud-line">
            <span>{t.hud.zoom} <b>{hud.zoom}</b></span>
            <span>{t.hud.align} <b>{hud.align}</b></span>
            <span>{t.hud.light} <b>{hud.exposure}</b></span>
          </div>
        </div>

        {config.debug && (
          <div className="pb-debug" ref={debugRootRef}>
            <div>
              <canvas ref={heatmapRef} />
              <div className="pb-legend">
                0%<i />25%+
              </div>
            </div>
            <div className="pb-debug-info" ref={debugInfoRef}>
              {m.debug.waiting}
            </div>
            <div className="pb-debug-actions">
              <button onClick={() => debugRef.current?.reset()}>{t.resetMap}</button>
              <button onClick={copyReport}>{copied || t.copyReport}</button>
            </div>
          </div>
        )}

        {result && (
          <div className={`pb-sheet ${config.debug ? 'with-debug' : ''}`}>
            <h3>{result.name}</h3>
            <p>
              {t.result(formatBytes(result.size), formatTime(result.seconds, m.time), result.valid)}
            </p>
            <div className="pb-row">
              <a className="pb-button pb-primary" href={result.url} download={result.name}>
                {t.download}
              </a>
              <button onClick={reset}>{t.again}</button>
              <button onClick={close}>{t.close}</button>
            </div>
            {result.text !== null && <pre>{result.text}</pre>}
          </div>
        )}
      </div>
    </>
  )
}
