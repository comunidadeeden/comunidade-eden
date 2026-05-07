import { getAuthUserByIdToken, getDocument, incrementDocumentField } from '../lib/firebaseRest.js';

const getBearerToken = (request) => {
  const authorization = request.headers.authorization || '';
  return authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
};

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Metodo nao permitido.' });
  }

  try {
    const idToken = getBearerToken(request);
    if (!idToken) return response.status(401).json({ error: 'Token ausente.' });

    const authUser = await getAuthUserByIdToken(idToken);
    if (!authUser?.uid) return response.status(401).json({ error: 'Token invalido.' });

    const offerId = String(request.body?.offerId || '').trim();
    if (!offerId || offerId.length > 160 || !/^[a-zA-Z0-9_-]+$/.test(offerId)) {
      return response.status(400).json({ error: 'Oferta invalida.' });
    }

    const offer = await getDocument('offers', offerId);
    if (!offer) return response.status(404).json({ error: 'Oferta nao encontrada.' });

    await incrementDocumentField('offers', offerId, 'clickCount', 1);
    return response.status(200).json({ ok: true });
  } catch (error) {
    console.error('Offer click API error:', error);
    return response.status(500).json({ error: 'Nao foi possivel registrar o clique.' });
  }
}
