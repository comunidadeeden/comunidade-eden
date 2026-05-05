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
    const { messages = [], user = null } = request.body || {};
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

    const userContext = user
      ? `\nContexto da aluna: nome=${user.name || 'não informado'}, folhas=${user.points || 0}, nível=${user.level || 'não informado'}.`
      : '';

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
