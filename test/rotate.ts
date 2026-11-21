import { CpuSource, encodeFrame, FountainEncoder, getLayout, PRESETS, renderFrame, Receiver } from '../src/core'
import { shoot } from './camera'
const L = getLayout(PRESETS[3], 3)
for (const rot of [0, 1, 2, 3]) {
  const enc = new FountainEncoder(new Uint8Array(40000).map(() => Math.random() * 256 | 0), L.packetSize)
  const rx = new Receiver()
  for (let f = 0; f < 3; f++) {
    const img = renderFrame(L, encodeFrame(L, enc)); let w = L.totalW, h = L.totalH, out = img
    for (let k = 0; k < rot; k++) { const o = new Uint8ClampedArray(out.length); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const nx = h - 1 - y, ny = x; o.set(out.subarray((y * w + x) * 4, (y * w + x) * 4 + 4), (ny * h + nx) * 4) } out = o; [w, h] = [h, w] }
    const W = rot % 2 ? 1080 : 1920, H = rot % 2 ? 1920 : 1080
    rx.process(new CpuSource(shoot(out, w, h, { width: W, height: H, fill: 0.9, skew: 6, offset: [0, 0], noise: 12, blur: true, gain: [1, 1, 1] }), W, H))
  }
  console.log('rotation', rot, 'lock', rx.lock?.preset.id, 'r' + rx.lock?.rotation, 'valid', rx.validPackets, '/', rx.expectedPackets)
}
