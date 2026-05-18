import { countMonthlyScoresAhead, countUsersAheadByPoints, getAuthUserByIdToken, getDocument, getMonthlyScore, queryMonthlyScores, queryNotifications, queryTopUsersByPoints } from './lib/firebaseRest.js';

const DEFAULT_MONTHLY_PRIZE = '1 sessão individual com Bruno Simplicio';

const safePoints = (value) => Math.max(0, Number(value || 0));

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

const getDaysRemainingInMonth = () => {
  const now = new Date();
  const saoPauloDate = new Date(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric'
  }).format(now));
  const lastDay = new Date(saoPauloDate.getFullYear(), saoPauloDate.getMonth() + 1, 0).getDate();
  return Math.max(0, lastDay - saoPauloDate.getDate());
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

    if (request.query?.notificationsOnly === '1') {
      const notifications = await queryNotifications(20);
      return response.status(200).json({ notifications });
    }

    const monthKey = String(request.query?.month || getSaoPauloMonthKey()).trim();
    const requesterPoints = safePoints(requester.points);
    const [topUsers, usersAhead, monthlyScores, currentMonthlyScore, monthlyRankingSettings] = await Promise.all([
      queryTopUsersByPoints(3),
      countUsersAheadByPoints(requesterPoints).catch(() => null),
      queryMonthlyScores(monthKey, 3),
      getMonthlyScore(authUser.uid, monthKey).catch(() => null),
      getDocument('settings', 'monthlyRanking').catch(() => null)
    ]);

    const generalUsers = topUsers.map((user, index) => ({
      uid: user.uid,
      name: user.name || 'Aluna',
      avatar: user.avatar || '',
      points: safePoints(user.points),
      isCofounder: Boolean(user.isCofounder),
      rankPosition: index + 1
    }));
    if (!generalUsers.some(user => user.uid === authUser.uid)) {
      generalUsers.push({
        uid: authUser.uid,
        name: requester.name || 'Você',
        avatar: requester.avatar || '',
        points: requesterPoints,
        isCofounder: Boolean(requester.isCofounder),
        rankPosition: usersAhead === null ? generalUsers.length + 1 : usersAhead + 1
      });
    }

    const monthlyUsers = monthlyScores.map((score, index) => ({
      uid: score.uid,
      name: score.name || 'Aluna',
      avatar: score.avatar || '',
      points: safePoints(score.points),
      totalPoints: safePoints(score.totalPoints),
      isCofounder: Boolean(score.isCofounder),
      rankPosition: index + 1
    }));
    if (currentMonthlyScore?.uid && !monthlyUsers.some(user => user.uid === authUser.uid)) {
      const monthlyPoints = safePoints(currentMonthlyScore.points);
      const monthlyUsersAhead = await countMonthlyScoresAhead(monthKey, monthlyPoints).catch(() => null);
      monthlyUsers.push({
        uid: authUser.uid,
        name: currentMonthlyScore.name || requester.name || 'Você',
        avatar: currentMonthlyScore.avatar || requester.avatar || '',
        points: monthlyPoints,
        totalPoints: safePoints(currentMonthlyScore.totalPoints),
        isCofounder: Boolean(currentMonthlyScore.isCofounder || requester.isCofounder),
        rankPosition: monthlyUsersAhead === null ? monthlyUsers.length + 1 : monthlyUsersAhead + 1
      });
    }

    return response.status(200).json({
      users: generalUsers,
      monthly: {
        monthKey,
        daysRemaining: monthKey === getSaoPauloMonthKey() ? getDaysRemainingInMonth() : 0,
        prize: monthlyRankingSettings?.prize || DEFAULT_MONTHLY_PRIZE,
        users: monthlyUsers
      }
    });
  } catch (error) {
    console.error('Ranking API error:', error);
    return response.status(500).json({ error: 'Nao foi possivel carregar o ranking.' });
  }
}
