import { CpuSource, encodeFrame, ErrorMap, getLayout, PRESETS, Receiver, renderFrame, TestPattern } from '../src/core'
import { shoot } from './camera'
const names = ['hitam', 'biru', 'hijau', 'cyan', 'merah', 'magenta', 'kuning', 'putih']
for (const presetId of ['240x135', '320x180']) {
  for (const distortion of [0, 0.004, 0.006, 0.009, 0.012, 0.016]) {
    const row: string[] = []
    for (const useAlignment of [false, true]) {
      const L = getLayout(PRESETS.find((p) => p.id === presetId)!, 3)
      const enc = new TestPattern(1)
      const rx = new Receiver()
      rx.useAlignment = useAlignment
      let map: ErrorMap | null = null
      let align = ''
      for (let f = 0; f < 4; f++) {
        const cam = shoot(renderFrame(L, encodeFrame(L, enc)), L.totalW, L.totalH, { width: 1920, height: 1080, fill: 0.9, skew: 6, offset: [0, 0], noise: 14, blur: true, gain: [0.95, 1.05, 0.85], distortion })
        const rep = rx.process(new CpuSource(cam, 1920, 1080))
        if (rep.decoded && rep.layout) (map ??= new ErrorMap(rep.layout)).add(rep.decoded)
        if (rep.alignment) align = `${rep.alignment.found}/${rep.alignment.total}`
      }
      const s = map?.summary(names)
      row.push(`${useAlignment ? 'align' : 'global'}: valid ${rx.validPackets}/${rx.expectedPackets} err ${s ? (s.cellErrorRate * 100).toFixed(2) + '%' : 'no-lock'}${useAlignment ? ' nodes ' + align : ''}`)
    }
    console.log(presetId, 'distorsi', distortion.toFixed(3), '|', row.join(' | '))
  }
}
