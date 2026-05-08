import { commitUserPointDelta, getAuthUserByIdToken, getDocument } from '../lib/firebaseRest.js';

const ADMIN_EMAIL = 'gu.correa98@gmail.com';

const getBearerToken = (request) => {
  const authorization = request.headers.authorization || '';
  return authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
};

const getSaoPauloMonthKey = () => {
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    month: '2-digit',
    year: 'numeric'
  }).formatToParts(new Date());
  const month = parts.find(part => part.type === 'month')?.value || '01';
  const year = parts.find(part => part.type === 'year')?.value || '1970';
  return `${year}-${month}`;
};

const assertAdmin = async (request) => {
  const idToken = getBearerToken(request);
  if (!idToken) throw new Error('Token de admin ausente.');

  const authUser = await getAuthUserByIdToken(idToken);
  if (!authUser?.uid || !authUser.email) throw new Error('Token de admin invalido.');
  if (authUser.email === ADMIN_EMAIL) return authUser;

  const userProfile = await getDocument('users', authUser.uid);
  if (userProfile?.role !== 'admin') throw new Error('Usuario sem permissao de admin.');
  return authUser;
};

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Metodo nao permitido.' });
  }

  try {
    await assertAdmin(request);

    const uid = String(request.body?.uid || '').trim();
    const points = Number(request.body?.points || 0);
    if (!uid || !Number.isFinite(points) || points === 0) {
      return response.status(400).json({ error: 'Informe aluno e quantidade de folhas.' });
    }

    const userProfile = await getDocument('users', uid);
    if (!userProfile) return response.status(404).json({ error: 'Aluno nao encontrado.' });

    const result = await commitUserPointDelta({
      uid,
      userProfile,
      points,
      monthKey: getSaoPauloMonthKey(),
      source: 'admin_adjustment',
      sourceId: 'manual'
    });

    return response.status(200).json(result);
  } catch (error) {
    console.error('Admin points API error:', error);
    return response.status(500).json({ error: error.message || 'Nao foi possivel atualizar as folhas.' });
  }
}
