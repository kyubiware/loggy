const { readdirSync, readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const distDir = join(__dirname, '..', 'dist-firefox');
const directories = ['assets', 'chunks'];

for (const dir of directories) {
  const dirPath = join(distDir, dir);
  let jsFiles;
  try {
    jsFiles = readdirSync(dirPath).filter((fileName) => fileName.endsWith('.js'));
  } catch {
    continue;
  }

  for (const fileName of jsFiles) {
    const filePath = join(dirPath, fileName);
    const source = readFileSync(filePath, 'utf8');
    const sanitized = source.replace(/\.innerHTML=([A-Za-z_$][\w$]*)/g, '.textContent=$1');

    if (sanitized !== source) {
      writeFileSync(filePath, sanitized);
      console.log(`Sanitized innerHTML in ${dir}/${fileName}`);
    }
  }
}
