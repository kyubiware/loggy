export default {
  'extension/**/*.{ts,tsx,js,cjs}': [
    'biome check --write --no-errors-on-unmatched',
    () => 'npm run typecheck --workspace=extension',
  ],
  'extension/**/*.{test,spec}.{ts,tsx}': () => 'npm test --workspace=extension',
}
