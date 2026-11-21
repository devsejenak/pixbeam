import { crc32 } from './crc32'

export interface SourceInfo {
  name: string
  compressed: boolean
  originalSize: number
  originalCrc: number
  payload: Uint8Array
}

export function packSource(name: string, payload: Uint8Array, compressed: boolean, original: Uint8Array): Uint8Array {
  let nameBytes = new TextEncoder().encode(name || 'file')
  if (nameBytes.length > 255) nameBytes = nameBytes.slice(0, 255)
  const out = new Uint8Array(14 + nameBytes.length + payload.length)
  const dv = new DataView(out.buffer)
  out.set([80, 66, 1, compressed ? 1 : 0])
  dv.setUint32(4, original.length)
  dv.setUint32(8, crc32(original))
  dv.setUint16(12, nameBytes.length)
  out.set(nameBytes, 14)
  out.set(payload, 14 + nameBytes.length)
  return out
}

export function unpackSource(src: Uint8Array): SourceInfo {
  if (src[0] !== 80 || src[1] !== 66) throw new Error('Format tidak dikenal')
  const dv = new DataView(src.buffer, src.byteOffset, src.byteLength)
  const nameLen = dv.getUint16(12)
  return {
    name: new TextDecoder().decode(src.subarray(14, 14 + nameLen)),
    compressed: src[3] === 1,
    originalSize: dv.getUint32(4),
    originalCrc: dv.getUint32(8),
    payload: src.subarray(14 + nameLen),
  }
}
