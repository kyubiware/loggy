export default {
  'extension/**/*.{ts,tsx,js,cjs}': [
    'biome check --fix --no-errors-on-unmatched',
    () => 'npm run typecheck --workspace=extension',
    () => 'npm test --workspace=extension',
  ],
}
