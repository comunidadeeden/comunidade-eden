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

const firestoreDocumentName = (collection, id) => (
  `projects/${projectId()}/databases/${databaseId()}/documents/${collection}/${id}`
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

export const deleteDocument = async (collection, id) => {
  const { response, body } = await authorizedFetch(`${firestoreBaseUrl()}/${collection}/${encodeURIComponent(id)}`, {
    method: 'DELETE'
  });

  if (response.status === 404) return false;
  if (!response.ok) {
    console.error('Firestore delete error:', body);
    throw new Error(`Nao foi possivel excluir ${collection}/${id}.`);
  }

  return true;
};

export const queryTopUsersByPoints = async (limit = 5) => {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 5, 1000));
  const { response, body } = await authorizedFetch(`${firestoreBaseUrl()}:runQuery`, {
    method: 'POST',
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'users' }],
        orderBy: [{ field: { fieldPath: 'points' }, direction: 'DESCENDING' }],
        limit: safeLimit
      }
    })
  });

  if (!response.ok) {
    console.error('Firestore ranking query error:', body);
    throw new Error('Nao foi possivel carregar o ranking.');
  }

  return (Array.isArray(body) ? body : [])
    .map(item => item.document)
    .filter(Boolean)
    .map(document => ({
      uid: String(document.name || '').split('/').pop(),
      ...fromFirestoreDocument(document)
    }));
};

export const queryNotifications = async (limit = 20) => {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 20, 50));
  const { response, body } = await authorizedFetch(`${firestoreBaseUrl()}:runQuery`, {
    method: 'POST',
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'notifications' }],
        orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }],
        limit: safeLimit
      }
    })
  });

  if (!response.ok) {
    console.error('Firestore notifications query error:', body);
    throw new Error('Nao foi possivel carregar os avisos.');
  }

  return (Array.isArray(body) ? body : [])
    .map(item => item.document)
    .filter(Boolean)
    .map(document => ({
      id: String(document.name || '').split('/').pop(),
      ...fromFirestoreDocument(document)
    }));
};


export const queryUsers = async (limit = 1000) => {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 1000, 2000));
  const { response, body } = await authorizedFetch(`${firestoreBaseUrl()}:runQuery`, {
    method: 'POST',
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'users' }],
        limit: safeLimit
      }
    })
  });

  if (!response.ok) {
    console.error('Firestore users query error:', body);
    throw new Error('Nao foi possivel carregar os usuarios.');
  }

  return (Array.isArray(body) ? body : [])
    .map(item => item.document)
    .filter(Boolean)
    .map(document => ({
      uid: String(document.name || '').split('/').pop(),
      ...fromFirestoreDocument(document)
    }));
};

export const queryMonthlyScores = async (monthKey, limit = 20) => {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 20, 1000));
  const { response, body } = await authorizedFetch(`${firestoreBaseUrl()}:runQuery`, {
    method: 'POST',
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'monthlyScores' }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'monthKey' },
            op: 'EQUAL',
            value: toFirestoreValue(monthKey)
          }
        },
        limit: 1000
      }
    })
  });

  if (!response.ok) {
    console.error('Firestore monthly ranking query error:', body);
    throw new Error('Nao foi possivel carregar o ranking mensal.');
  }

  return (Array.isArray(body) ? body : [])
    .map(item => item.document)
    .filter(Boolean)
    .map(document => ({
      id: String(document.name || '').split('/').pop(),
      ...fromFirestoreDocument(document)
    }))
    .sort((a, b) => (b.points || 0) - (a.points || 0))
    .slice(0, safeLimit);
};

export const incrementDocumentField = async (collection, id, fieldPath, amount = 1) => {
  const { response, body } = await authorizedFetch(`https://firestore.googleapis.com/v1/projects/${projectId()}/databases/${databaseId()}/documents:commit`, {
    method: 'POST',
    body: JSON.stringify({
      writes: [
        {
          transform: {
            document: firestoreDocumentName(collection, encodeURIComponent(id)),
            fieldTransforms: [
              {
                fieldPath,
                increment: { integerValue: String(amount) }
              }
            ]
          }
        }
      ]
    })
  });

  if (!response.ok) {
    console.error('Firestore increment error:', body);
    throw new Error(`Nao foi possivel incrementar ${collection}/${id}.${fieldPath}.`);
  }

  return body;
};

const monthlyScoreWrite = ({ uid, userProfile = {}, monthKey, points, now }) => ({
  update: {
    name: firestoreDocumentName('monthlyScores', `${monthKey}_${uid}`),
    fields: {
      uid: toFirestoreValue(uid),
      monthKey: toFirestoreValue(monthKey),
      name: toFirestoreValue(userProfile.name || userProfile.email || 'Aluna'),
      avatar: toFirestoreValue(userProfile.avatar || ''),
      totalPoints: toFirestoreValue((userProfile.points || 0) + points),
      isCofounder: toFirestoreValue(Boolean(userProfile.isCofounder)),
      updatedAt: toFirestoreValue(now)
    }
  },
  updateMask: { fieldPaths: ['uid', 'monthKey', 'name', 'avatar', 'totalPoints', 'isCofounder', 'updatedAt'] },
  updateTransforms: [
    {
      fieldPath: 'points',
      increment: { integerValue: String(points) }
    }
  ]
});

