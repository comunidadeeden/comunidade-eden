import crypto from 'node:crypto';
import { sendAccessEmail } from './accessEmail.js';
import {
  createAuthUserIfNeeded,
  generatePasswordSetupLink,
  getDocument,
  setAuthUserDisabled,
  setDocument
} from './firebaseRest.js';


const appUrl = () => {
  const rawUrl = process.env.APP_URL || 'https://www.comunidadeeden.com.br';
  const normalizedUrl = rawUrl.replace(/^APP_URL=/, '').trim();
  return normalizedUrl.startsWith('http') ? normalizedUrl : `https://${normalizedUrl}`;
};

const hashAccessToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const isDateExpired = (dateValue = '') => {
  const date = new Date(`${dateValue}T23:59:59`);
  return Number.isNaN(date.getTime()) ? false : date.getTime() < Date.now();
};

export const createDurableAccessUrl = async ({ email, uid }) => {
  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = hashAccessToken(token);
  const days = Number(process.env.ACCESS_LINK_DAYS || 7);
  const expiresAt = addDays(new Date(), Number.isFinite(days) ? days : 7);

  await setDocument('accessLinks', tokenHash, {
    email,
    uid,
    expiresAt,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  const url = new URL('/acesso', appUrl());
  url.searchParams.set('token', token);
  return url.toString();
};

export const redeemDurableAccessToken = async (token) => {
  const cleanToken = String(token || '').trim();
  if (!cleanToken) throw new Error('Link de acesso invalido.');

  const tokenHash = hashAccessToken(cleanToken);
  const accessLink = await getDocument('accessLinks', tokenHash);
  if (!accessLink?.email || !accessLink?.uid) throw new Error('Link de acesso invalido ou expirado.');
  if (isDateExpired(accessLink.expiresAt)) throw new Error('Este link de acesso expirou. Solicite um novo envio.');

  const userProfile = await getDocument('users', accessLink.uid);
  if (!userProfile || String(userProfile.email || '').toLowerCase() !== String(accessLink.email || '').toLowerCase()) {
    throw new Error('Acesso nao encontrado para esta aluna.');
  }
  if (userProfile.isBlocked || isDateExpired(userProfile.accessExpiresAt)) {
    throw new Error('Seu acesso esta bloqueado ou expirado. Entre em contato com o suporte.');
  }

  await setDocument('accessLinks', tokenHash, {
    lastRedeemedAt: new Date(),
    updatedAt: new Date()
  });

  return generatePasswordSetupLink(accessLink.email);
};

const getAccessEmailTemplate = async () => {
  const settings = await getDocument('settings', 'emailTemplates').catch((error) => {
    console.error('Email template read error:', error);
    return null;
  });
  return settings?.access || null;
};

export const addDays = (date, days) => {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate.toISOString().slice(0, 10);
};

export const getDefaultAccessExpiresAt = () => {
  const days = Number(process.env.DEFAULT_ACCESS_DAYS || 365);
  return addDays(new Date(), Number.isFinite(days) ? days : 365);
};

export const normalizeAccessExpiresAt = (value = '') => {
  const cleanValue = String(value || '').trim();
  if (!cleanValue) return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanValue)) return '';

  const date = new Date(`${cleanValue}T00:00:00`);
  return Number.isNaN(date.getTime()) ? '' : cleanValue;
};

export const normalizePhone = (value = '') => {
  const cleanValue = String(value || '').trim();
  return cleanValue.includes('@') ? '' : cleanValue;
};

export const provisionStudentAccess = async ({
  email,
  name,
  phone = '',
  accessExpiresAt = '',
  offerId = '',
  grantMainAccess = true,
  productName = 'Comunidade Eden',
  sendEmail = true,
  skipExisting = false
}) => {
  const authUser = await createAuthUserIfNeeded({ email, name });
  const existingUser = await getDocument('users', authUser.uid);
  if (skipExisting && existingUser) {
    return {
      uid: authUser.uid,
      created: false,
      skipped: true,
      emailSent: false,
      accessExpiresAt: existingUser.accessExpiresAt || '',
      purchasedOfferIds: existingUser.purchasedOfferIds || []
    };
  }

  if (grantMainAccess) {
    await setAuthUserDisabled(authUser.uid, false);
  }

  const purchasedOfferIds = new Set(existingUser?.purchasedOfferIds || []);
  if (offerId) purchasedOfferIds.add(offerId);

  const requestedAccessExpiresAt = normalizeAccessExpiresAt(accessExpiresAt);
  const finalAccessExpiresAt = requestedAccessExpiresAt ||
    (grantMainAccess ? getDefaultAccessExpiresAt() : (normalizeAccessExpiresAt(existingUser?.accessExpiresAt) || getDefaultAccessExpiresAt()));

  await setDocument('users', authUser.uid, {
    uid: authUser.uid,
    name: existingUser?.name || name || email.split('@')[0],
    email,
    avatar: existingUser?.avatar || '',
    points: existingUser?.points || 0,
    role: existingUser?.role || 'student',
    requiresPasswordSetup: existingUser ? Boolean(existingUser.requiresPasswordSetup) : true,
    isBlocked: false,
    accessExpiresAt: finalAccessExpiresAt,
    profession: existingUser?.profession || '',
    instagram: existingUser?.instagram || '',
    phone: normalizePhone(phone) || existingUser?.phone || '',
    maritalStatus: existingUser?.maritalStatus || '',
    hasChildren: existingUser?.hasChildren || false,
    childrenCount: existingUser?.childrenCount || 0,
    lastAudioDate: existingUser?.lastAudioDate || '',
    lastMissionRewardDate: existingUser?.lastMissionRewardDate || '',
    isCofounder: existingUser?.isCofounder || false,
    completedChallenges: existingUser?.completedChallenges || [],
    purchasedOfferIds: Array.from(purchasedOfferIds),
    updatedAt: new Date()
  });

  await setDocument('studentInvites', encodeURIComponent(email), {
    email,
    name: name || existingUser?.name || email.split('@')[0],
    phone: normalizePhone(phone) || existingUser?.phone || '',
    accessExpiresAt: finalAccessExpiresAt,
    role: 'student',
    invitedBy: 'backend',
    status: 'accepted',
    acceptedBy: authUser.uid,
    acceptedAt: new Date(),
    updatedAt: new Date()
  });

  let emailSent = false;
  if (sendEmail) {
    const setupPasswordUrl = await createDurableAccessUrl({ email, uid: authUser.uid });
    const template = await getAccessEmailTemplate();
    await sendAccessEmail({
      to: email,
      name: name || existingUser?.name,
      productName,
      setupPasswordUrl,
      template
    });
    emailSent = true;
  }

  return {
    uid: authUser.uid,
    created: authUser.created,
    emailSent,
    accessExpiresAt: finalAccessExpiresAt,
    purchasedOfferIds: Array.from(purchasedOfferIds)
  };
};


export const resendStudentAccessEmail = async ({ email, name, productName = 'Comunidade Eden' }) => {
  const setupPasswordUrl = await createDurableAccessUrl({ email, uid: (await createAuthUserIfNeeded({ email, name })).uid });
  const template = await getAccessEmailTemplate();
  await sendAccessEmail({
    to: email,
    name,
    productName,
    setupPasswordUrl,
    template
  });
  return { emailSent: true };
};
