import { deflateRawSync, inflateRawSync } from 'node:zlib'
import { CpuSource, encodeFrame, FountainEncoder, getLayout, packSource, PRESETS, Receiver, renderFrame, unpackSource, Bits, crc32 } from '../src/core'
import { shoot } from './camera'

function run(presetId: string, bits: Bits, size: number, fill: number, label: string) {
  const preset = PRESETS.find((p) => p.id === presetId)!
  const original = new Uint8Array(size).map(() => (Math.random() * 256) | 0)
  const compressed = deflateRawSync(original)
  const use = compressed.length < original.length
  const source = packSource('tes.bin', use ? compressed : original, use, original)
  const layout = getLayout(preset, bits)
  const enc = new FountainEncoder(source, layout.packetSize)
  const rx = new Receiver()
  let frames = 0
  let tracked = 0
  let procMs = 0
  const t0 = Date.now()
  while (frames < 400) {
    const frame = encodeFrame(layout, enc)
    frames++
    if (Math.random() < 0.1) continue
    const img = renderFrame(layout, frame)
    const cam = shoot(img, layout.totalW, layout.totalH, {
      width: 1920, height: 1080, fill, skew: 8 + Math.random() * 10,
      offset: [(Math.random() - 0.5) * 30, (Math.random() - 0.5) * 20],
      noise: 18, blur: true, gain: [0.95, 1.05, 0.85],
    })
    const t = Date.now()
    const rep = rx.process(new CpuSource(cam, 1920, 1080))
    procMs += Date.now() - t
    if (rep.tracked) tracked++
    if (rep.finished) break
  }
  const d = rx.decoder
  let ok = false
  if (d?.done) {
    const info = unpackSource(d.result())
    const data = info.compressed ? inflateRawSync(info.payload) : Buffer.from(info.payload)
    ok = crc32(new Uint8Array(data)) === info.originalCrc && data.length === original.length
  }
  const cellPx = (1920 * fill) / layout.totalW
  console.log(`${label} ${preset.id} bits=${bits} cellPx=${cellPx.toFixed(1)} cap=${layout.capacity}B P=${layout.packetsPerFrame} K=${enc.blockCount} | lock=${rx.lock?.preset.id}/${rx.lock?.bits}/r${rx.lock?.rotation} frames=${frames} tracked=${tracked} valid=${rx.validPackets}/${rx.expectedPackets} (${((rx.validPackets / rx.expectedPackets) * 100).toFixed(0)}%) done=${!!d?.done} verified=${ok} proc=${(procMs / frames).toFixed(0)}ms/frame total=${(Date.now() - t0) / 1000}s`)
}

const which = process.argv[2] ?? 'all'
if (which === 'all' || which === 'a') run('160x90', 3, 20000, 0.85, 'A')
if (which === 'all' || which === 'b') run('240x135', 3, 60000, 0.88, 'B')
if (which === 'all' || which === 'c') run('320x180', 3, 120000, 0.9, 'C')
if (which === 'all' || which === 'd') run('320x180', 2, 80000, 0.9, 'D')
if (which === 'all' || which === 'e') run('320x180', 1, 40000, 0.9, 'E')
