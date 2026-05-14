import { commitDailyCommitmentReward, commitDailyMissionReward, getAuthUserByIdToken, getDocument, setDocument } from '../lib/firebaseRest.js';

const getBearerToken = (request) => {
  const authorization = request.headers.authorization || '';
  return authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
};

const getSaoPauloDateKey = () => {
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).formatToParts(new Date());
  const day = parts.find(part => part.type === 'day')?.value || '01';
  const month = parts.find(part => part.type === 'month')?.value || '01';
  const year = parts.find(part => part.type === 'year')?.value || '1970';
  return `${day}-${month}-${year}`;
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

const CIA_REQUIRED_FIELDS = ['percepcao', 'decisao', 'acao', 'sabotagem'];

const hasAnswer = (value) => {
  if (Array.isArray(value)) return value.length > 0;
  return typeof value === 'string' && value.trim().length > 0;
};

const getSaoPauloWeekKey = () => {
  const now = new Date();
  const saoPauloNow = new Date(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric'
  }).format(now));
  const day = saoPauloNow.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  saoPauloNow.setDate(saoPauloNow.getDate() + diffToMonday);
  const dd = String(saoPauloNow.getDate()).padStart(2, '0');
  const mm = String(saoPauloNow.getMonth() + 1).padStart(2, '0');
  const yyyy = saoPauloNow.getFullYear();
  return dd + '-' + mm + '-' + yyyy;
};

const hasJourneyResponses = (responses = {}) => (
  responses && typeof responses === 'object' && Object.values(responses).every(hasAnswer)
);

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


    if (request.body?.type === 'extraordinaryLife') {
      const responses = request.body?.responses || {};
      if (!hasJourneyResponses(responses)) {
        return response.status(400).json({ error: 'Preencha todos os campos da Vida Extraordinaria.' });
      }

      const now = new Date();
      const id = authUser.uid + '_extraordinaryLife';
      await setDocument('journeyForms', id, {
        userId: authUser.uid,
        type: 'extraordinaryLife',
        responses,
        submittedAt: now,
        updatedAt: now
      });
      return response.status(200).json({ ok: true, id, form: { id, userId: authUser.uid, type: 'extraordinaryLife', responses, submittedAt: now.toISOString(), updatedAt: now.toISOString() } });
    }

    if (request.body?.type === 'weeklyOath') {
      const weekKey = String(request.body?.weekKey || getSaoPauloWeekKey()).trim();
      const responses = request.body?.responses || {};
      if (!hasAnswer(responses.identity) || !hasAnswer(responses.conquest)) {
        return response.status(400).json({ error: 'Preencha o juramento e a conquista da semana.' });
      }

      const now = new Date();
      const id = authUser.uid + '_weeklyOath_' + weekKey;
      await setDocument('journeyForms', id, {
        userId: authUser.uid,
        type: 'weeklyOath',
        weekKey,
        responses,
        submittedAt: now,
        updatedAt: now
      });
      return response.status(200).json({ ok: true, id, form: { id, userId: authUser.uid, type: 'weeklyOath', weekKey, responses, submittedAt: now.toISOString(), updatedAt: now.toISOString() } });
    }

    if (request.body?.type === 'commitment') {
      const activity = String(request.body?.activity || '').trim();
      if (activity.length < 3) {
        return response.status(400).json({ error: 'Descreva a atividade que voce fez hoje.' });
      }
      if (activity.length > 800) {
        return response.status(400).json({ error: 'Descreva a atividade em ate 800 caracteres.' });
      }

      const date = getSaoPauloDateKey();
      const completionId = `${authUser.uid}_${date}`;
      const result = await commitDailyCommitmentReward({
        uid: authUser.uid,
        userProfile,
        completionId,
        date,
        activity,
        monthKey: getSaoPauloMonthKey(),
        points: 10
      });

      return response.status(200).json(result);
    }
    const challengeDate = String(request.body?.challengeDate || '').trim();
    const audioChecked = Boolean(request.body?.audioChecked);
    const responses = request.body?.responses || {};
    if (!challengeDate || !audioChecked) {
      return response.status(400).json({ error: 'Missao incompleta.' });
    }

    if (request.body?.type === 'cia') {
      for (const field of CIA_REQUIRED_FIELDS) {
        if (!hasAnswer(responses[field])) {
          return response.status(400).json({ error: 'Preencha todos os campos do CIA.' });
        }
      }
    } else {
      const challenge = await getDocument('dailyChallenges', challengeDate);
      if (!challenge) return response.status(404).json({ error: 'Missao nao encontrada.' });

      for (const question of challenge.questions || []) {
        if (!hasAnswer(responses[question.id])) {
          return response.status(400).json({ error: `A pergunta "${question.label}" e obrigatoria.` });
        }
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
