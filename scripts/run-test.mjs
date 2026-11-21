import { build } from 'esbuild'
import { spawnSync } from 'node:child_process'

const name = process.argv[2] ?? 'node'
const outfile = `test/out/${name}.cjs`
await build({ entryPoints: [`test/${name}.ts`], bundle: true, platform: 'node', format: 'cjs', outfile, logLevel: 'warning' })
const run = spawnSync('node', [outfile, ...process.argv.slice(3)], { stdio: 'inherit' })
process.exit(run.status ?? 1)
