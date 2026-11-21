type Sentinel = { release(): Promise<void> }

let sentinel: Sentinel | null = null

export async function keepAwake() {
  try {
    const nav = navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<Sentinel> } }
    sentinel ??= (await nav.wakeLock?.request('screen')) ?? null
  } catch {}
}

export async function allowSleep() {
  await sentinel?.release().catch(() => {})
  sentinel = null
}
