#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const crypto = require('node:crypto');

const AMO_BASE_URL =
  'https://addons.mozilla.org/api/v5/addons/addon/loggy@devtools-extension/';

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

function appendChangelog(currentDescription, version, changelog) {
  const base = (currentDescription || '').trim();
  const trimmedChangelog = (changelog || '').trim();
  const separator = base ? '\n\n' : '';
  return `${base}${separator}**v${version}**\n\n${trimmedChangelog}`.trim();
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
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
}

async function patchDescription(token, description) {
  const patchResponse = await fetchWithAuth(
    AMO_BASE_URL,
    {
      method: 'PATCH',
      body: JSON.stringify({
        description: {
          'en-US': description,
        },
      }),
    },
    token
  );

  if (!patchResponse.ok) {
    const body = await readResponseBody(patchResponse);
    console.error(`AMO PATCH failed (${patchResponse.status}): ${body}`);
    process.exit(1);
  }

  return patchResponse;
}

async function run() {
  const issuer = readRequiredEnv('AMO_API_KEY', 'WEB_EXT_API_KEY');
  const secret = readRequiredEnv('AMO_API_SECRET', 'WEB_EXT_API_SECRET');

  const replaceFile = readEnv('REPLACE_DESCRIPTION');

  const token = createJwt(issuer, secret);

  if (replaceFile) {
    const resolvedPath = path.resolve(replaceFile);
    const description = fs.readFileSync(resolvedPath, 'utf8').trim();
    await patchDescription(token, description);
    console.log(`Replaced AMO description from ${resolvedPath}`);
    process.exit(0);
  }

  const version = readRequiredEnv('VERSION');
  const changelog = readRequiredEnv('CHANGELOG');

  // Build description from the repo's source of truth instead of reading
  // from AMO. The AMO API returns cleaned HTML on GET, so a read-modify-write
  // cycle causes double-encoding (HTML → Markdown append → re-sanitize).
  const baseDescriptionPath = path.resolve(__dirname, 'amo-description.md');
  const baseDescription = fs.readFileSync(baseDescriptionPath, 'utf8').trim();
  const updatedDescription = appendChangelog(baseDescription, version, changelog);

  await patchDescription(token, updatedDescription);
  console.log(`Updated AMO description for v${version}`);
  process.exit(0);
}

module.exports = {
  createJwt,
  appendChangelog,
  patchDescription,
  run,
};

if (require.main === module) {
  run().catch((error) => {
    console.error(error?.message || String(error));
    process.exit(1);
  });
}
