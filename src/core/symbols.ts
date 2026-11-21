export function bytesToSymbols(bytes: Uint8Array, bits: number, count: number): Uint8Array {
  const out = new Uint8Array(count)
  const mask = (1 << bits) - 1
  let acc = 0
  let accBits = 0
  let i = 0
  for (let s = 0; s < count; s++) {
    while (accBits < bits) {
      acc = (acc << 8) | (i < bytes.length ? bytes[i] : 0)
      i++
      accBits += 8
    }
    out[s] = (acc >>> (accBits - bits)) & mask
    accBits -= bits
    acc &= (1 << accBits) - 1
  }
  return out
}

export function symbolsToBytes(symbols: Uint8Array, bits: number, size: number): Uint8Array {
  const out = new Uint8Array(size)
  let acc = 0
  let accBits = 0
  let o = 0
  for (let s = 0; s < symbols.length && o < size; s++) {
    acc = (acc << bits) | symbols[s]
    accBits += bits
    if (accBits >= 8) {
      out[o++] = (acc >>> (accBits - 8)) & 255
      accBits -= 8
      acc &= (1 << accBits) - 1
    }
  }
  return out
}
