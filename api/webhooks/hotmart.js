import { sendAccessEmail } from '../lib/accessEmail.js';
import {
  createAuthUserIfNeeded,
  generatePasswordSetupLink,
  getAuthUserByEmail,
  getDocument,
  setDocument
} from '../lib/firebaseRest.js';
import {
  getEventId,
  getMappedOfferId,
  isApprovedHotmartEvent,
  isMainAccessProduct,
  isRevokedHotmartEvent,
  parseHotmartPayload,
  verifyHotmartRequest
} from '../lib/hotmart.js';

const addDays = (date, days) => {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate.toISOString().slice(0, 10);
};

const getAccessExpiresAt = () => {
  const days = Number(process.env.DEFAULT_ACCESS_DAYS || 365);
  return addDays(new Date(), Number.isFinite(days) ? days : 365);
};

const upsertStudentAccess = async ({ email, name, offerId, grantMainAccess }) => {
  const authUser = await createAuthUserIfNeeded({ email, name });
  const existingUser = await getDocument('users', authUser.uid);
  const purchasedOfferIds = new Set(existingUser?.purchasedOfferIds || []);
  if (offerId) purchasedOfferIds.add(offerId);

  await setDocument('users', authUser.uid, {
    uid: authUser.uid,
    name: existingUser?.name || name || email.split('@')[0],
    email,
    avatar: existingUser?.avatar || '',
    points: existingUser?.points || 0,
    role: existingUser?.role || 'student',
    requiresPasswordSetup: true,
    isBlocked: false,
    accessExpiresAt: grantMainAccess ? getAccessExpiresAt() : (existingUser?.accessExpiresAt || getAccessExpiresAt()),
    profession: existingUser?.profession || '',
    instagram: existingUser?.instagram || '',
    phone: existingUser?.phone || '',
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

  const setupPasswordUrl = await generatePasswordSetupLink(email);
  await sendAccessEmail({
    to: email,
    name: name || existingUser?.name,
    productName: 'Comunidade Eden',
    setupPasswordUrl
  });

  return {
    uid: authUser.uid,
    created: authUser.created,
    emailSent: true,
    purchasedOfferIds: Array.from(purchasedOfferIds)
  };
};

const revokeStudentAccess = async ({ email, offerId, revokeMainAccess }) => {
  const lookupUser = await getAuthUserByEmail(email);
  if (!lookupUser) return { updated: false, reason: 'auth_user_not_found' };

  const existingUser = await getDocument('users', lookupUser.uid);
  if (!existingUser) return { uid: lookupUser.uid, updated: false };

  const purchasedOfferIds = new Set(existingUser.purchasedOfferIds || []);
  if (offerId) purchasedOfferIds.delete(offerId);

  await setDocument('users', lookupUser.uid, {
    ...existingUser,
    uid: lookupUser.uid,
    email,
    isBlocked: revokeMainAccess ? true : Boolean(existingUser.isBlocked),
    purchasedOfferIds: Array.from(purchasedOfferIds),
    updatedAt: new Date()
  });

  return { uid: lookupUser.uid, updated: true };
};

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Metodo nao permitido.' });
  }

  try {
    const payload = request.body || {};
    if (!verifyHotmartRequest(payload, request.headers || {})) {
      return response.status(401).json({ error: 'Hottok invalido.' });
    }

    const event = parseHotmartPayload(payload);
    const eventId = getEventId(event);
    const alreadyProcessed = await getDocument('webhookEvents', eventId);
    if (alreadyProcessed?.processedAt) {
      return response.status(200).json({ ok: true, duplicate: true, eventId });
    }

    await setDocument('webhookEvents', eventId, {
      provider: 'hotmart',
      eventId,
      status: event.status,
      event: event.event,
      transaction: event.transaction,
      productId: event.productId,
      offerCode: event.offerCode,
      email: event.email,
      receivedAt: new Date(),
      payload
    });

    if (!event.email || !event.productId) {
      await setDocument('webhookEvents', eventId, {
        error: 'Payload sem email ou produto.',
        processedAt: new Date()
      });
      return response.status(202).json({ ok: true, skipped: true, reason: 'missing_email_or_product', eventId });
    }

    const offerId = getMappedOfferId(event.hotmartKeys);
    const grantMainAccess = isMainAccessProduct(event.productId);
    const hasMapping = Boolean(offerId || grantMainAccess);

    if (!hasMapping) {
      await setDocument('webhookEvents', eventId, {
        skipped: true,
        reason: 'unmapped_product',
        processedAt: new Date()
      });
      return response.status(202).json({ ok: true, skipped: true, reason: 'unmapped_product', eventId });
    }

    let result = { ignored: true };
    if (isApprovedHotmartEvent(event)) {
      result = await upsertStudentAccess({
        email: event.email,
        name: event.name,
        offerId,
        grantMainAccess
      });
    } else if (isRevokedHotmartEvent(event)) {
      result = await revokeStudentAccess({
        email: event.email,
        offerId,
        revokeMainAccess: grantMainAccess
      });
    }

    await setDocument('webhookEvents', eventId, {
      processedAt: new Date(),
      result
    });

    return response.status(200).json({ ok: true, eventId, result });
  } catch (error) {
    console.error('Hotmart webhook error:', error);
    return response.status(500).json({
      error: 'Erro interno ao processar webhook da Hotmart.',
      detail: error.message
    });
  }
}
