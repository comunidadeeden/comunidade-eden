const normalize = (value) => String(value || '').trim();
const normalizeLower = (value) => normalize(value).toLowerCase();

export const verifyHotmartRequest = (payload, headers = {}) => {
  const expectedHottok = process.env.HOTMART_HOTTOK;
  if (!expectedHottok) throw new Error('HOTMART_HOTTOK nao foi configurado.');

  const receivedHottok = normalize(
    payload?.hottok ||
    payload?.Hottok ||
    payload?.hotmart_hottok ||
    headers.hottok ||
    headers.Hottok ||
    headers['x-hotmart-hottok']
  );

  return receivedHottok && receivedHottok === expectedHottok;
};

export const parseHotmartPayload = (payload = {}) => {
  const data = payload.data || {};
  const buyer = data.buyer || data.user || {};
  const product = data.product || {};
  const purchase = data.purchase || {};
  const offer = data.offer || {};

  const email = normalizeLower(
    buyer.email ||
    payload.email ||
    payload.Email
  );

  const name = normalize(
    buyer.name ||
    `${buyer.first_name || payload.first_name || ''} ${buyer.last_name || payload.last_name || ''}`.trim() ||
    payload.name ||
    payload.Name
  );

  const status = normalizeLower(
    purchase.status ||
    payload.status ||
    payload.Status
  );

  const event = normalizeLower(payload.event || payload.event_type || payload.Event);
  const transaction = normalize(
    purchase.transaction ||
    purchase.transaction_id ||
    payload.transaction ||
    payload.Transaction
  );
  const productId = normalize(
    product.id ||
    product.ucode ||
    payload.prod ||
    payload.Prod ||
    payload.product_id
  );
  const offerCode = normalize(
    offer.code ||
    offer.id ||
    payload.off ||
    payload.Off ||
    payload.offer_code
  );

  return {
    raw: payload,
    email,
    name,
    status,
    event,
    transaction,
    productId,
    offerCode,
    hotmartKeys: [
      productId,
      offerCode,
      productId && offerCode ? `${productId}:${offerCode}` : ''
    ].filter(Boolean)
  };
};

export const isApprovedHotmartEvent = ({ status, event }) => (
  ['approved', 'completed'].includes(status) ||
  ['purchase_approved', 'purchase.completed', 'purchase_approved_event'].includes(event)
);

export const isRevokedHotmartEvent = ({ status, event }) => (
  ['refunded', 'chargeback', 'canceled', 'cancelled', 'expired', 'blocked'].includes(status) ||
  ['purchase_refunded', 'purchase_chargeback', 'purchase_canceled', 'purchase_cancelled'].includes(event)
);

export const isMainAccessProduct = (productId) => {
  const ids = (process.env.HOTMART_MAIN_PRODUCT_IDS || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
  return ids.includes(productId);
};

export const getMappedOfferId = (hotmartKeys = []) => {
  const map = process.env.HOTMART_OFFER_MAP ? JSON.parse(process.env.HOTMART_OFFER_MAP) : {};
  return hotmartKeys.map(key => map[key]).find(Boolean) || null;
};

export const getEventId = ({ transaction, status, event, productId, offerCode }) => {
  const sourceId = transaction || `${productId || 'produto'}-${offerCode || 'oferta'}-${Date.now()}`;
  return [sourceId, status || event || 'unknown']
    .join('-')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 180);
};
