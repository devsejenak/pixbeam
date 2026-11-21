import { useCallback, useEffect, useRef, useState } from 'react'
import { Bits, estimatePackets, PRESETS } from '../core'
import { PixbeamConfig } from '../config'
import { Orientation, Sender, SendInfo } from '../web/sender'
import { formatBytes, formatTime, throttle } from './format'
import { Stats } from './Stats'

interface Props {
  config: PixbeamConfig
  active: boolean
}

type Message = { text: string; tone?: 'ok' | 'bad' }

export function SendView({ config, active }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const senderRef = useRef<Sender | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [text, setText] = useState('Halo dari devsejenak. Kalau teks ini muncul di HP, berarti transfer lewat kamera berhasil.')
  const [preset, setPreset] = useState(config.defaultPreset)
  const [bits, setBits] = useState<Bits>(config.defaultBits)
  const [orientation, setOrientation] = useState<Orientation>(config.defaultOrientation)
  const [fps, setFps] = useState(Math.min(config.defaultFps, config.maxFps))
  const [testPattern, setTestPattern] = useState(false)
  const [running, setRunning] = useState(false)
  const [info, setInfo] = useState<{ data: SendInfo; actualFps: number } | null>(null)
  const [message, setMessage] = useState<Message>({ text: '' })

  useEffect(() => {
    const canvas = canvasRef.current!
    const tick = throttle(400)
    const sender = new Sender(canvas, (data) => {
      if (tick()) setInfo({ data: { ...data }, actualFps: sender.actualFps })
    })
    sender.fps = fps
    sender.orientation = orientation
    senderRef.current = sender
    const fit = () => sender.fit()
    const onFullscreen = () => setTimeout(fit, 60)
    addEventListener('resize', fit)
    document.addEventListener('fullscreenchange', onFullscreen)
    return () => {
      sender.stop()
      removeEventListener('resize', fit)
      document.removeEventListener('fullscreenchange', onFullscreen)
    }
  }, [])

  useEffect(() => {
    if (senderRef.current) senderRef.current.fps = fps
  }, [fps])

  const stop = useCallback(() => {
    senderRef.current?.stop()
    setRunning(false)
  }, [])

  useEffect(() => {
    if (!active) stop()
  }, [active, stop])

  const start = useCallback(
    async (nextOrientation = orientation) => {
      const sender = senderRef.current!
      const chosen = PRESETS.find((p) => p.id === preset) ?? PRESETS[PRESETS.length - 1]
      sender.orientation = nextOrientation
      if (config.testPattern && testPattern) {
        sender.startTestPattern(chosen, bits)
        setRunning(true)
        return setMessage({ text: 'Mengirim pola uji. Aktifkan mode debug di penerima.', tone: 'ok' })
      }
      if (!file && !text.trim()) return setMessage({ text: 'Pilih file atau tulis teks dulu.', tone: 'bad' })
      const name = file?.name ?? 'pesan.txt'
      const bytes = file ? new Uint8Array(await file.arrayBuffer()) : new TextEncoder().encode(text)
      await sender.start(name, bytes, chosen, bits)
      setRunning(true)
      setMessage({ text: `Mengirim ${name}. Buka tab Terima di HP.`, tone: 'ok' })
    },
    [orientation, preset, bits, file, text, testPattern, config.testPattern],
  )

  const changeOrientation = (value: Orientation) => {
    setOrientation(value)
    if (senderRef.current) senderRef.current.orientation = value
    if (running) start(value)
    else requestAnimationFrame(() => senderRef.current?.fit())
  }

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await stageRef.current!.requestFullscreen()
    } catch {
      setMessage({ text: 'Layar penuh tidak didukung di browser ini.', tone: 'bad' })
    }
  }

  const rows: [string, string | number][] = []
  if (info) {
    const { data, actualFps } = info
    const { layout, blockCount } = data
    if (blockCount) {
      rows.push(
        ['Ukuran asli', formatBytes(data.originalSize)],
        ['Dikirim', `${formatBytes(data.packedSize)}${data.compressed ? ' (kompres)' : ''}`],
        ['Data per frame', formatBytes(layout.packetsPerFrame * layout.packetSize)],
        ['Paket per frame', layout.packetsPerFrame],
        ['Perkiraan waktu', formatTime(Math.ceil(estimatePackets(blockCount) / layout.packetsPerFrame) / fps)],
        ['FPS aktual', actualFps],
      )
    } else {
      rows.push(['Mode', 'pola uji'], ['Data per frame', formatBytes(layout.packetsPerFrame * layout.packetSize)], ['Paket per frame', layout.packetsPerFrame], ['FPS aktual', actualFps])
    }
  }

  return (
    <div className="pb-grid" hidden={!active}>
      <div className="pb-panel">
        <h2>Pengirim</h2>
        <label htmlFor="pb-file">File</label>
        <input
          id="pb-file"
          type="file"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null
            setFile(f)
            if (f) setText('')
          }}
        />
        <label htmlFor="pb-text">Atau teks</label>
        <textarea id="pb-text" value={text} onChange={(e) => setText(e.target.value)} />
        <label htmlFor="pb-preset">Ukuran grid</label>
        <select id="pb-preset" value={preset} onChange={(e) => setPreset(e.target.value)}>
          {PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.w} × {p.h} sel
            </option>
          ))}
        </select>
        <label htmlFor="pb-bits">Mode warna</label>
        <select id="pb-bits" value={bits} onChange={(e) => setBits(Number(e.target.value) as Bits)}>
          <option value={1}>Hitam-putih · 1 bit per sel</option>
          <option value={2}>4 warna · 2 bit per sel</option>
          <option value={3}>8 warna · 3 bit per sel</option>
        </select>
        <label htmlFor="pb-orientation">Orientasi frame</label>
        <select id="pb-orientation" value={orientation} onChange={(e) => changeOrientation(e.target.value as Orientation)}>
          <option value="portrait">Portrait · HP dipegang tegak</option>
          <option value="landscape">Landscape · HP dipegang miring</option>
        </select>
        <label htmlFor="pb-fps">
          Kecepatan <span className="pb-mono">{fps}</span> frame/detik
        </label>
        <input id="pb-fps" type="range" min={2} max={config.maxFps} step={1} value={fps} onChange={(e) => setFps(Number(e.target.value))} />
        {config.testPattern && (
          <label className="pb-check">
            <input type="checkbox" checked={testPattern} onChange={(e) => setTestPattern(e.target.checked)} /> Kirim pola uji
          </label>
        )}
        <div className="pb-row">
          <button className="pb-primary" onClick={() => (running ? stop() : start())}>
            {running ? 'Berhenti' : 'Mulai kirim'}
          </button>
          <button onClick={toggleFullscreen}>Layar penuh</button>
        </div>
        <p className={`pb-msg ${message.tone ?? ''}`}>{message.text}</p>
        <Stats rows={rows} />
      </div>
      <div className={`pb-stage ${orientation === 'portrait' ? 'portrait' : ''}`} ref={stageRef}>
        <canvas ref={canvasRef} hidden={!running && !info} />
        {!running && !info && <p className="pb-empty">Pilih file atau tulis teks, lalu tekan Mulai kirim.</p>}
      </div>
    </div>
  )
}
