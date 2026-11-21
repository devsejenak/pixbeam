import { useCallback, useEffect, useRef, useState } from 'react'
import { Bits, estimatePackets, PRESETS } from '../core'
import { PixbeamConfig } from '../config'
import { PixbeamMessages } from '../i18n'
import { Orientation, Sender, SendInfo } from '../web/sender'
import { formatBytes, formatTime, throttle } from './format'
import { Stats } from './Stats'

interface Props {
  config: PixbeamConfig
  messages: PixbeamMessages
  active: boolean
}

type Message = { text: string; tone?: 'ok' | 'bad' }

export function SendView({ config, messages: m, active }: Props) {
  const t = m.send
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const senderRef = useRef<Sender | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [text, setText] = useState(t.defaultText)
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
        return setMessage({ text: t.sendingTestPattern, tone: 'ok' })
      }
      if (!file && !text.trim()) return setMessage({ text: t.needInput, tone: 'bad' })
      const name = file?.name ?? t.defaultFileName
      const bytes = file ? new Uint8Array(await file.arrayBuffer()) : new TextEncoder().encode(text)
      await sender.start(name, bytes, chosen, bits)
      setRunning(true)
      setMessage({ text: t.sending(name), tone: 'ok' })
    },
    [orientation, preset, bits, file, text, testPattern, config.testPattern, t],
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
      setMessage({ text: t.fullscreenUnsupported, tone: 'bad' })
    }
  }

  const st = t.stats
  const rows: [string, string | number][] = []
  if (info) {
    const { data, actualFps } = info
    const { layout, blockCount } = data
    if (blockCount) {
      rows.push(
        [st.originalSize, formatBytes(data.originalSize)],
        [st.sent, `${formatBytes(data.packedSize)}${data.compressed ? st.compressed : ''}`],
        [st.dataPerFrame, formatBytes(layout.packetsPerFrame * layout.packetSize)],
        [st.packetsPerFrame, layout.packetsPerFrame],
        [st.eta, formatTime(Math.ceil(estimatePackets(blockCount) / layout.packetsPerFrame) / fps, m.time)],
        [st.actualFps, actualFps],
      )
    } else {
      rows.push([st.mode, st.testPattern], [st.dataPerFrame, formatBytes(layout.packetsPerFrame * layout.packetSize)], [st.packetsPerFrame, layout.packetsPerFrame], [st.actualFps, actualFps])
    }
  }

  return (
    <div className="pb-grid" hidden={!active}>
      <div className="pb-panel">
        <h2>{t.title}</h2>
        <label htmlFor="pb-file">{t.file}</label>
        <input
          id="pb-file"
          type="file"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null
            setFile(f)
            if (f) setText('')
          }}
        />
        <label htmlFor="pb-text">{t.text}</label>
        <textarea id="pb-text" value={text} onChange={(e) => setText(e.target.value)} />
        <label htmlFor="pb-preset">{t.grid}</label>
        <select id="pb-preset" value={preset} onChange={(e) => setPreset(e.target.value)}>
          {PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {t.gridOption(p.w, p.h)}
            </option>
          ))}
        </select>
        <label htmlFor="pb-bits">{t.colorMode}</label>
        <select id="pb-bits" value={bits} onChange={(e) => setBits(Number(e.target.value) as Bits)}>
          <option value={1}>{t.bits1}</option>
          <option value={2}>{t.bits2}</option>
          <option value={3}>{t.bits3}</option>
        </select>
        <label htmlFor="pb-orientation">{t.orientation}</label>
        <select id="pb-orientation" value={orientation} onChange={(e) => changeOrientation(e.target.value as Orientation)}>
          <option value="portrait">{t.portrait}</option>
          <option value="landscape">{t.landscape}</option>
        </select>
        <label htmlFor="pb-fps">
          {t.speed} <span className="pb-mono">{fps}</span> {t.speedUnit}
        </label>
        <input id="pb-fps" type="range" min={2} max={config.maxFps} step={1} value={fps} onChange={(e) => setFps(Number(e.target.value))} />
        {config.testPattern && (
          <label className="pb-check">
            <input type="checkbox" checked={testPattern} onChange={(e) => setTestPattern(e.target.checked)} /> {t.testPattern}
          </label>
        )}
        <div className="pb-row">
          <button className="pb-primary" onClick={() => (running ? stop() : start())}>
            {running ? t.stop : t.start}
          </button>
          <button onClick={toggleFullscreen}>{t.fullscreen}</button>
        </div>
        <p className={`pb-msg ${message.tone ?? ''}`}>{message.text}</p>
        <Stats rows={rows} />
      </div>
      <div className={`pb-stage ${orientation === 'portrait' ? 'portrait' : ''}`} ref={stageRef}>
        <canvas ref={canvasRef} hidden={!running && !info} />
        {!running && !info && <p className="pb-empty">{t.empty}</p>}
      </div>
    </div>
  )
}
