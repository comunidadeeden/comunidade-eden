import { getAuthUserByIdToken, getDocument, incrementDocumentField } from '../../server/lib/firebaseRest.js';

const getBearerToken = (request) => {
  const authorization = request.headers.authorization || '';
  return authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
};

const isAccessExpired = (date) => {
  if (!date) return false;
  const parsedDate = date.includes('-') && date.split('-')[0].length === 4
    ? new Date(`${date}T23:59:59`)
    : (() => {
      const [day, month, year] = String(date).split('-').map(Number);
      return new Date(year || 0, (month || 1) - 1, day || 1, 23, 59, 59, 999);
    })();
  parsedDate.setHours(23, 59, 59, 999);
  return new Date() > parsedDate;
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

    const userProfile = await getDocument('users', authUser.uid);
    if (!userProfile || userProfile.isBlocked || isAccessExpired(userProfile.accessExpiresAt)) {
      return response.status(403).json({ error: 'Acesso indisponivel.' });
    }

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
