import crypto from 'node:crypto';
import { getDefaultAccessExpiresAt, markDurableAccessTokenUsed, normalizeAccessExpiresAt, normalizePhone, provisionStudentAccess, resendStudentAccessEmail, validateDurableAccessToken } from '../../server/lib/accessProvisioning.js';
import { deleteDocument, getAuthUserByEmail, getAuthUserByIdToken, getDocument, queryUsers, setAuthUserEmail, setAuthUserPassword, setDocument } from '../../server/lib/firebaseRest.js';

const ADMIN_EMAIL = 'gu.correa98@gmail.com';

const normalizeEmail = (email = '') => String(email).trim().toLowerCase();


const looksLikeEmail = (value = '') => String(value || '').includes('@');
const looksLikePhone = (value = '') => {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 15;
};

const parseEmailList = (value = '') => Array.from(new Set(
  String(value || '')
    .split(/[\n,;]+/)
    .map(normalizeEmail)
    .filter(email => email && email.includes('@'))
));

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



const handlePublicAccessAction = async (request, response) => {
  const action = String(request.body?.action || '').trim();
  if (!['access:validate', 'access:set-password', 'access:complete-password-setup'].includes(action)) return null;

  try {
    if (action === 'access:complete-password-setup') {
      const idToken = String(request.body?.idToken || '').trim();
      if (!idToken) return response.status(400).json({ error: 'Sessao ausente.' });

      const authUser = await getAuthUserByIdToken(idToken);
      if (!authUser?.uid || !authUser.email) return response.status(401).json({ error: 'Sessao invalida.' });

      const userProfile = await getDocument('users', authUser.uid);
      if (!userProfile || normalizeEmail(userProfile.email) !== normalizeEmail(authUser.email)) {
        return response.status(404).json({ error: 'Cadastro de aluna nao encontrado.' });
      }
      if (userProfile.isBlocked) return response.status(403).json({ error: 'Acesso bloqueado.' });

      await setDocument('users', authUser.uid, {
        requiresPasswordSetup: false,
        updatedAt: new Date()
      });
      await setDocument('studentInvites', encodeURIComponent(normalizeEmail(authUser.email)), {
        status: 'accepted',
        acceptedBy: authUser.uid,
        passwordSetupCompletedAt: new Date(),
        updatedAt: new Date()
      });
      return response.status(200).json({ ok: true });
    }

    const { tokenHash, accessLink, userProfile } = await validateDurableAccessToken(request.body?.token);

    if (action === 'access:validate') {
      return response.status(200).json({
        ok: true,
        email: accessLink.email,
        name: userProfile.name || accessLink.email
      });
    }

    const password = String(request.body?.password || '');
    if (password.length < 8) {
      return response.status(400).json({ error: 'A senha precisa ter pelo menos 8 caracteres.' });
    }

    await setAuthUserPassword(accessLink.uid, password);
    await setDocument('users', accessLink.uid, {
      requiresPasswordSetup: false,
      updatedAt: new Date()
    });
    await setDocument('studentInvites', encodeURIComponent(normalizeEmail(accessLink.email)), {
      status: 'accepted',
      acceptedBy: accessLink.uid,
      passwordSetupCompletedAt: new Date(),
      updatedAt: new Date()
    });
    await markDurableAccessTokenUsed(tokenHash);

    return response.status(200).json({ ok: true, email: accessLink.email });
  } catch (error) {
    return response.status(400).json({ error: error.message || 'Nao foi possivel validar o acesso.' });
  }
};

