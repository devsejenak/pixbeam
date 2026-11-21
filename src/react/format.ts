import type { PixbeamMessages } from '../i18n'

export const formatBytes = (n: number) =>
  n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(2)} MB`

export const formatTime = (s: number, t: PixbeamMessages['time']) =>
  !isFinite(s) ? '-' : s < 1 ? t.underSecond : s < 60 ? t.seconds(Math.round(s)) : t.minutes(Math.floor(s / 60), Math.round(s % 60))

export function throttle(ms: number) {
  let last = 0
  return (force = false) => {
    const now = performance.now()
    if (!force && now - last < ms) return false
    last = now
    return true
  }
}
