export type RGB = [number, number, number]

export const HEADER_SIZE = 18
export const TARGET_PACKET = 240
export const BIT_MODES = [3, 2, 1] as const
export type Bits = (typeof BIT_MODES)[number]

export interface Preset {
  id: string
  w: number
  h: number
  u: number
}

export const PRESETS: Preset[] = [
  { id: '128x72', w: 128, h: 72, u: 2 },
  { id: '160x90', w: 160, h: 90, u: 2 },
  { id: '192x108', w: 192, h: 108, u: 2 },
  { id: '240x135', w: 240, h: 135, u: 3 },
  { id: '288x162', w: 288, h: 162, u: 3 },
  { id: '320x180', w: 320, h: 180, u: 4 },
]

export const PALETTES: Record<Bits, RGB[]> = {
  3: [[0, 0, 0], [0, 0, 255], [0, 255, 0], [0, 255, 255], [255, 0, 0], [255, 0, 255], [255, 255, 0], [255, 255, 255]],
  2: [[255, 255, 255], [255, 0, 0], [0, 255, 0], [0, 0, 255]],
  1: [[0, 0, 0], [255, 255, 255]],
}
