import { Bits } from './core'
import { Orientation } from './web/sender'

export interface PixbeamConfig {
  debug: boolean
  testPattern: boolean
  defaultPreset: string
  defaultBits: Bits
  defaultFps: number
  defaultOrientation: Orientation
  maxFps: number
  cameraFps: number
  autoZoom: boolean
  lockExposure: boolean
}

export const defaultConfig: PixbeamConfig = {
  debug: false,
  testPattern: false,
  defaultPreset: '320x180',
  defaultBits: 1,
  defaultFps: 20,
  defaultOrientation: 'portrait',
  maxFps: 30,
  cameraFps: 30,
  autoZoom: true,
  lockExposure: true,
}

export function resolveConfig(overrides?: Partial<PixbeamConfig>): PixbeamConfig {
  return { ...defaultConfig, ...overrides }
}
