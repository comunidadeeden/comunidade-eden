import crypto from 'node:crypto';
import { provisionStudentAccess } from '../lib/accessProvisioning.js';
import { deleteDocument, getAuthUserByIdToken, getDocument, setDocument } from '../lib/firebaseRest.js';

const ADMIN_EMAIL = 'gu.correa98@gmail.com';

const normalizeEmail = (email = '') => String(email).trim().toLowerCase();

const getBearerToken = (request) => {
  const authorization = request.headers.authorization || '';
  return authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
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

const handleNotificationAction = async (request, response, adminUser) => {
  const action = String(request.body?.action || '').trim();
  const title = String(request.body?.title || '').trim();
  const message = String(request.body?.message || '').trim();
  const linkUrl = String(request.body?.linkUrl || '').trim();

  if (action === 'notification:create') {
    if (!title || !message) {
      return response.status(400).json({ error: 'Informe titulo e mensagem do aviso.' });
    }

    const id = 'notice_' + Date.now() + '_' + crypto.randomBytes(6).toString('hex');
    const now = new Date();
    await setDocument('notifications', id, {
      title,
      message,
      linkUrl,
      type: 'admin',
      createdBy: adminUser.uid,
      createdAt: now,
      publishedAt: now
    });
    return response.status(200).json({ ok: true, id });
  }

  if (action === 'notification:update') {
    const id = String(request.body?.id || '').trim();
    if (!id) return response.status(400).json({ error: 'ID do aviso e obrigatorio.' });
    if (!title || !message) {
      return response.status(400).json({ error: 'Informe titulo e mensagem do aviso.' });
    }

    await setDocument('notifications', id, {
      title,
      message,
      linkUrl,
      updatedAt: new Date()
    });
    return response.status(200).json({ ok: true, id });
  }

  if (action === 'notification:delete') {
    const id = String(request.body?.id || '').trim();
    if (!id) return response.status(400).json({ error: 'ID do aviso e obrigatorio.' });
    await deleteDocument('notifications', id);
    return response.status(200).json({ ok: true, id });
  }

  return null;
};

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Metodo nao permitido.' });
  }

  try {
    const adminUser = await assertAdmin(request);

    if (String(request.body?.action || '').startsWith('notification:')) {
      const notificationResponse = await handleNotificationAction(request, response, adminUser);
      if (notificationResponse) return notificationResponse;
    }

    const students = Array.isArray(request.body?.students)
      ? request.body.students
      : [request.body?.student || request.body || {}];

    const sanitizedStudents = students
      .map((student) => ({
        email: normalizeEmail(student.email),
        name: String(student.name || '').trim(),
        phone: String(student.phone || '').trim(),
        accessExpiresAt: String(student.accessExpiresAt || '').trim()
      }))
      .filter((student) => student.email && student.name);

    if (sanitizedStudents.length === 0) {
      return response.status(400).json({ error: 'Informe ao menos um aluno com nome e email.' });
    }

    if (sanitizedStudents.length > 100) {
      return response.status(400).json({ error: 'Importe no maximo 100 alunos por vez.' });
    }

    const results = [];
    for (const student of sanitizedStudents) {
      try {
        const result = await provisionStudentAccess({
          ...student,
          grantMainAccess: true,
          productName: 'Comunidade Eden',
          sendEmail: true
        });
        results.push({ email: student.email, ok: true, ...result });
      } catch (error) {
        console.error('Admin student provisioning error:', student.email, error);
        results.push({ email: student.email, ok: false, error: error.message });
      }
    }

    const created = results.filter((result) => result.ok).length;
    return response.status(created > 0 ? 200 : 500).json({
      ok: created > 0,
      total: results.length,
      created,
      failed: results.length - created,
      results
    });
  } catch (error) {
    console.error('Admin students API error:', error);
    return response.status(401).json({ error: error.message || 'Nao autorizado.' });
  }
}