const monthlyPointEventWrite = ({ uid, userProfile = {}, monthKey, points, source, sourceId, now }) => ({
  update: {
    name: firestoreDocumentName('monthlyPointEvents', `${uid}_${monthKey}_${source}_${sourceId}_${now.getTime()}`.replace(/[^a-zA-Z0-9_-]/g, '_')),
    fields: {
      userId: toFirestoreValue(uid),
      monthKey: toFirestoreValue(monthKey),
      points: toFirestoreValue(points),
      source: toFirestoreValue(source),
      sourceId: toFirestoreValue(sourceId || ''),
      userName: toFirestoreValue(userProfile.name || userProfile.email || 'Aluna'),
      createdAt: toFirestoreValue(now)
    }
  }
});

export const commitUserPointDelta = async ({ uid, userProfile = {}, points, monthKey, source, sourceId, userFields = {} }) => {
  if (!points) return { pointsAwarded: 0 };
  const now = new Date();
  const userDocument = firestoreDocumentName('users', uid);
  const userFieldsPayload = Object.fromEntries(Object.entries({
    ...userFields,
    updatedAt: now
  }).map(([key, value]) => [key, toFirestoreValue(value)]));

  const { response, body } = await authorizedFetch(`https://firestore.googleapis.com/v1/projects/${projectId()}/databases/${databaseId()}/documents:commit`, {
    method: 'POST',
    body: JSON.stringify({
      writes: [
        {
          update: {
            name: userDocument,
            fields: userFieldsPayload
          },
          updateMask: { fieldPaths: Object.keys(userFieldsPayload) },
          updateTransforms: [
            {
              fieldPath: 'points',
              increment: { integerValue: String(points) }
            }
          ],
          currentDocument: { exists: true }
        },
        monthlyScoreWrite({ uid, userProfile, monthKey, points, now }),
        monthlyPointEventWrite({ uid, userProfile, monthKey, points, source, sourceId, now })
      ]
    })
  });

  if (!response.ok) {
    console.error('User point delta commit error:', body);
    throw new Error('Nao foi possivel registrar a pontuacao.');
  }

  return { pointsAwarded: points, monthKey };
};

export const commitDailyAudioReward = async ({ uid, userProfile = {}, rewardDate, monthKey, points = 5 }) => {
  const rewardId = `${uid}_${rewardDate}`.replace(/[^a-zA-Z0-9_-]/g, '_');
  const now = new Date();
  const rewardDocument = firestoreDocumentName('dailyAudioRewards', rewardId);
  const userDocument = firestoreDocumentName('users', uid);

  const { response, body } = await authorizedFetch(`https://firestore.googleapis.com/v1/projects/${projectId()}/databases/${databaseId()}/documents:commit`, {
    method: 'POST',
    body: JSON.stringify({
      writes: [
        {
          update: {
            name: rewardDocument,
            fields: {
              userId: toFirestoreValue(uid),
              rewardDate: toFirestoreValue(rewardDate),
              points: toFirestoreValue(points),
              createdAt: toFirestoreValue(now)
            }
          },
          currentDocument: { exists: false }
        },
        monthlyScoreWrite({ uid, userProfile, monthKey, points, now }),
        monthlyPointEventWrite({ uid, userProfile, monthKey, points, source: 'daily_audio', sourceId: rewardDate, now }),
        {
          update: {
            name: userDocument,
            fields: {
              lastAudioDate: toFirestoreValue(rewardDate),
              updatedAt: toFirestoreValue(now)
            }
          },
          updateMask: { fieldPaths: ['lastAudioDate', 'updatedAt'] },
          updateTransforms: [
            {
              fieldPath: 'points',
              increment: { integerValue: String(points) }
            }
          ],
          currentDocument: { exists: true }
        }
      ]
    })
  });

  if (!response.ok) {
    const status = body?.error?.status || '';
    const message = body?.error?.message || '';
    if (status === 'ALREADY_EXISTS' || message.includes('already exists')) {
      return { rewarded: false, rewardDate, pointsAwarded: 0 };
    }
    console.error('Daily audio reward commit error:', body);
    throw new Error('Nao foi possivel registrar a recompensa do audio diario.');
  }

  return { rewarded: true, rewardDate, pointsAwarded: points };
};

