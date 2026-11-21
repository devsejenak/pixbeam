import { mulberry32 } from './prng'

const LT_SEED_START = 0x10000000
const cdfCache = new Map<number, Float64Array>()

function solitonCdf(k: number): Float64Array {
  const hit = cdfCache.get(k)
  if (hit) return hit
  const c = 0.03
  const delta = 0.5
  let r = c * Math.log(k / delta) * Math.sqrt(k)
  if (!(r > 1)) r = 1
  const pivot = Math.floor(k / r)
  const weights = new Float64Array(k + 1)
  let sum = 0
  for (let i = 1; i <= k; i++) {
    const rho = i === 1 ? 1 / k : 1 / (i * (i - 1))
    let tau = 0
    if (pivot >= 1 && pivot <= k) {
      if (i < pivot) tau = r / (i * k)
      else if (i === pivot) tau = (r * Math.log(r / delta)) / k
    }
    weights[i] = rho + Math.max(0, tau)
    sum += weights[i]
  }
  const cdf = new Float64Array(k + 1)
  let acc = 0
  for (let i = 1; i <= k; i++) {
    acc += weights[i] / sum
    cdf[i] = acc
  }
  cdf[k] = 1
  cdfCache.set(k, cdf)
  return cdf
}

export function neighbors(seed: number, k: number): number[] {
  const rnd = mulberry32((seed ^ 0x5bd1e995) >>> 0)
  const cdf = solitonCdf(k)
  const x = rnd()
  let lo = 1
  let hi = k
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (cdf[mid] < x) lo = mid + 1
    else hi = mid
  }
  const set = new Set<number>()
  while (set.size < lo) set.add(Math.floor(rnd() * k))
  return [...set]
}

function xorInto(a: Uint8Array, b: Uint8Array) {
  for (let i = 0; i < a.length; i++) a[i] ^= b[i]
}

export class FountainEncoder {
  readonly blockCount: number
  readonly fileId = (Math.random() * 4294967295) >>> 0
  private data: Uint8Array
  private seed = LT_SEED_START

  get totalSize() {
    return this.source.length
  }

  constructor(readonly source: Uint8Array, readonly blockSize: number) {
    this.blockCount = Math.max(1, Math.ceil(source.length / blockSize))
    this.data = new Uint8Array(this.blockCount * blockSize)
    this.data.set(source)
  }

  next(out: Uint8Array): number {
    const seed = this.seed++
    out.fill(0)
    for (const b of neighbors(seed, this.blockCount)) {
      const start = b * this.blockSize
      for (let i = 0; i < this.blockSize; i++) out[i] ^= this.data[start + i]
    }
    return seed
  }
}

interface Pending {
  remaining: Set<number>
  data: Uint8Array
  alive: boolean
}

export class FountainDecoder {
  readonly blockCount: number
  known = 0
  received = 0
  private blocks: (Uint8Array | undefined)[]
  private seen = new Set<number>()
  private pending: Pending[] = []
  private index: (number[] | undefined)[]

  constructor(readonly fileId: number, readonly totalSize: number, readonly blockSize: number) {
    this.blockCount = Math.max(1, Math.ceil(totalSize / blockSize))
    this.blocks = new Array(this.blockCount)
    this.index = new Array(this.blockCount)
  }

  get done() {
    return this.known >= this.blockCount
  }

  add(seed: number, payload: Uint8Array) {
    if (this.done || this.seen.has(seed)) return
    this.seen.add(seed)
    this.received++
    const data = new Uint8Array(payload)
    const remaining = new Set<number>()
    for (const b of neighbors(seed, this.blockCount)) {
      const block = this.blocks[b]
      if (block) xorInto(data, block)
      else remaining.add(b)
    }
    if (remaining.size === 0) return
    if (remaining.size === 1) return this.resolve(remaining.values().next().value!, data)
    const id = this.pending.length
    this.pending.push({ remaining, data, alive: true })
    for (const b of remaining) (this.index[b] ??= []).push(id)
  }

  result(): Uint8Array {
    const out = new Uint8Array(this.blockCount * this.blockSize)
    this.blocks.forEach((b, i) => out.set(b!, i * this.blockSize))
    return out.subarray(0, this.totalSize)
  }

  private resolve(first: number, firstData: Uint8Array) {
    const queue: [number, Uint8Array][] = [[first, firstData]]
    while (queue.length) {
      const [idx, data] = queue.pop()!
      if (this.blocks[idx]) continue
      this.blocks[idx] = data
      this.known++
      const list = this.index[idx]
      this.index[idx] = undefined
      if (!list) continue
      for (const id of list) {
        const p = this.pending[id]
        if (!p.alive) continue
        xorInto(p.data, data)
        p.remaining.delete(idx)
        if (p.remaining.size <= 1) {
          p.alive = false
          if (p.remaining.size === 1) queue.push([p.remaining.values().next().value!, p.data])
        }
      }
    }
  }
}

export function estimatePackets(blockCount: number): number {
  const overhead = blockCount > 2000 ? 1.08 : blockCount > 300 ? 1.25 : blockCount > 50 ? 1.4 : 1.8
  return Math.ceil(blockCount * overhead)
}
