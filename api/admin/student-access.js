import {
  deleteAuthUser,
  deleteDocument,
  getAuthUserByIdToken,
  getDocument,
  setAuthUserDisabled,
  setDocument
} from '../../server/lib/firebaseRest.js';

const ADMIN_EMAIL = 'gu.correa98@gmail.com';

const getBearerToken = (request) => {
  const authorization = request.headers.authorization || '';
  return authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
};

const getInviteIdFromEmail = (email = '') => encodeURIComponent(String(email).trim().toLowerCase());

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
  if (!['PATCH', 'DELETE'].includes(request.method)) {
    response.setHeader('Allow', 'PATCH, DELETE');
    return response.status(405).json({ error: 'Metodo nao permitido.' });
  }

  try {
    await assertAdmin(request);

    const uid = String(request.body?.uid || '').trim();
    const email = String(request.body?.email || '').trim().toLowerCase();
    if (!uid) return response.status(400).json({ error: 'UID do aluno e obrigatorio.' });

    const student = await getDocument('users', uid);
    if (!student) return response.status(404).json({ error: 'Aluno nao encontrado.' });
    if (student.role === 'admin' || student.email === ADMIN_EMAIL) {
      return response.status(403).json({ error: 'Admins nao podem ser alterados por aqui.' });
    }

    if (request.method === 'PATCH') {
      const isBlocked = Boolean(request.body?.isBlocked);
      await setAuthUserDisabled(uid, isBlocked);
      await setDocument('users', uid, {
        ...student,
        uid,
        isBlocked,
        updatedAt: new Date()
      });
      return response.status(200).json({ ok: true, isBlocked });
    }

    await deleteAuthUser(uid);
    await deleteDocument('users', uid);
    if (email || student.email) {
      await deleteDocument('studentInvites', getInviteIdFromEmail(email || student.email));
    }

    return response.status(200).json({ ok: true });
  } catch (error) {
    console.error('Admin student access API error:', error);
    return response.status(500).json({ error: error.message || 'Nao foi possivel atualizar o aluno.' });
  }
}
