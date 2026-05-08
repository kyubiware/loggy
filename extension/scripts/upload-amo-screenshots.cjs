#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const crypto = require('node:crypto');

const AMO_BASE_URL =
  'https://addons.mozilla.org/api/v5/addons/addon/5dcdd43f5fa642e69f21/';

const SCREENSHOTS_DIR = path.resolve(__dirname, '..', '..', 'screenshots');

const MAX_RETRY_WAIT = 120; // Cap retry wait at 2 minutes (AMO can suggest 2880s+)
const INTER_REQUEST_DELAY_MS = 2000; // 2s delay between write operations to avoid rate limits

function base64UrlEncode(value) {
  return Buffer.from(value).toString('base64url');
}

function createJwt(issuer, secret) {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const iat = Math.floor(Date.now() / 1000);
  const payload = base64UrlEncode(
    JSON.stringify({
      iss: issuer,
      jti: crypto.randomUUID(),
      iat,
      exp: iat + 60,
    })
  );
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${signature}`;
}

function readEnv(key, fallback) {
  return process.env[key] || (fallback ? process.env[fallback] : undefined);
}

function readRequiredEnv(key, fallback) {
  const value = readEnv(key, fallback);
  if (!value) {
    const label = fallback ? `${key} or ${fallback}` : key;
    console.error(`Missing required env var: ${label}`);
    process.exit(1);
  }
  return value;
}

async function readResponseBody(response) {
  try {
    return await response.text();
  } catch {
    return '<unable to read response body>';
  }
}

async function fetchWithAuth(url, options, token) {
  return fetch(url, {
    ...options,
    headers: {
      Authorization: `JWT ${token}`,
      ...(options.headers || {}),
    },
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hashBuffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function hashFile(filePath) {
  return hashBuffer(fs.readFileSync(filePath));
}

async function downloadHash(imageUrl) {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    return hashBuffer(buffer);
  } catch {
    return null;
  }
}

async function fetchWithRetry(url, options, getToken, retries = 5) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const token = typeof getToken === 'function' ? getToken() : getToken;
    const response = await fetchWithAuth(url, options, token);
    if (response.status === 429 && attempt < retries) {
      const body = await readResponseBody(response);
      const waitMatch = body.match(/(\d+)\s*second/i);
      const suggestedWait = waitMatch ? Number(waitMatch[1]) + 1 : 2 ** (attempt + 1);
      const waitSec = Math.min(suggestedWait, MAX_RETRY_WAIT);
      console.log(`  Rate limited, retrying in ${waitSec}s (attempt ${attempt + 1}/${retries})...`);
      await sleep(waitSec * 1000);
      continue;
    }
    return response;
  }
}

async function fetchAddonDetails(token) {
  const response = await fetchWithAuth(AMO_BASE_URL, { method: 'GET' }, token);
  if (!response.ok) {
    const body = await readResponseBody(response);
    console.error(`Failed to fetch addon details (${response.status}): ${body}`);
    process.exit(1);
  }
  return response.json();
}

async function deletePreview(getToken, previewId) {
  const url = `${AMO_BASE_URL}previews/${previewId}/`;
  const response = await fetchWithRetry(url, { method: 'DELETE' }, getToken);
  if (!response.ok) {
    const body = await readResponseBody(response);
    console.error(`Failed to delete preview ${previewId} (${response.status}): ${body}`);
    process.exit(1);
  }
}

async function uploadPreview(getToken, filePath, position) {
  const url = `${AMO_BASE_URL}previews/`;
  const formData = new FormData();
  const fileBuffer = fs.readFileSync(filePath);
  const blob = new Blob([fileBuffer], { type: 'image/png' });
  formData.append('image', blob, path.basename(filePath));
  formData.append('position', String(position));

  const response = await fetchWithRetry(
    url,
    {
      method: 'POST',
      body: formData,
    },
    getToken
  );

  if (!response.ok) {
    const body = await readResponseBody(response);
    console.error(`Failed to upload preview ${path.basename(filePath)} (${response.status}): ${body}`);
    process.exit(1);
  }
}

async function previewsMatchExisting(previews, localFiles) {
  if (previews.length !== localFiles.length) return false;

  for (let i = 0; i < previews.length; i++) {
    const imageUrl = previews[i].image_url;
    if (!imageUrl) return false;

    console.log(`  Comparing ${localFiles[i]}...`);
    const remoteHash = await downloadHash(imageUrl);
    if (!remoteHash) {
      console.log(`    Could not download remote preview — treating as changed.`);
      return false;
    }

    const localHash = hashFile(path.join(SCREENSHOTS_DIR, localFiles[i]));
    if (remoteHash !== localHash) {
      console.log(`    Content differs (local: ${localHash.slice(0, 8)}..., remote: ${remoteHash.slice(0, 8)}...).`);
      return false;
    }
    console.log(`    Match.`);
  }

  return true;
}

async function run() {
  const force = process.argv.includes('--force');
  const issuer = readRequiredEnv('AMO_API_KEY', 'WEB_EXT_API_KEY');
  const secret = readRequiredEnv('AMO_API_SECRET', 'WEB_EXT_API_SECRET');
  const getToken = () => createJwt(issuer, secret);

  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    console.error(`Screenshots directory not found: ${SCREENSHOTS_DIR}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(SCREENSHOTS_DIR)
    .filter((name) => name.endsWith('.png'))
    .sort();

  if (files.length === 0) {
    console.error(`No PNG screenshots found in ${SCREENSHOTS_DIR}`);
    process.exit(1);
  }

  const addonDetails = await fetchAddonDetails(getToken());
  const previews = addonDetails.previews || [];

  if (!force && previews.length > 0) {
    console.log(`Comparing ${files.length} local screenshot(s) against ${previews.length} AMO preview(s)...`);
    const match = await previewsMatchExisting(previews, files);
    if (match) {
      console.log('\n✓ Screenshots unchanged — skipping upload.');
      process.exit(0);
    }
    console.log('Screenshots differ — proceeding with upload.\n');
  } else if (force) {
    console.log('--force flag set — skipping comparison.\n');
  }

  if (previews.length > 0) {
    console.log(`Deleting ${previews.length} existing preview(s)...`);
    for (const preview of previews) {
      await deletePreview(getToken, preview.id);
      console.log(`  Deleted preview ${preview.id}`);
      await sleep(INTER_REQUEST_DELAY_MS);
    }
  }

  console.log(`Uploading ${files.length} screenshot(s)...`);
  for (let i = 0; i < files.length; i++) {
    const filePath = path.join(SCREENSHOTS_DIR, files[i]);
    await uploadPreview(getToken, filePath, i);
    console.log(`  Uploaded ${files[i]} (position ${i})`);
    if (i < files.length - 1) {
      await sleep(INTER_REQUEST_DELAY_MS);
    }
  }

  console.log(`\nDone. Uploaded ${files.length} screenshot(s) to AMO.`);
  process.exit(0);
}

module.exports = { run };

if (require.main === module) {
  run().catch((error) => {
    console.error(error?.message || String(error));
    process.exit(1);
  });
}
