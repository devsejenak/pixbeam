import { Point } from './homography'

export interface Marker {
  x: number
  y: number
  size: number
  hits: number
}

function luminance(rgba: Uint8Array | Uint8ClampedArray, n: number): Uint8Array {
  const lum = new Uint8Array(n)
  for (let i = 0, p = 0; i < n; i++, p += 4) lum[i] = (rgba[p] * 77 + rgba[p + 1] * 150 + rgba[p + 2] * 29) >> 8
  return lum
}

export function binarize(rgba: Uint8Array | Uint8ClampedArray, w: number, h: number): Uint8Array {
  const lum = luminance(rgba, w * h)
  const bs = Math.max(8, Math.floor(Math.min(w, h) / 24))
  const bw = Math.ceil(w / bs)
  const bh = Math.ceil(h / bs)
  const thr = new Float32Array(bw * bh)
  for (let by = 0; by < bh; by++) {
    for (let bx = 0; bx < bw; bx++) {
      let mn = 255
      let mx = 0
      for (let y = by * bs; y < Math.min(h, (by + 1) * bs); y++) {
        for (let x = bx * bs; x < Math.min(w, (bx + 1) * bs); x++) {
          const v = lum[y * w + x]
          if (v < mn) mn = v
          if (v > mx) mx = v
        }
      }
      thr[by * bw + bx] = mx - mn > 32 ? (mn + mx) / 2 : -1
    }
  }
  const avg = new Float32Array(bw * bh)
  for (let by = 0; by < bh; by++) {
    for (let bx = 0; bx < bw; bx++) {
      let s = 0
      let c = 0
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const yy = by + dy
          const xx = bx + dx
          if (yy < 0 || xx < 0 || yy >= bh || xx >= bw) continue
          const t = thr[yy * bw + xx]
          if (t >= 0) {
            s += t
            c++
          }
        }
      }
      avg[by * bw + bx] = c ? s / c : 0
    }
  }
  const bin = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) {
    const row = Math.floor(y / bs) * bw
    for (let x = 0; x < w; x++) bin[y * w + x] = lum[y * w + x] < avg[row + Math.floor(x / bs)] ? 1 : 0
  }
  return bin
}

function ratioOk(c: number[], mid = 3): boolean {
  const total = c[0] + c[1] + c[2] + c[3] + c[4]
  const units = 4 + mid
  if (total < units) return false
  const m = total / units
  const tol = m * 0.6
  return (
    Math.abs(c[0] - m) < tol &&
    Math.abs(c[1] - m) < tol &&
    Math.abs(c[2] - mid * m) < mid * tol &&
    Math.abs(c[3] - m) < tol &&
    Math.abs(c[4] - m) < tol
  )
}

function cross(bin: Uint8Array, w: number, h: number, x0: number, y0: number, dx: number, dy: number, maxRun: number, mid = 3) {
  const at = (t: number) => {
    const x = Math.round(x0 + dx * t)
    const y = Math.round(y0 + dy * t)
    if (x < 0 || y < 0 || x >= w || y >= h) return -1
    return bin[y * w + x]
  }
  if (at(0) !== 1) return null
  const c = [0, 0, 0, 0, 0]
  let t = 0
  while (at(t) === 1) if (++c[2] > maxRun * 3) return null; else t--
  const start = t + 1
  while (at(t) === 0) if (++c[1] > maxRun) return null; else t--
  while (at(t) === 1) if (++c[0] > maxRun) return null; else t--
  t = 1
  while (at(t) === 1) if (++c[2] > maxRun * 3) return null; else t++
  const end = t - 1
  while (at(t) === 0) if (++c[3] > maxRun) return null; else t++
  while (at(t) === 1) if (++c[4] > maxRun) return null; else t++
  if (!c[0] || !c[1] || !c[3] || !c[4] || !ratioOk(c, mid)) return null
  return { center: (start + end) / 2, total: c[0] + c[1] + c[2] + c[3] + c[4] }
}

