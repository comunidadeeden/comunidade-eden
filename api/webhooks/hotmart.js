import { provisionStudentAccess } from '../../server/lib/accessProvisioning.js';
import {
  getAuthUserByEmail,
  getDocument,
  setAuthUserDisabled,
  setDocument
} from '../../server/lib/firebaseRest.js';
import {
  getEventId,
  getMappedOfferId,
  isApprovedHotmartEvent,
  isMainAccessProduct,
  isRevokedHotmartEvent,
  parseHotmartPayload,
  verifyHotmartRequest
} from '../../server/lib/hotmart.js';

const saveHotmartAlias = async ({ email, uid, currentEmail }) => {
  if (!email || !uid) return;
  await setDocument('hotmartEmailAliases', encodeURIComponent(email), {
    email,
    uid,
    currentEmail: currentEmail || email,
    updatedAt: new Date()
  });
};

const resolveHotmartUserByEmail = async (email) => {
  const lookupUser = await getAuthUserByEmail(email);
  if (lookupUser?.uid) return { uid: lookupUser.uid, matchedBy: 'auth_email' };

  const alias = await getDocument('hotmartEmailAliases', encodeURIComponent(email));
  if (alias?.uid) return { uid: alias.uid, currentEmail: alias.currentEmail || '', matchedBy: 'hotmart_alias' };

  return null;
};

const upsertStudentAccess = async ({ email, name, offerId, grantMainAccess }) => {
  const lookupUser = await resolveHotmartUserByEmail(email);
  if (lookupUser?.uid) {
    const existingUser = await getDocument('users', lookupUser.uid);
    if (existingUser) {
      await saveHotmartAlias({ email, uid: lookupUser.uid, currentEmail: existingUser.email || lookupUser.currentEmail || email });
      return {
        uid: lookupUser.uid,
        created: false,
        skipped: true,
        reason: 'existing_user_no_access_email',
        matchedBy: lookupUser.matchedBy,
        emailSent: false,
        accessExpiresAt: existingUser.accessExpiresAt || '',
        purchasedOfferIds: existingUser.purchasedOfferIds || []
      };
    }
  }

  const result = await provisionStudentAccess({ email, name, offerId, grantMainAccess });
  if (result?.uid) await saveHotmartAlias({ email, uid: result.uid, currentEmail: email });
  return result;
};

const revokeStudentAccess = async ({ email, offerId, revokeMainAccess }) => {
  const lookupUser = await resolveHotmartUserByEmail(email);
  if (!lookupUser) return { updated: false, reason: 'auth_user_not_found' };

  const existingUser = await getDocument('users', lookupUser.uid);
  if (!existingUser) return { uid: lookupUser.uid, updated: false };

  const purchasedOfferIds = new Set(existingUser.purchasedOfferIds || []);
  if (offerId) purchasedOfferIds.delete(offerId);
  if (revokeMainAccess) {
    await setAuthUserDisabled(lookupUser.uid, true);
  }

  await setDocument('users', lookupUser.uid, {
    ...existingUser,
    uid: lookupUser.uid,
    email: existingUser.email || lookupUser.currentEmail || email,
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
    return response.status(500).json({ error: 'Erro interno ao processar webhook da Hotmart.' });
  }
}
