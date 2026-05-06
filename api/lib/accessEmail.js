const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const getConfiguredAppUrl = () => {
  const url = process.env.APP_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || 'https://www.comunidadeeden.com.br';
  const normalizedUrl = url.replace(/^APP_URL=/, '').trim();
  return normalizedUrl.startsWith('http') ? normalizedUrl : `https://${normalizedUrl}`;
};

export const buildAccessEmail = ({
  name = '',
  setupPasswordUrl,
  productName = 'Comunidade Eden'
}) => {
  const safeName = escapeHtml(name || 'aluna');
  const safeProductName = escapeHtml(productName);
  const safeSetupPasswordUrl = escapeHtml(setupPasswordUrl);
  const appUrl = escapeHtml(getConfiguredAppUrl());

  const subject = `Seu acesso ao ${safeProductName}`;
  const preview = `Crie sua senha para acessar o ${safeProductName}.`;
  const text = [
    `Ola, ${name || 'aluna'}!`,
    '',
    `Seu acesso ao ${productName} foi liberado.`,
    'Para criar sua senha e entrar na area de membros, acesse:',
    setupPasswordUrl,
    '',
    `Depois disso, voce pode entrar normalmente por ${getConfiguredAppUrl()}.`,
    '',
    'Se voce nao reconhece essa compra, ignore este email.'
  ].join('\n');

  const html = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${subject}</title>
  </head>
  <body style="margin:0;background:#020607;font-family:Arial,Helvetica,sans-serif;color:#f7fbfb;">
    <span style="display:none;max-height:0;overflow:hidden;color:transparent;">${escapeHtml(preview)}</span>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#020607;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#071418;border:1px solid rgba(75,211,255,0.22);border-radius:24px;overflow:hidden;">
            <tr>
              <td style="padding:34px 32px 22px;border-bottom:1px solid rgba(255,255,255,0.08);">
                <p style="margin:0 0 10px;color:#4bd3ff;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;">Acesso liberado</p>
                <h1 style="margin:0;color:#ffffff;font-size:28px;line-height:1.15;">Bem-vinda ao ${safeProductName}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:30px 32px 34px;">
                <p style="margin:0 0 18px;color:#d8e5e5;font-size:16px;line-height:1.6;">Ola, ${safeName}.</p>
                <p style="margin:0 0 24px;color:#d8e5e5;font-size:16px;line-height:1.6;">Seu acesso foi liberado. Agora falta apenas criar sua senha para entrar na area de membros.</p>
                <a href="${safeSetupPasswordUrl}" style="display:inline-block;background:#4bd3ff;color:#001014;text-decoration:none;font-size:13px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;padding:15px 22px;border-radius:14px;">Criar minha senha</a>
                <p style="margin:26px 0 0;color:#8fa1a6;font-size:13px;line-height:1.6;">Depois de criar a senha, voce pode acessar diretamente por <a href="${appUrl}" style="color:#4bd3ff;text-decoration:none;">${appUrl}</a>.</p>
                <p style="margin:22px 0 0;color:#65767c;font-size:12px;line-height:1.6;">Se voce nao reconhece essa compra, ignore este email.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, text, html };
};

export const sendAccessEmail = async ({
  to,
  name,
  setupPasswordUrl,
  productName
}) => {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY nao foi configurada no ambiente.');
  }

  if (!process.env.RESEND_FROM_EMAIL) {
    throw new Error('RESEND_FROM_EMAIL nao foi configurada no ambiente.');
  }

  if (!to || !setupPasswordUrl) {
    throw new Error('Email de destino e link de criacao de senha sao obrigatorios.');
  }

  const email = buildAccessEmail({ name, setupPasswordUrl, productName });

  const resendResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL,
      to,
      reply_to: process.env.RESEND_REPLY_TO || undefined,
      subject: email.subject,
      html: email.html,
      text: email.text
    })
  });

  const responseBody = await resendResponse.json().catch(() => ({}));
  if (!resendResponse.ok) {
    console.error('Resend API error:', responseBody);
    throw new Error('Nao foi possivel enviar o email de acesso.');
  }

  return responseBody;
};
