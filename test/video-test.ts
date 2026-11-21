import { spawn } from 'node:child_process'
import { encodeFrame, getLayout, PRESETS, renderFrame, TestPattern, Bits } from '../src/core'
import { shoot } from './camera'

const [presetId = '240x135', bitsArg = '3', distortion = '0.006', out = 'test/out/testpattern.y4m'] = process.argv.slice(2)
const layout = getLayout(PRESETS.find((p) => p.id === presetId)!, Number(bitsArg) as Bits, 'cols')
const enc = new TestPattern()
const W = 1080, H = 1920
const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', '30', '-i', '-', '-pix_fmt', 'yuv420p', '-f', 'yuv4mpegpipe', out])
const rotate = (src: Uint8ClampedArray, w: number, h: number) => {
  const o = new Uint8ClampedArray(src.length)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) o.set(src.subarray((y * w + x) * 4, (y * w + x) * 4 + 4), (x * h + (h - 1 - y)) * 4)
  return o
}
;(async () => {
  for (let f = 0; f < 20; f++) {
    const cam = shoot(rotate(renderFrame(layout, encodeFrame(layout, enc)), layout.totalW, layout.totalH), layout.totalH, layout.totalW, {
      width: W, height: H, fill: 0.9, skew: 6, offset: [0, 0], noise: 14, blur: true, gain: [0.95, 1.05, 0.85], distortion: Number(distortion),
    })
    for (let r = 0; r < 2; r++) await new Promise<void>((res) => (ff.stdin.write(Buffer.from(cam.buffer)) ? res() : ff.stdin.once('drain', () => res())))
  }
  ff.stdin.end()
  ff.on('close', (c) => console.log('y4m', c))
})()
