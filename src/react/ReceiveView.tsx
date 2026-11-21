import { useEffect, useRef, useState } from 'react'
import { PixbeamConfig } from '../config'
import { DebugPanel } from '../web/debug-panel'
import { ReceivedFile, Scanner, ScanStats } from '../web/scanner'
import { formatBytes, formatTime, throttle } from './format'

interface Props {
  config: PixbeamConfig
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

const EMPTY_HUD: Hud = {
  status: 'Mencari kode…', tone: '', progress: 0, packets: '0 / -', blocks: '-', speed: '-', valid: '-',
  time: '-', ms: '-', camera: '-', process: '-', zoom: '-', align: '-', exposure: 'auto',
}

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

function toHud(s: ScanStats): Hud {
  const { report, fps, camera } = s
  const hud: Hud = { ...EMPTY_HUD }
  if (!report.corners) hud.status = 'Mencari 4 marker sudut…'
  else if (!report.lock) hud.status = 'Marker terlihat, mencocokkan pengaturan…'
  else {
    hud.status = `Terkunci · ${report.lock.preset.w}×${report.lock.preset.h} · ${2 ** report.lock.bits} warna`
    hud.tone = 'ok'
  }
  hud.ms = `${Math.round(s.processMs)} ms/frame`
  hud.valid = s.expectedPackets ? `${Math.round((s.validPackets / s.expectedPackets) * 100)}%` : '-'
  if (fps.camera) {
    hud.camera = `${fps.width}×${fps.height} · ${Math.round(fps.camera)} fps`
    hud.process = `${Math.round(fps.processed)} fps`
  }
  hud.zoom = camera?.zoomSupported ? `${camera.zoom!.toFixed(1)}×` : 'tidak ada'
  hud.align = report.alignment ? `${report.alignment.found}/${report.alignment.total}` : '-'
  hud.exposure = camera?.exposureLocked ? 'terkunci' : 'auto'
  if (s.blockCount) {
    hud.progress = Math.min(99, (s.received / s.needed) * 100)
    hud.packets = `${s.received.toLocaleString('id')} / ±${s.needed.toLocaleString('id')}`
    hud.blocks = `${s.known}/${s.blockCount}`
    hud.speed = s.elapsed > 0 ? `${formatBytes(Math.round((s.received * s.blockSize) / s.elapsed))}/s` : '-'
    hud.time = formatTime(s.elapsed)
  }
  return hud
}

export function ReceiveView({ config, active }: Props) {
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
  const [hud, setHud] = useState<Hud>(EMPTY_HUD)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState('')

  useEffect(() => {
    const tick = throttle(150)
    const onStats = (s: ScanStats) => {
      drawOverlay(overlayRef.current!, videoRef.current!, s)
      debugRef.current?.update(s.report)
      if (!doneRef.current && tick()) setHud(toHud(s))
    }
    const onFile = (f: ReceivedFile) => {
      doneRef.current = true
      setHud((h) => ({
        ...h,
        progress: 100,
        blocks: 'lengkap',
        status: f.valid ? 'Selesai. File diterima utuh.' : 'Selesai, tetapi checksum gagal.',
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
    if (config.debug) debugRef.current = new DebugPanel(debugRootRef.current!, heatmapRef.current!, debugInfoRef.current!)
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
    setHud(EMPTY_HUD)
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
      setError((e as Error).message)
    }
  }

  const copyReport = async () => {
    const text = debugRef.current?.copyReport()
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setCopied('Tersalin')
    } catch {
      setCopied('Gagal menyalin')
    }
    setTimeout(() => setCopied(''), 1500)
  }

  return (
    <>
      <div className="pb-grid pb-grid-single" hidden={!active}>
        <div className="pb-panel">
          <h2>Penerima</h2>
          <p className="pb-msg">Kamera akan terbuka layar penuh. Arahkan ke kode di layar pengirim sampai keempat marker sudut terlihat.</p>
          <label className="pb-check">
            <input type="checkbox" checked={autoZoom} onChange={(e) => setAutoZoom(e.target.checked)} /> Zoom otomatis
          </label>
          <label className="pb-check">
            <input type="checkbox" checked={lockExposure} onChange={(e) => setLockExposure(e.target.checked)} /> Kunci exposure dan white balance saat terkunci
          </label>
          <div className="pb-row">
            <button className="pb-primary" onClick={startScan}>
              Mulai scan
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
            <button className="pb-close" onClick={close} aria-label="Tutup kamera">
              ✕
            </button>
          </div>
          <div className="pb-bar">
            <i style={{ width: `${hud.progress}%` }} />
          </div>
          <div className="pb-hud-line">
            <span>Paket <b>{hud.packets}</b></span>
            <span>Blok <b>{hud.blocks}</b></span>
            <span><b>{hud.speed}</b></span>
          </div>
          <div className="pb-hud-line">
            <span>Valid <b>{hud.valid}</b></span>
            <span>Waktu <b>{hud.time}</b></span>
            <span><b>{hud.ms}</b></span>
          </div>
          <div className="pb-hud-line">
            <span>Kamera <b>{hud.camera}</b></span>
            <span>Proses <b>{hud.process}</b></span>
          </div>
          <div className="pb-hud-line">
            <span>Zoom <b>{hud.zoom}</b></span>
            <span>Align <b>{hud.align}</b></span>
            <span>Cahaya <b>{hud.exposure}</b></span>
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
              Menunggu frame terkunci…
            </div>
            <div className="pb-debug-actions">
              <button onClick={() => debugRef.current?.reset()}>Reset peta</button>
              <button onClick={copyReport}>{copied || 'Salin laporan'}</button>
            </div>
          </div>
        )}

        {result && (
          <div className={`pb-sheet ${config.debug ? 'with-debug' : ''}`}>
            <h3>{result.name}</h3>
            <p>
              {formatBytes(result.size)} dalam {formatTime(result.seconds)} · {result.valid ? 'checksum cocok' : 'checksum tidak cocok'}
            </p>
            <div className="pb-row">
              <a className="pb-button pb-primary" href={result.url} download={result.name}>
                Unduh file
              </a>
              <button onClick={reset}>Scan lagi</button>
              <button onClick={close}>Tutup</button>
            </div>
            {result.text !== null && <pre>{result.text}</pre>}
          </div>
        )}
      </div>
    </>
  )
}
