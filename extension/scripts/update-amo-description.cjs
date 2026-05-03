#!/usr/bin/env node

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
  const separator = base ? `\n\n---\n\n` : '';
  return `${base}${separator}## v${version}\n\n${trimmedChangelog}`.trim();
}

function readRequiredEnv(key) {
  const value = process.env[key];
  if (!value) {
    console.error(`Missing required env var: ${key}`);
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

async function run() {
  const issuer = readRequiredEnv('AMO_API_KEY');
  const secret = readRequiredEnv('AMO_API_SECRET');
  const version = readRequiredEnv('VERSION');
  const changelog = readRequiredEnv('CHANGELOG');

  const token = createJwt(issuer, secret);

  const getResponse = await fetchWithAuth(AMO_BASE_URL, { method: 'GET' }, token);
  if (!getResponse.ok) {
    const body = await readResponseBody(getResponse);
    console.error(`AMO GET failed (${getResponse.status}): ${body}`);
    process.exit(1);
  }

  const getJson = await getResponse.json();
  const currentDescription =
    (getJson && getJson.description && getJson.description['en-US']) || '';
  const updatedDescription = appendChangelog(currentDescription, version, changelog);

  const patchResponse = await fetchWithAuth(
    AMO_BASE_URL,
    {
      method: 'PATCH',
      body: JSON.stringify({
        description: {
          'en-US': updatedDescription,
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

  console.log(`Updated AMO description for v${version}`);
  process.exit(0);
}

module.exports = {
  createJwt,
  appendChangelog,
  run,
};

if (require.main === module) {
  run().catch((error) => {
    console.error(error?.message || String(error));
    process.exit(1);
  });
}
