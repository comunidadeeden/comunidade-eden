import crypto from 'node:crypto';
import fs from 'node:fs';
import { getGoogleAccessToken } from './googleServiceAccount.js';

const FIRESTORE_SCOPE = 'https://www.googleapis.com/auth/datastore';
const IDENTITY_TOOLKIT_SCOPE = 'https://www.googleapis.com/auth/identitytoolkit';
const firebaseConfig = JSON.parse(fs.readFileSync(new URL('../../firebase-applet-config.json', import.meta.url), 'utf8'));

const projectId = () => process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId;
const databaseId = () => process.env.FIRESTORE_DATABASE_ID || firebaseConfig.firestoreDatabaseId || '(default)';
const webApiKey = () => process.env.FIREBASE_WEB_API_KEY || firebaseConfig.apiKey;
const appUrl = () => {
  const rawUrl = process.env.APP_URL || 'https://www.comunidadeeden.com.br';
  const normalizedUrl = rawUrl.replace(/^APP_URL=/, '').trim();
  return normalizedUrl.startsWith('http') ? normalizedUrl : `https://${normalizedUrl}`;
};

const firestoreBaseUrl = () => (
  `https://firestore.googleapis.com/v1/projects/${projectId()}/databases/${databaseId()}/documents`
);

const authBaseUrl = () => `https://identitytoolkit.googleapis.com/v1/projects/${projectId()}`;

const toFirestoreValue = (value) => {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (typeof value === 'string') return { stringValue: value };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toFirestoreValue) } };
  return {
    mapValue: {
      fields: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, toFirestoreValue(item)]))
    }
  };
};

const fromFirestoreValue = (value) => {
  if (!value) return undefined;
  if ('nullValue' in value) return null;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('stringValue' in value) return value.stringValue;
  if ('timestampValue' in value) return value.timestampValue;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(fromFirestoreValue);
  if ('mapValue' in value) {
    return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([key, item]) => [key, fromFirestoreValue(item)]));
  }
  return undefined;
};

const fromFirestoreDocument = (document) => {
  if (!document?.fields) return null;
  return Object.fromEntries(Object.entries(document.fields).map(([key, value]) => [key, fromFirestoreValue(value)]));
};

const authorizedFetch = async (url, options = {}, scopes = [FIRESTORE_SCOPE]) => {
  const accessToken = await getGoogleAccessToken(scopes);
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const responseText = await response.text();
  const body = responseText ? JSON.parse(responseText) : {};
  return { response, body };
};

export const getDocument = async (collection, id) => {
  const { response, body } = await authorizedFetch(`${firestoreBaseUrl()}/${collection}/${encodeURIComponent(id)}`);
  if (response.status === 404) return null;
  if (!response.ok) {
    console.error('Firestore get error:', body);
    throw new Error(`Nao foi possivel ler ${collection}/${id}.`);
  }
  return fromFirestoreDocument(body);
};

export const setDocument = async (collection, id, data) => {
  const fields = Object.fromEntries(Object.entries(data).map(([key, value]) => [key, toFirestoreValue(value)]));
  const updateMask = Object.keys(data)
    .map(key => `updateMask.fieldPaths=${encodeURIComponent(key)}`)
    .join('&');
  const separator = updateMask ? '?' : '';

  const { response, body } = await authorizedFetch(`${firestoreBaseUrl()}/${collection}/${encodeURIComponent(id)}${separator}${updateMask}`, {
    method: 'PATCH',
    body: JSON.stringify({ fields })
  });

  if (!response.ok) {
    console.error('Firestore set error:', body);
    throw new Error(`Nao foi possivel salvar ${collection}/${id}.`);
  }

  return fromFirestoreDocument(body);
};

export const createAuthUserIfNeeded = async ({ email, name }) => {
  const scopes = [IDENTITY_TOOLKIT_SCOPE];
  const lookup = await authorizedFetch(`${authBaseUrl()}/accounts:lookup?key=${webApiKey()}`, {
    method: 'POST',
    body: JSON.stringify({ email: [email] })
  }, scopes);

  if (lookup.response.ok && lookup.body.users?.[0]?.localId) {
    return { uid: lookup.body.users[0].localId, created: false };
  }

  const temporaryPassword = crypto.randomBytes(32).toString('base64url');
  const create = await authorizedFetch(`${authBaseUrl()}/accounts?key=${webApiKey()}`, {
    method: 'POST',
    body: JSON.stringify({
      email,
      password: temporaryPassword,
      displayName: name || email,
      emailVerified: true,
      disabled: false
    })
  }, scopes);

  if (!create.response.ok) {
    console.error('Firebase Auth create user error:', create.body);
    throw new Error(`Nao foi possivel criar o usuario no Firebase Auth (${create.response.status}): ${JSON.stringify(create.body)}`);
  }

  return { uid: create.body.localId, created: true };
};

export const getAuthUserByEmail = async (email) => {
  const scopes = [IDENTITY_TOOLKIT_SCOPE];
  const lookup = await authorizedFetch(`${authBaseUrl()}/accounts:lookup?key=${webApiKey()}`, {
    method: 'POST',
    body: JSON.stringify({ email: [email] })
  }, scopes);

  if (!lookup.response.ok) {
    console.error('Firebase Auth lookup error:', lookup.body);
    throw new Error('Nao foi possivel consultar o usuario no Firebase Auth.');
  }

  const user = lookup.body.users?.[0];
  return user?.localId ? { uid: user.localId, email: user.email } : null;
};

export const getAuthUserByIdToken = async (idToken) => {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${webApiKey()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken })
  });
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error('Firebase Auth idToken lookup error:', body);
    throw new Error('Token de autenticacao invalido.');
  }

  const user = body.users?.[0];
  return user?.localId ? { uid: user.localId, email: user.email } : null;
};

export const generatePasswordSetupLink = async (email) => {
  const scopes = [IDENTITY_TOOLKIT_SCOPE];
  const result = await authorizedFetch(`${authBaseUrl()}/accounts:sendOobCode?key=${webApiKey()}`, {
    method: 'POST',
    body: JSON.stringify({
      requestType: 'PASSWORD_RESET',
      email,
      continueUrl: `${appUrl()}/auth/action`,
      returnOobLink: true
    })
  }, scopes);

  if (!result.response.ok || !result.body.oobLink) {
    console.error('Firebase Auth OOB link error:', result.body);
    throw new Error(`Nao foi possivel gerar o link de criacao de senha (${result.response.status}): ${JSON.stringify(result.body)}`);
  }

  const firebaseActionUrl = new URL(result.body.oobLink);
  const customActionUrl = new URL('/auth/action', appUrl());
  customActionUrl.searchParams.set('mode', 'resetPassword');
  customActionUrl.searchParams.set('oobCode', firebaseActionUrl.searchParams.get('oobCode') || '');
  customActionUrl.searchParams.set('apiKey', webApiKey());
  return customActionUrl.toString();
};

export const findOfferByHotmartId = async (hotmartKey) => {
  const map = process.env.HOTMART_OFFER_MAP ? JSON.parse(process.env.HOTMART_OFFER_MAP) : {};
  return map[hotmartKey] || null;
};
