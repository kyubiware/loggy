const { existsSync, statSync } = require('node:fs');
const { join, resolve } = require('node:path');
const crx3 = require('crx3');

const rootDir = resolve(__dirname, '..');
const manifestPath = join(rootDir, 'dist-chrome', 'manifest.json');
const outputFile = join(rootDir, 'loggy-chrome.crx');
const keyFile = join(rootDir, 'loggy-chrome.pem');

// Verify the build exists
if (!existsSync(manifestPath)) {
  console.error('Build output not found. Run "npm run build:chrome" first.');
  process.exit(1);
}

// Pack the CRX (generates .pem if missing, reuses if exists)
crx3([manifestPath], {
  keyPath: keyFile,
  crxPath: outputFile,
})
  .then(() => {
    const sizeKB = Math.round(statSync(outputFile).size / 1024);
    console.log(`Created ${outputFile} (${sizeKB} KB)`);
  })
  .catch((err) => {
    console.error('Failed to pack CRX:', err.message);
    process.exit(1);
  });