export function findMarkers(bin: Uint8Array, w: number, h: number): Marker[] {
  const found: Marker[] = []
  for (let y = 0; y < h; y += 1) {
    const runs: number[] = []
    let cur = bin[y * w]
    let len = 0
    let start = 0
    for (let x = 0; x <= w; x++) {
      const v = x < w ? bin[y * w + x] : -1
      if (v === cur) len++
      else {
        runs.push(cur, len, start)
        cur = v
        len = 1
        start = x
      }
    }
    for (let i = 0; i + 14 < runs.length; i += 3) {
      if (runs[i] !== 1) continue
      const c = [runs[i + 1], runs[i + 4], runs[i + 7], runs[i + 10], runs[i + 13]]
      if (!ratioOk(c)) continue
      const total = c[0] + c[1] + c[2] + c[3] + c[4]
      let cx = runs[i + 8] + c[2] / 2
      const v = cross(bin, w, h, cx, y, 0, 1, total)
      if (!v) continue
      const cy = y + v.center
      const hz = cross(bin, w, h, cx, cy, 1, 0, total)
      if (!hz) continue
      cx += hz.center
      const size = (v.total + hz.total) / 2
      const m = found.find((f) => Math.abs(f.x - cx) < f.size / 4 && Math.abs(f.y - cy) < f.size / 4 && Math.abs(f.size - size) < f.size / 2)
      if (m) {
        m.x = (m.x * m.hits + cx) / (m.hits + 1)
        m.y = (m.y * m.hits + cy) / (m.hits + 1)
        m.size = (m.size * m.hits + size) / (m.hits + 1)
        m.hits++
      } else found.push({ x: cx, y: cy, size, hits: 1 })
    }
  }
  return found
}

export function pickCorners(markers: Marker[]): Marker[] | null {
  let good = markers.filter((m) => m.hits >= 2)
  if (good.length < 4) return null
  const sizes = [...good].sort((a, b) => b.hits - a.hits).slice(0, 8).map((m) => m.size).sort((a, b) => a - b)
  const median = sizes[sizes.length >> 1]
  good = good.filter((m) => m.size > median * 0.5 && m.size < median * 2)
  if (good.length < 4) return null
  const best = (score: (m: Marker) => number) => good.reduce((a, b) => (score(b) > score(a) ? b : a))
  const ring = [
    best((m) => -(m.x + m.y)),
    best((m) => m.x - m.y),
    best((m) => m.x + m.y),
    best((m) => m.y - m.x),
  ]
  return new Set(ring).size === 4 ? ring : null
}

function localBinary(rgba: Uint8Array, n: number): Uint8Array | null {
  const lum = luminance(rgba, n)
  let mn = 255
  let mx = 0
  for (const v of lum) {
    if (v < mn) mn = v
    if (v > mx) mx = v
  }
  if (mx - mn < 40) return null
  const thr = (mn + mx) / 2
  const bin = new Uint8Array(n)
  for (let i = 0; i < n; i++) bin[i] = lum[i] < thr ? 1 : 0
  return bin
}

function crossAt(bin: Uint8Array, w: number, h: number, x: number, y: number, maxRun: number, mid: number) {
  let cx = x
  let cy = y
  let total = 0
  for (let pass = 0; pass < 2; pass++) {
    const hz = cross(bin, w, h, cx, cy, 1, 0, maxRun, mid)
    if (!hz) return null
    cx += hz.center
    const v = cross(bin, w, h, cx, cy, 0, 1, maxRun, mid)
    if (!v) return null
    cy += v.center
    total = (hz.total + v.total) / 2
  }
  return { x: cx, y: cy, total }
}

export function refineMarker(rgba: Uint8Array, w: number, h: number, guess: Point, size: number, mid = 3, reachFactor = 1 / 7): Marker | null {
  const bin = localBinary(rgba, w * h)
  if (!bin) return null
  const units = 4 + mid
  const maxRun = (size / units) * mid * 1.6
  const reach = Math.max(2, Math.round(size * reachFactor))
  const step = Math.max(1, Math.round(size / units / 2))
  const [gx, gy] = guess
  for (let r = 0; r <= reach; r += step) {
    for (let dy = -r; dy <= r; dy += step) {
      for (let dx = -r; dx <= r; dx += step) {
        if (r && Math.max(Math.abs(dx), Math.abs(dy)) < r) continue
        const x = Math.round(gx + dx)
        const y = Math.round(gy + dy)
        if (x < 0 || y < 0 || x >= w || y >= h || bin[y * w + x] !== 1) continue
        const hit = crossAt(bin, w, h, x, y, maxRun, mid)
        if (hit && hit.total > size * 0.6 && hit.total < size * 1.6 && Math.hypot(hit.x - gx, hit.y - gy) <= reach + size / units) {
          return { x: hit.x, y: hit.y, size: hit.total, hits: 1 }
        }
      }
    }
  }
  return null
}
