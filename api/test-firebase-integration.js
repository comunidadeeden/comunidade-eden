import { getGoogleAccessToken } from './lib/googleServiceAccount.js';
import { getDocument, setDocument } from './lib/firebaseRest.js';

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Metodo nao permitido.' });
  }

  const expectedSecret = process.env.ACCESS_EMAIL_TEST_SECRET;
  if (!expectedSecret) {
    return response.status(404).json({ error: 'Endpoint de teste desativado.' });
  }

  if (request.headers['x-eden-test-secret'] !== expectedSecret) {
    return response.status(401).json({ error: 'Nao autorizado.' });
  }

  const checks = [];
  const addCheck = (name, ok, detail = null) => checks.push({ name, ok, detail });

  try {
    addCheck('env:FIREBASE_PROJECT_ID', Boolean(process.env.FIREBASE_PROJECT_ID), process.env.FIREBASE_PROJECT_ID || null);
    addCheck('env:FIRESTORE_DATABASE_ID', Boolean(process.env.FIRESTORE_DATABASE_ID), process.env.FIRESTORE_DATABASE_ID || null);
    addCheck('env:FIREBASE_WEB_API_KEY', Boolean(process.env.FIREBASE_WEB_API_KEY), process.env.FIREBASE_WEB_API_KEY ? 'configured' : null);
    addCheck('env:FIREBASE_CLIENT_EMAIL', Boolean(process.env.FIREBASE_CLIENT_EMAIL), process.env.FIREBASE_CLIENT_EMAIL || null);
    addCheck('env:FIREBASE_PRIVATE_KEY', Boolean(process.env.FIREBASE_PRIVATE_KEY), process.env.FIREBASE_PRIVATE_KEY ? 'configured' : null);

    await getGoogleAccessToken(['https://www.googleapis.com/auth/datastore']);
    addCheck('google_access_token:datastore', true);

    const docId = `diagnostic-${Date.now()}`;
    await setDocument('webhookEvents', docId, {
      provider: 'diagnostic',
      eventId: docId,
      receivedAt: new Date(),
      status: 'ok'
    });
    addCheck('firestore:write', true, docId);

    const stored = await getDocument('webhookEvents', docId);
    addCheck('firestore:read', Boolean(stored?.eventId === docId), stored?.eventId || null);

    return response.status(200).json({ ok: true, checks });
  } catch (error) {
    console.error('Firebase integration diagnostic error:', error);
    addCheck('error', false, error.message);
    return response.status(500).json({ ok: false, checks });
  }
}
