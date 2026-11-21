import { CpuSource, encodeFrame, getLayout, PRESETS, Receiver, renderFrame, TestPattern } from '../src/core'
import { AutoZoom } from '../src/web/auto-zoom'
import { shoot } from './camera'

const L = getLayout(PRESETS.find((p) => p.id === '320x180')!, 3)
const enc = new TestPattern()
const rx = new Receiver()
const zoom = new AutoZoom({ min: 1, max: 3, step: 0.1 })
const baseFill = 0.42
const baseOffset: [number, number] = [60, -30]
let t = 0
for (let f = 0; f < 60; f++) {
  t += 66
  const z = zoom.zoom
  const cam = shoot(renderFrame(L, encodeFrame(L, enc)), L.totalW, L.totalH, {
    width: 1920, height: 1080, fill: baseFill * z, skew: 4 * z, offset: [baseOffset[0] * z, baseOffset[1] * z], noise: 14, blur: true, gain: [0.95, 1.05, 0.85],
  })
  const rep = rx.process(new CpuSource(cam, 1920, 1080))
  const next = zoom.next({ now: t, locked: !!rep.lock, cellPx: rep.cellPx ?? null, corners: rep.corners, frameW: 1920, frameH: 1080 })
  if (f % 5 === 0 || next !== null) console.log(`f${f} zoom=${z.toFixed(2)} cellPx=${rep.cellPx?.toFixed(1) ?? '-'} corners=${!!rep.corners} lock=${!!rep.lock} valid=${rep.packets}/${rep.expected}${next !== null ? ` -> zoom ${next.toFixed(2)}` : ''}`)
}
