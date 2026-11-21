import { build } from 'esbuild'
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

rmSync('dist', { recursive: true, force: true })

await build({
  entryPoints: ['src/index.ts', 'src/react/index.ts'],
  outbase: 'src',
  outdir: 'dist',
  bundle: true,
  splitting: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2020',
  jsx: 'automatic',
  external: ['react', 'react/*', 'react-dom', 'react-dom/*'],
  chunkNames: 'chunks/[name]-[hash]',
})

copyFileSync('src/react/pixbeam.css', 'dist/style.css')

const tsc = join(dirname(createRequire(import.meta.url).resolve('typescript/package.json')), 'bin', 'tsc')
execFileSync(process.execPath, [tsc, '-p', 'tsconfig.build.json'], { stdio: 'inherit' })

// Declaration files keep extensionless imports ('./core'). Add explicit paths
// so consumers using moduleResolution node16/nodenext can resolve them.
const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })

for (const file of walk('dist').filter((f) => f.endsWith('.d.ts'))) {
  const src = readFileSync(file, 'utf8')
  const out = src.replace(/(from\s+|import\s*\(\s*)(['"])(\.{1,2}\/[^'"]*)\2/g, (match, lead, quote, spec) => {
    if (/\.(js|css)$/.test(spec)) return match
    const base = join(dirname(file), spec)
    if (existsSync(`${base}.d.ts`)) return `${lead}${quote}${spec}.js${quote}`
    if (existsSync(join(base, 'index.d.ts'))) return `${lead}${quote}${spec}/index.js${quote}`
    throw new Error(`Cannot resolve ${spec} in ${file}`)
  })
  if (out !== src) writeFileSync(file, out)
}

console.log('dist/ ready')
