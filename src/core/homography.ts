export type Point = [number, number]
export type Matrix3 = Float64Array

export function homography(src: Point[], dst: Point[]): Matrix3 | null {
  const a: number[][] = []
  const b: number[] = []
  for (let i = 0; i < 4; i++) {
    const [u, v] = src[i]
    const [x, y] = dst[i]
    a.push([u, v, 1, 0, 0, 0, -u * x, -v * x])
    b.push(x)
    a.push([0, 0, 0, u, v, 1, -u * y, -v * y])
    b.push(y)
  }
  for (let c = 0; c < 8; c++) {
    let p = c
    for (let r = c + 1; r < 8; r++) if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r
    ;[a[c], a[p]] = [a[p], a[c]]
    ;[b[c], b[p]] = [b[p], b[c]]
    if (Math.abs(a[c][c]) < 1e-12) return null
    for (let r = 0; r < 8; r++) {
      if (r === c) continue
      const f = a[r][c] / a[c][c]
      for (let k = c; k < 8; k++) a[r][k] -= f * a[c][k]
      b[r] -= f * b[c]
    }
  }
  const h = new Float64Array(9)
  for (let i = 0; i < 8; i++) h[i] = b[i] / a[i][i]
  h[8] = 1
  return h
}

export function project(h: Matrix3, u: number, v: number): Point {
  const d = h[6] * u + h[7] * v + h[8]
  return [(h[0] * u + h[1] * v + h[2]) / d, (h[3] * u + h[4] * v + h[5]) / d]
}
