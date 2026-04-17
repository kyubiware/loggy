module.exports = {
  '*.{ts,tsx,js,jsx}': () => 'npx biome check --write .',
  '*': () => 'npm run build',
}
