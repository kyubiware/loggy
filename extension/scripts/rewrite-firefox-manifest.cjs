const { join } = require('node:path');

const distDir = join(__dirname, '..', 'dist-firefox');
// Content scripts are now registered dynamically at runtime.
// This script is retained for build pipeline compatibility.
console.log('Content script manifest rewriting skipped (dynamic registration)');
