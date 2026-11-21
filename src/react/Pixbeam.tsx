import { useEffect, useMemo, useState } from 'react'
import { PixbeamConfig, resolveConfig } from '../config'
import { DeepPartial, locales, PixbeamLocale, PixbeamMessages, resolveMessages } from '../i18n'
import { ReceiveView } from './ReceiveView'
import { SendView } from './SendView'

type Tab = 'send' | 'receive'

export interface PixbeamProps {
  config?: Partial<PixbeamConfig>
  /** Built-in UI language. Defaults to `'en'`. */
  locale?: PixbeamLocale
  /** Override any UI text on top of `locale`. */
  messages?: DeepPartial<PixbeamMessages>
  heading?: string
  intro?: string
}

function tabFromHash(m: PixbeamMessages): Tab {
  if (typeof location === 'undefined') return 'send'
  const hash = decodeURIComponent(location.hash.slice(1))
  const receive = new Set([m.tabs.receiveHash, ...Object.values(locales).map((l) => l.tabs.receiveHash)])
  return receive.has(hash) ? 'receive' : 'send'
}

export function Pixbeam({ config: overrides, locale = 'en', messages: textOverrides, heading, intro }: PixbeamProps) {
  const config = useMemo(() => resolveConfig(overrides), [])
  const m = useMemo(() => resolveMessages(locale, textOverrides), [locale, textOverrides])
  const [tab, setTab] = useState<Tab>('send')

  useEffect(() => {
    const onHash = () => setTab(tabFromHash(m))
    onHash()
    addEventListener('hashchange', onHash)
    return () => removeEventListener('hashchange', onHash)
  }, [m])

  return (
    <div className="pb">
      <nav className="pb-tabs" aria-label={m.tabs.label}>
        <div className="pb-tabs-inner">
          {(['send', 'receive'] as Tab[]).map((t) => (
            <a
              key={t}
              href={`#${t === 'send' ? m.tabs.sendHash : m.tabs.receiveHash}`}
              className={tab === t ? 'on' : ''}
              aria-current={tab === t ? 'page' : undefined}
            >
              {t === 'send' ? m.tabs.send : m.tabs.receive}
            </a>
          ))}
        </div>
      </nav>
      <div className="pb-body">
        {heading && <h1 className="pb-title">{heading}</h1>}
        {intro && <p className="pb-intro">{intro}</p>}
        <SendView config={config} messages={m} active={tab === 'send'} />
        <ReceiveView config={config} messages={m} active={tab === 'receive'} />
      </div>
    </div>
  )
}