export const commitDailyMissionReward = async ({ uid, userProfile = {}, completionId, challengeDate, audioChecked, responses, monthKey, points = 30 }) => {
  const now = new Date();
  const completionDocument = firestoreDocumentName('dailyChallengeCompletions', completionId);
  const userDocument = firestoreDocumentName('users', uid);

  const { response, body } = await authorizedFetch(`https://firestore.googleapis.com/v1/projects/${projectId()}/databases/${databaseId()}/documents:commit`, {
    method: 'POST',
    body: JSON.stringify({
      writes: [
        {
          update: {
            name: completionDocument,
            fields: {
              userId: toFirestoreValue(uid),
              challengeDate: toFirestoreValue(challengeDate),
              audioChecked: toFirestoreValue(Boolean(audioChecked)),
              responses: toFirestoreValue(responses || {}),
              completedAt: toFirestoreValue(now)
            }
          },
          currentDocument: { exists: false }
        },
        {
          update: {
            name: userDocument,
            fields: {
              lastMissionRewardDate: toFirestoreValue(challengeDate),
              updatedAt: toFirestoreValue(now)
            }
          },
          updateMask: { fieldPaths: ['lastMissionRewardDate', 'updatedAt'] },
          updateTransforms: [
            {
              fieldPath: 'points',
              increment: { integerValue: String(points) }
            }
          ],
          currentDocument: { exists: true }
        },
        monthlyScoreWrite({ uid, userProfile, monthKey, points, now }),
        monthlyPointEventWrite({ uid, userProfile, monthKey, points, source: 'daily_mission', sourceId: challengeDate, now })
      ]
    })
  });

  if (!response.ok) {
    const status = body?.error?.status || '';
    const message = body?.error?.message || '';
    if (status === 'ALREADY_EXISTS' || message.includes('already exists')) {
      return { rewarded: false, challengeDate, pointsAwarded: 0 };
    }
    console.error('Daily mission reward commit error:', body);
    throw new Error('Nao foi possivel registrar a missao diaria.');
  }

  return { rewarded: true, challengeDate, pointsAwarded: points };
};

export const commitDailyCommitmentReward = async ({ uid, userProfile = {}, completionId, date, activity, monthKey, points = 10 }) => {
  const now = new Date();
  const completionDocument = firestoreDocumentName('dailyCommitmentCompletions', completionId);
  const userDocument = firestoreDocumentName('users', uid);

  const { response, body } = await authorizedFetch(`https://firestore.googleapis.com/v1/projects/${projectId()}/databases/${databaseId()}/documents:commit`, {
    method: 'POST',
    body: JSON.stringify({
      writes: [
        {
          update: {
            name: completionDocument,
            fields: {
              userId: toFirestoreValue(uid),
              date: toFirestoreValue(date),
              activity: toFirestoreValue(activity),
              completedAt: toFirestoreValue(now)
            }
          },
          currentDocument: { exists: false }
        },
        {
          update: {
            name: userDocument,
            fields: {
              updatedAt: toFirestoreValue(now)
            }
          },
          updateMask: { fieldPaths: ['updatedAt'] },
          updateTransforms: [
            {
              fieldPath: 'points',
              increment: { integerValue: String(points) }
            }
          ],
          currentDocument: { exists: true }
        },
        monthlyScoreWrite({ uid, userProfile, monthKey, points, now }),
        monthlyPointEventWrite({ uid, userProfile, monthKey, points, source: 'daily_commitment', sourceId: date, now })
      ]
    })
  });

  if (!response.ok) {
    const status = body?.error?.status || '';
    const message = body?.error?.message || '';
    if (status === 'ALREADY_EXISTS' || message.includes('already exists')) {
      return { rewarded: false, date, pointsAwarded: 0 };
    }
    console.error('Daily commitment reward commit error:', body);
    throw new Error('Nao foi possivel registrar o selo de compromisso.');
  }

  return { rewarded: true, date, pointsAwarded: points };
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


export const setAuthUserPassword = async (uid, password) => {
  const scopes = [IDENTITY_TOOLKIT_SCOPE];
  const result = await authorizedFetch(`${authBaseUrl()}/accounts:update?key=${webApiKey()}`, {
    method: 'POST',
    body: JSON.stringify({
      localId: uid,
      password,
      emailVerified: true
    })
  }, scopes);

  if (!result.response.ok) {
    console.error('Firebase Auth set password error:', result.body);
    throw new Error('Nao foi possivel salvar a senha no Firebase Auth.');
  }

  return true;
};

export const setAuthUserDisabled = async (uid, disabled) => {
  const scopes = [IDENTITY_TOOLKIT_SCOPE];
  const result = await authorizedFetch(`${authBaseUrl()}/accounts:update?key=${webApiKey()}`, {
    method: 'POST',
    body: JSON.stringify({
      localId: uid,
      disableUser: Boolean(disabled)
    })
  }, scopes);

  if (!result.response.ok) {
    console.error('Firebase Auth disable user error:', result.body);
    throw new Error('Nao foi possivel atualizar o acesso do usuario no Firebase Auth.');
  }

  return true;
};

export const deleteAuthUser = async (uid) => {
  const scopes = [IDENTITY_TOOLKIT_SCOPE];
  const result = await authorizedFetch(`${authBaseUrl()}/accounts:delete?key=${webApiKey()}`, {
    method: 'POST',
    body: JSON.stringify({ localId: uid })
  }, scopes);

  if (!result.response.ok) {
    if (result.body?.error?.message === 'USER_NOT_FOUND') return false;
    console.error('Firebase Auth delete user error:', result.body);
    throw new Error('Nao foi possivel excluir o usuario no Firebase Auth.');
  }

  return true;
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
