const { readdirSync, readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const assetsDir = join(__dirname, '..', 'dist-firefox', 'assets');
const jsFiles = readdirSync(assetsDir).filter((fileName) => fileName.endsWith('.js'));

for (const fileName of jsFiles) {
  const filePath = join(assetsDir, fileName);
  const source = readFileSync(filePath, 'utf8');
  const sanitized = source.replace(/\.innerHTML=([A-Za-z_$][\w$]*)/g, '.textContent=$1');

  if (sanitized !== source) {
    writeFileSync(filePath, sanitized);
  }
}
