import { commitDailyMissionReward, getAuthUserByIdToken, getDocument } from '../lib/firebaseRest.js';

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

const hasAnswer = (value) => {
  if (Array.isArray(value)) return value.length > 0;
  return typeof value === 'string' && value.trim().length > 0;
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

    const challengeDate = String(request.body?.challengeDate || '').trim();
    const audioChecked = Boolean(request.body?.audioChecked);
    const responses = request.body?.responses || {};
    if (!challengeDate || !audioChecked) {
      return response.status(400).json({ error: 'Missao incompleta.' });
    }

    const challenge = await getDocument('dailyChallenges', challengeDate);
    if (!challenge) return response.status(404).json({ error: 'Missao nao encontrada.' });

    for (const question of challenge.questions || []) {
      if (!hasAnswer(responses[question.id])) {
        return response.status(400).json({ error: `A pergunta "${question.label}" e obrigatoria.` });
      }
    }

    const completionId = `${authUser.uid}_${challengeDate}`;
    const result = await commitDailyMissionReward({
      uid: authUser.uid,
      userProfile,
      completionId,
      challengeDate,
      audioChecked,
      responses,
      monthKey: getSaoPauloMonthKey(),
      points: 30
    });

    return response.status(200).json(result);
  } catch (error) {
    console.error('Mission reward API error:', error);
    return response.status(500).json({ error: 'Nao foi possivel concluir a missao.' });
  }
}
