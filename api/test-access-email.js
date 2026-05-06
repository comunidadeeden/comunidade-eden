import { sendAccessEmail } from './lib/accessEmail.js';

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Metodo nao permitido.' });
  }

  const expectedSecret = process.env.ACCESS_EMAIL_TEST_SECRET;
  if (!expectedSecret) {
    return response.status(404).json({ error: 'Endpoint de teste desativado.' });
  }

  const receivedSecret = request.headers['x-eden-test-secret'];
  if (receivedSecret !== expectedSecret) {
    return response.status(401).json({ error: 'Nao autorizado.' });
  }

  const { to, name, setupPasswordUrl, productName } = request.body || {};
  if (!to || !setupPasswordUrl) {
    return response.status(400).json({ error: 'Informe to e setupPasswordUrl.' });
  }

  try {
    const result = await sendAccessEmail({
      to,
      name,
      setupPasswordUrl,
      productName
    });

    return response.status(200).json({
      ok: true,
      id: result?.id || null
    });
  } catch (error) {
    console.error('Access email test error:', error);
    return response.status(500).json({ error: 'Nao foi possivel enviar o email de teste.' });
  }
}
