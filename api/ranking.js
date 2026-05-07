import { getAuthUserByIdToken, getDocument, queryTopUsersByPoints } from './lib/firebaseRest.js';

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
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'Metodo nao permitido.' });
  }

  try {
    const idToken = getBearerToken(request);
    if (!idToken) return response.status(401).json({ error: 'Token ausente.' });

    const authUser = await getAuthUserByIdToken(idToken);
    if (!authUser?.uid) return response.status(401).json({ error: 'Token invalido.' });

    const requester = await getDocument('users', authUser.uid);
    if (!requester || requester.isBlocked || isAccessExpired(requester.accessExpiresAt)) {
      return response.status(403).json({ error: 'Acesso indisponivel.' });
    }

    const users = await queryTopUsersByPoints(5);
    return response.status(200).json({
      users: users.map((user) => ({
        uid: user.uid,
        name: user.name || 'Aluna',
        avatar: user.avatar || '',
        points: user.points || 0
      }))
    });
  } catch (error) {
    console.error('Ranking API error:', error);
    return response.status(500).json({ error: 'Nao foi possivel carregar o ranking.' });
  }
}
