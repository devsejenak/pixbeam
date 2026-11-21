// package.json "exports" points at src/ for the monorepo. Only pnpm applies
// publishConfig.exports (pointing at dist/), so block npm/yarn publish.
const agent = process.env.npm_config_user_agent ?? ''
if (!agent.startsWith('pnpm/')) {
  console.error('Publish pixbeam with `pnpm publish`, not npm or yarn.')
  console.error('Only pnpm rewrites "exports" to dist/ via publishConfig.')
  process.exit(1)
}