const handleStudentAction = async (request, response) => {
  const action = String(request.body?.action || '').trim();

  if (action === 'student:resend-access') {
    const email = normalizeEmail(request.body?.email);
    const uid = String(request.body?.uid || '').trim();
    if (!email || !uid) return response.status(400).json({ error: 'Informe a aluna para reenviar o acesso.' });

    const userProfile = await getDocument('users', uid);
    if (!userProfile || normalizeEmail(userProfile.email) !== email) {
      return response.status(404).json({ error: 'Aluna nao encontrada.' });
    }
    if (userProfile.role === 'admin') return response.status(400).json({ error: 'Nao e possivel reenviar acesso para admin por aqui.' });

    await resendStudentAccessEmail({ email, name: userProfile.name || email, productName: 'Comunidade Eden' });
    await setDocument('studentInvites', encodeURIComponent(email), {
      email,
      name: userProfile.name || email.split('@')[0],
      phone: userProfile.phone || '',
      accessExpiresAt: userProfile.accessExpiresAt || getDefaultAccessExpiresAt(),
      role: 'student',
      status: 'accepted',
      acceptedBy: uid,
      lastAccessEmailSentAt: new Date(),
      updatedAt: new Date()
    });
    return response.status(200).json({ ok: true, emailSent: true });
  }


  if (action === 'student:update-profile') {
    const uid = String(request.body?.uid || '').trim();
    const newEmail = normalizeEmail(request.body?.email);
    const name = String(request.body?.name || '').trim();
    const phone = normalizePhone(request.body?.phone || '');
    const accessExpiresAt = normalizeAccessExpiresAt(request.body?.accessExpiresAt) || String(request.body?.accessExpiresAt || '').trim();
    const birthDate = String(request.body?.birthDate || '').trim();
    const profession = String(request.body?.profession || '').trim();
    const instagram = String(request.body?.instagram || '').trim();
    const maritalStatus = String(request.body?.maritalStatus || '').trim();
    const requestedHotmartEmails = parseEmailList(request.body?.hotmartEmails);

    if (!uid || !newEmail || !name) {
      return response.status(400).json({ error: 'Informe nome, email e aluna para atualizar.' });
    }

    const userProfile = await getDocument('users', uid);
    if (!userProfile) return response.status(404).json({ error: 'Aluna nao encontrada.' });
    if (userProfile.role === 'admin' || normalizeEmail(userProfile.email) === ADMIN_EMAIL) {
      return response.status(400).json({ error: 'Nao e possivel alterar email/perfil de admin por aqui.' });
    }

    const oldEmail = normalizeEmail(userProfile.email);
    const emailChanged = oldEmail !== newEmail;
    if (emailChanged) {
      const existingAuthUser = await getAuthUserByEmail(newEmail);
      if (existingAuthUser?.uid && existingAuthUser.uid !== uid) {
        return response.status(409).json({ error: 'Este email ja esta vinculado a outra conta.' });
      }
      await setAuthUserEmail(uid, newEmail);
      if (oldEmail) await deleteDocument('studentInvites', encodeURIComponent(oldEmail));
    }

    const hotmartEmails = Array.from(new Set([
      ...requestedHotmartEmails,
      oldEmail,
      ...(Array.isArray(userProfile.hotmartEmails) ? userProfile.hotmartEmails.map(normalizeEmail) : [])
    ].filter(email => email && email.includes('@'))));

    await setDocument('users', uid, {
      name,
      email: newEmail,
      phone,
      accessExpiresAt,
      birthDate,
      profession,
      instagram,
      maritalStatus,
      hotmartEmails,
      updatedAt: new Date()
    });

    await setDocument('studentInvites', encodeURIComponent(newEmail), {
      email: newEmail,
      name,
      phone,
      accessExpiresAt,
      role: 'student',
      status: userProfile.requiresPasswordSetup === false ? 'accepted' : 'invited',
      acceptedBy: userProfile.requiresPasswordSetup === false ? uid : '',
      updatedAt: new Date()
    });

    for (const hotmartEmail of hotmartEmails) {
      await setDocument('hotmartEmailAliases', encodeURIComponent(hotmartEmail), {
        email: hotmartEmail,
        uid,
        currentEmail: newEmail,
        updatedAt: new Date()
      });
    }

    return response.status(200).json({ ok: true, uid, email: newEmail, hotmartEmails });
  }

  if (action === 'students:resend-pending-access') {
    const users = await queryUsers(2000);
    const pendingStudents = users
      .filter((userProfile) => userProfile?.uid && userProfile.role !== 'admin')
      .filter((userProfile) => userProfile.requiresPasswordSetup === true && !userProfile.isBlocked)
      .slice(0, 100);

    const results = [];
    for (const userProfile of pendingStudents) {
      const email = normalizeEmail(userProfile.email);
      if (!email) continue;
      try {
        await resendStudentAccessEmail({ email, name: userProfile.name || email, productName: 'Comunidade Eden' });
        await setDocument('studentInvites', encodeURIComponent(email), {
          email,
          name: userProfile.name || email.split('@')[0],
          phone: userProfile.phone || '',
          accessExpiresAt: userProfile.accessExpiresAt || getDefaultAccessExpiresAt(),
          role: 'student',
          status: 'accepted',
          acceptedBy: userProfile.uid,
          lastAccessEmailSentAt: new Date(),
          updatedAt: new Date()
        });
        results.push({ email, ok: true });
      } catch (error) {
        console.error('Pending access resend error:', email, error);
        results.push({ email, ok: false, error: error.message });
      }
    }

    const sent = results.filter((result) => result.ok).length;
    return response.status(200).json({ ok: true, sent, failed: results.length - sent, limited: pendingStudents.length === 100, results });
  }

  if (action === 'students:repair-import-fields') {
    const users = await queryUsers(2000);
    let repaired = 0;
    const repairedEmails = [];

    for (const userProfile of users) {
      if (!userProfile?.uid || userProfile.role === 'admin') continue;
      const email = normalizeEmail(userProfile.email);
      const phone = String(userProfile.phone || '').trim();
      const accessExpiresAt = String(userProfile.accessExpiresAt || '').trim();
      const hasDuplicatedEmailInPhone = email && looksLikeEmail(phone) && normalizeEmail(phone) === email;
      const accessHasPhone = looksLikePhone(accessExpiresAt) && !normalizeAccessExpiresAt(accessExpiresAt);

      if (!hasDuplicatedEmailInPhone || !accessHasPhone) continue;

      const fixedPhone = normalizePhone(accessExpiresAt);
      const fixedAccessExpiresAt = getDefaultAccessExpiresAt();
      await setDocument('users', userProfile.uid, {
        phone: fixedPhone,
        accessExpiresAt: fixedAccessExpiresAt,
        updatedAt: new Date()
      });
      await setDocument('studentInvites', encodeURIComponent(email), {
        email,
        name: userProfile.name || email.split('@')[0],
        phone: fixedPhone,
        accessExpiresAt: fixedAccessExpiresAt,
        role: 'student',
        status: 'accepted',
        acceptedBy: userProfile.uid,
        updatedAt: new Date()
      });
      repaired += 1;
      repairedEmails.push(email);
    }

    return response.status(200).json({ ok: true, repaired, repairedEmails });
  }

  return null;
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
    const publicAccessResponse = await handlePublicAccessAction(request, response);
    if (publicAccessResponse) return publicAccessResponse;

    const adminUser = await assertAdmin(request);

    if (String(request.body?.action || '').startsWith('notification:')) {
      const notificationResponse = await handleNotificationAction(request, response, adminUser);
      if (notificationResponse) return notificationResponse;
    }

    if (String(request.body?.action || '').startsWith('student')) {
      const studentActionResponse = await handleStudentAction(request, response);
      if (studentActionResponse) return studentActionResponse;
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
          sendEmail: true,
          skipExisting: true
        });
        results.push({ email: student.email, ok: true, ...result });
      } catch (error) {
        console.error('Admin student provisioning error:', student.email, error);
        results.push({ email: student.email, ok: false, error: error.message });
      }
    }

    const succeeded = results.filter((result) => result.ok).length;
    const created = results.filter((result) => result.ok && !result.skipped).length;
    const skipped = results.filter((result) => result.ok && result.skipped).length;
    return response.status(succeeded > 0 ? 200 : 500).json({
      ok: succeeded > 0,
      total: results.length,
      created,
      skipped,
      failed: results.length - succeeded,
      results
    });
  } catch (error) {
    console.error('Admin students API error:', error);
    const isAuthError = String(error.message || '').toLowerCase().includes('token') || String(error.message || '').toLowerCase().includes('permissao');
    return response.status(isAuthError ? 401 : 500).json({ error: error.message || 'Nao foi possivel concluir a acao.' });
  }
}
