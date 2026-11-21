import { spawn } from 'node:child_process'
import { deflateRawSync } from 'node:zlib'
import { encodeFrame, FountainEncoder, getLayout, packSource, PRESETS, renderFrame, Bits } from '../src/core'
import { shoot } from './camera'

const [presetId = '320x180', bitsArg = '3', sizeArg = '300000', out = 'test/out/cam.y4m', orient = 'landscape'] = process.argv.slice(2)
const portrait = orient === 'portrait'
const layout = getLayout(PRESETS.find((p) => p.id === presetId)!, Number(bitsArg) as Bits, orient === 'portrait' ? 'cols' : 'rows')
const original = new Uint8Array(Number(sizeArg)).map(() => (Math.random() * 256) | 0)
const comp = deflateRawSync(original)
const use = comp.length < original.length
const enc = new FountainEncoder(packSource('acak.bin', use ? comp : original, use, original), layout.packetSize)
const W = portrait ? 1080 : 1920, H = portrait ? 1920 : 1080
const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', '30', '-i', '-', '-pix_fmt', 'yuv420p', '-f', 'yuv4mpegpipe', out])
const codeFrames = Math.ceil((enc.blockCount * 1.5) / layout.packetsPerFrame) + 4
let prev: Uint8ClampedArray | null = null
const opts = () => ({ width: W, height: H, fill: 0.9, skew: 10, offset: [4, -3] as [number, number], noise: 16, blur: true, gain: [0.95, 1.05, 0.85] as [number, number, number] })
;(async () => {
  for (let f = 0; f < codeFrames; f++) {
    const img = renderFrame(layout, encodeFrame(layout, enc))
    const cam = portrait ? shoot(rotate(img, layout.totalW, layout.totalH), layout.totalH, layout.totalW, opts()) : shoot(img, layout.totalW, layout.totalH, opts())
    if (prev) {
      const torn = new Uint8ClampedArray(prev)
      const cut = Math.floor(H * (0.3 + Math.random() * 0.4)) * W * 4
      torn.set(cam.subarray(0, cut), 0)
      await write(torn)
    } else await write(cam)
    await write(cam)
    prev = cam
  }
  ff.stdin.end()
  ff.on('close', (c) => console.log('y4m', c, 'K', enc.blockCount, 'P', layout.packetsPerFrame, 'codeFrames', codeFrames))
})()
function write(buf: Uint8ClampedArray) {
  return new Promise<void>((r) => (ff.stdin.write(Buffer.from(buf.buffer)) ? r() : ff.stdin.once('drain', () => r())))
}

function rotate(src: Uint8ClampedArray, w: number, h: number) {
  const out = new Uint8ClampedArray(src.length)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out.set(src.subarray((y * w + x) * 4, (y * w + x) * 4 + 4), (x * h + (h - 1 - y)) * 4)
  return out
}
