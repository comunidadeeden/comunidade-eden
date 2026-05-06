import { provisionStudentAccess } from '../lib/accessProvisioning.js';
import {
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

const upsertStudentAccess = async ({ email, name, offerId, grantMainAccess }) => {
  return provisionStudentAccess({ email, name, offerId, grantMainAccess });
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
    return response.status(500).json({ error: 'Erro interno ao processar webhook da Hotmart.' });
  }
}
