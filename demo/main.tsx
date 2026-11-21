import { createRoot } from 'react-dom/client'
import { Pixbeam } from '../src/react'

// Open the demo with ?lang=id for Indonesian.
const locale = new URLSearchParams(location.search).get('lang') === 'id' ? 'id' : 'en'
document.documentElement.lang = locale

createRoot(document.getElementById('root')!).render(<Pixbeam locale={locale} />)
