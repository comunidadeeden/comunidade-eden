import { sendAccessEmail } from './accessEmail.js';
import {
  createAuthUserIfNeeded,
  generatePasswordSetupLink,
  getDocument,
  setAuthUserDisabled,
  setDocument
} from './firebaseRest.js';

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

const normalizeAccessExpiresAt = (value = '') => {
  const cleanValue = String(value || '').trim();
  if (!cleanValue) return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanValue)) return '';

  const date = new Date(`${cleanValue}T00:00:00`);
  return Number.isNaN(date.getTime()) ? '' : cleanValue;
};

const normalizePhone = (value = '') => {
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
  sendEmail = true
}) => {
  const authUser = await createAuthUserIfNeeded({ email, name });
  if (grantMainAccess) {
    await setAuthUserDisabled(authUser.uid, false);
  }
  const existingUser = await getDocument('users', authUser.uid);
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
    requiresPasswordSetup: true,
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
    const setupPasswordUrl = await generatePasswordSetupLink(email);
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
