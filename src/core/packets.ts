import { HEADER_SIZE } from './constants'
import { crc32Parts } from './crc32'
import { Layout } from './layout'

export interface PacketSource {
  readonly fileId: number
  readonly totalSize: number
  next(out: Uint8Array): number
}

export interface Packet {
  index: number
  fileId: number
  totalSize: number
  blockSize: number
  seed: number
  data: Uint8Array
}

export function encodeFrame(layout: Layout, enc: PacketSource): Uint8Array {
  const frame = new Uint8Array(layout.capacity)
  const stride = HEADER_SIZE + layout.packetSize
  const payload = new Uint8Array(layout.packetSize)
  const dv = new DataView(frame.buffer)
  for (let p = 0; p < layout.packetsPerFrame; p++) {
    const off = p * stride
    const seed = enc.next(payload)
    dv.setUint32(off, enc.fileId)
    dv.setUint32(off + 4, enc.totalSize)
    dv.setUint16(off + 8, layout.packetSize)
    dv.setUint32(off + 10, seed)
    frame.set(payload, off + HEADER_SIZE)
    dv.setUint32(off + 14, crc32Parts(frame.subarray(off, off + 14), payload))
  }
  for (let i = 0; i < frame.length; i++) frame[i] ^= layout.whitening[i]
  return frame
}

export function parsePackets(layout: Layout, bytes: Uint8Array, count: number): Packet[] {
  for (let i = 0; i < bytes.length; i++) bytes[i] ^= layout.whitening[i]
  const stride = HEADER_SIZE + layout.packetSize
  const dv = new DataView(bytes.buffer, bytes.byteOffset)
  const out: Packet[] = []
  for (let p = 0; p < count; p++) {
    const off = p * stride
    if (dv.getUint16(off + 8) !== layout.packetSize) continue
    const data = bytes.subarray(off + HEADER_SIZE, off + stride)
    if (crc32Parts(bytes.subarray(off, off + 14), data) !== dv.getUint32(off + 14)) continue
    out.push({
      index: p,
      fileId: dv.getUint32(off),
      totalSize: dv.getUint32(off + 4),
      blockSize: layout.packetSize,
      seed: dv.getUint32(off + 10),
      data: data.slice(),
    })
  }
  return out
}
