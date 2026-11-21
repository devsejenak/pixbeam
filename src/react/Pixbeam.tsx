import { useEffect, useMemo, useState } from 'react'
import { PixbeamConfig, resolveConfig } from '../config'
import { ReceiveView } from './ReceiveView'
import { SendView } from './SendView'

type Tab = 'kirim' | 'terima'

const tabFromHash = (): Tab => (typeof location !== 'undefined' && location.hash === '#terima' ? 'terima' : 'kirim')

export interface PixbeamProps {
  config?: Partial<PixbeamConfig>
  heading?: string
  intro?: string
}

export function Pixbeam({ config: overrides, heading, intro }: PixbeamProps) {
  const config = useMemo(() => resolveConfig(overrides), [])
  const [tab, setTab] = useState<Tab>('kirim')

  useEffect(() => {
    const onHash = () => setTab(tabFromHash())
    onHash()
    addEventListener('hashchange', onHash)
    return () => removeEventListener('hashchange', onHash)
  }, [])

  return (
    <div className="pb">
      <nav className="pb-tabs" aria-label="Mode Pixbeam">
        <div className="pb-tabs-inner">
          {(['kirim', 'terima'] as Tab[]).map((t) => (
            <a key={t} href={`#${t}`} className={tab === t ? 'on' : ''} aria-current={tab === t ? 'page' : undefined}>
              {t === 'kirim' ? 'Kirim' : 'Terima'}
            </a>
          ))}
        </div>
      </nav>
      <div className="pb-body">
        {heading && <h1 className="pb-title">{heading}</h1>}
        {intro && <p className="pb-intro">{intro}</p>}
        <SendView config={config} active={tab === 'kirim'} />
        <ReceiveView config={config} active={tab === 'terima'} />
      </div>
    </div>
  )
}
