import { CpuSource, encodeFrame, ErrorMap, getLayout, PRESETS, Receiver, renderFrame, TestPattern } from '../src/core'
import { shoot } from './camera'
const names = ['hitam', 'biru', 'hijau', 'cyan', 'merah', 'magenta', 'kuning', 'putih']
for (const [label, distortion, noise, blur] of [['bersih', 0, 10, false], ['distorsi 0.005', 0.005, 10, false], ['distorsi 0.006', 0.006, 10, false], ['noise 130 + blur', 0, 130, true], ['noise 200 + blur', 0, 200, true]] as const) {
  const L = getLayout(PRESETS[5], 3)
  const enc = new TestPattern(1)
  const rx = new Receiver()
  let map: ErrorMap | null = null
  for (let f = 0; f < 4; f++) {
    const cam = shoot(renderFrame(L, encodeFrame(L, enc)), L.totalW, L.totalH, { width: 1920, height: 1080, fill: 0.9, skew: 6, offset: [0, 0], noise, blur, gain: [0.95, 1.05, 0.85], distortion })
    const rep = rx.process(new CpuSource(cam, 1920, 1080))
    if (rep.decoded && rep.layout) (map ??= new ErrorMap(rep.layout)).add(rep.decoded)
  }
  const s = map?.summary(names)
  console.log(label, '| lock', rx.lock?.preset.id, '| valid', rx.validPackets, '/', rx.expectedPackets, '|', s && { mode: s.mode, err: (s.cellErrorRate * 100).toFixed(3) + '%', shift: (s.shiftShare * 100).toFixed(0) + '%', bias: s.directionBias.toFixed(2), center: (s.centerRate * 100).toFixed(3) + '%', edge: (s.edgeRate * 100).toFixed(3) + '%', worst: s.worstRegion, top: s.confusions.map((c) => `${names[c.from]}→${names[c.to]} ${(c.rate * 100).toFixed(1)}%`) })
  console.log('   hint:', s?.hint)
}
