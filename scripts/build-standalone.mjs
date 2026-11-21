import { build } from 'esbuild'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const result = await build({
  entryPoints: ['demo/main.tsx'],
  bundle: true,
  minify: true,
  format: 'iife',
  target: 'es2020',
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  loader: { '.css': 'text' },
  write: false,
})
const js = result.outputFiles[0].text.replace(/<\/script/g, '<\\/script')
const css = readFileSync('src/react/pixbeam.css', 'utf8') + readFileSync('demo/demo.css', 'utf8').replace(/@import[^;]+;/g, '')
const html = readFileSync('demo/index.html', 'utf8')
  .replace('<link rel="stylesheet" href="./demo.css">', `<style>${css}</style>`)
  .replace('<script type="module" src="./main.tsx"></script>', `<script>${js}</script>`)
mkdirSync('dist', { recursive: true })
writeFileSync('dist/pixbeam.html', html)
console.log(`dist/pixbeam.html ${(html.length / 1024).toFixed(1)} KB`)
