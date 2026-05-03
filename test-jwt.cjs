const crypto = require('crypto');
function createJwt(issuer, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    iss: issuer,
    jti: Math.random().toString(),
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 300
  };
  const toBase64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const token = `${toBase64(header)}.${toBase64(payload)}`;
  const signature = crypto.createHmac('sha256', secret).update(token).digest('base64url');
  return `${token}.${signature}`;
}
console.log(createJwt('my-issuer', 'my-secret'));
