import crypto from 'node:crypto';

const cachedTokens = new Map();

const base64Url = (value) => Buffer
  .from(typeof value === 'string' ? value : JSON.stringify(value))
  .toString('base64')
  .replace(/=/g, '')
  .replace(/\+/g, '-')
  .replace(/\//g, '_');

const getPrivateKey = () => {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (!privateKey) throw new Error('FIREBASE_PRIVATE_KEY nao foi configurada.');
  return privateKey.replace(/\\n/g, '\n');
};

export const getGoogleAccessToken = async (scopes = []) => {
  const scopeKey = [...scopes].sort().join(' ');
  const cachedToken = cachedTokens.get(scopeKey);
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.accessToken;
  }

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  if (!clientEmail) throw new Error('FIREBASE_CLIENT_EMAIL nao foi configurada.');

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: clientEmail,
    scope: scopeKey,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  };

  const unsignedToken = `${base64Url(header)}.${base64Url(claims)}`;
  const signature = crypto
    .createSign('RSA-SHA256')
    .update(unsignedToken)
    .sign(getPrivateKey(), 'base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsignedToken}.${signature}`
    })
  });

  const tokenBody = await tokenResponse.json().catch(() => ({}));
  if (!tokenResponse.ok) {
    console.error('Google OAuth error:', tokenBody);
    throw new Error('Nao foi possivel autenticar a Service Account do Firebase.');
  }

  cachedTokens.set(scopeKey, {
    accessToken: tokenBody.access_token,
    expiresAt: Date.now() + Number(tokenBody.expires_in || 3600) * 1000
  });

  return tokenBody.access_token;
};
