import { getAuthUserByIdToken, getDocument } from './lib/firebaseRest.js';

const DEFAULT_GUARDIAN_PROMPT = [
  'Você é o Guardião do Éden, um mentor conversacional para uma área de membros fechada.',
  'Responda em português do Brasil, com acolhimento, clareza e objetividade.',
  'Não finja ser terapeuta, médico, advogado ou consultor financeiro.',
  'Quando a aluna trouxer algo sensível, acolha e incentive ajuda profissional adequada.',
].join('\n');

const extractOutputText = (responseBody) => {
  if (typeof responseBody.output_text === 'string') return responseBody.output_text;

  return (responseBody.output || [])
    .flatMap((item) => item.content || [])
    .filter((content) => content.type === 'output_text' && content.text)
    .map((content) => content.text)
    .join('\n')
    .trim();
};

const getBearerToken = (request) => {
  const authorization = request.headers.authorization || '';
  return authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
};

const isAccessExpired = (date) => {
  if (!date) return false;
  const parsedDate = date.includes('-') && date.split('-')[0].length === 4
    ? new Date(`${date}T23:59:59`)
    : (() => {
      const [day, month, year] = String(date).split('-').map(Number);
      return new Date(year || 0, (month || 1) - 1, day || 1, 23, 59, 59, 999);
    })();
  parsedDate.setHours(23, 59, 59, 999);
  return new Date() > parsedDate;
};

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Método não permitido.' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return response.status(500).json({ error: 'OPENAI_API_KEY não foi configurada no ambiente.' });
  }

  try {
    const idToken = getBearerToken(request);
    if (!idToken) return response.status(401).json({ error: 'Sessão ausente.' });

    const authUser = await getAuthUserByIdToken(idToken);
    if (!authUser?.uid) return response.status(401).json({ error: 'Sessão inválida.' });

    const userProfile = await getDocument('users', authUser.uid);
    if (!userProfile || userProfile.isBlocked || isAccessExpired(userProfile.accessExpiresAt)) {
      return response.status(403).json({ error: 'Acesso indisponível para este usuário.' });
    }

    const { messages = [] } = request.body || {};
    const sanitizedMessages = Array.isArray(messages)
      ? messages
          .filter((message) => ['user', 'assistant'].includes(message?.role) && typeof message?.content === 'string')
          .slice(-12)
          .map((message) => ({
            role: message.role,
            content: message.content.slice(0, 4000)
          }))
      : [];

    if (sanitizedMessages.length === 0) {
      return response.status(400).json({ error: 'Envie uma mensagem para o Guardião.' });
    }

    const userContext = `\nContexto da aluna: nome=${userProfile.name || 'não informado'}, folhas=${userProfile.points || 0}.`;

    const openaiResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-5',
        input: [
          {
            role: 'developer',
            content: `${process.env.GUARDIAN_SYSTEM_PROMPT || DEFAULT_GUARDIAN_PROMPT}${userContext}`
          },
          ...sanitizedMessages
        ],
        max_output_tokens: 900
      })
    });

    const responseBody = await openaiResponse.json();
    if (!openaiResponse.ok) {
      console.error('OpenAI guardian error:', responseBody);
      return response.status(openaiResponse.status).json({ error: 'O Guardião não conseguiu responder agora.' });
    }

    const message = extractOutputText(responseBody);
    return response.status(200).json({ message: message || 'Estou aqui. Pode me contar um pouco mais?' });
  } catch (error) {
    console.error('Guardian API error:', error);
    return response.status(500).json({ error: 'Erro interno ao conversar com o Guardião.' });
  }
}
