# Area de Membros Eden

Aplicacao React/Vite para a area de membros do Eden, com autenticação Firebase,
conteudos em trilhas, materiais de apoio, audios diarios, missoes e painel
administrativo.

## Requisitos

- Node.js 22 ou superior
- Projeto Firebase com Authentication e Firestore configurados
- Arquivo `firebase-applet-config.json` com as credenciais publicas do app

## Desenvolvimento

```bash
npm install
npm run dev
```

O servidor local sobe em `http://localhost:3000`.

## Checagem de Deploy

```bash
npm run deploy:check
```

Esse comando roda a checagem TypeScript e o build de producao.

## Emails transacionais

O envio de emails de primeiro acesso fica preparado para usar a Resend pelo
backend em `api/lib/accessEmail.js`. As chaves devem ser configuradas apenas nas
variaveis de ambiente da Vercel/local, nunca no GitHub.

Variaveis necessarias:

```bash
APP_URL=https://comunidadeeden.com.br
RESEND_API_KEY=
RESEND_FROM_EMAIL="Eden <acesso@brunosimplicio.com.br>"
RESEND_REPLY_TO=suporte@brunosimplicio.com.br
```

Antes de ativar a automacao de compras, configure o dominio na Resend e valide os
registros DNS de SPF, DKIM e DMARC. Isso melhora a entrega dos emails de criacao
de senha e reduz risco de cair em spam.

## Firebase

As regras de seguranca ficam em `firestore.rules`. Antes de publicar, aplique as
regras no projeto Firebase e confirme que o dominio de producao esta autorizado
no Firebase Authentication.

No Firebase Authentication, habilite o provedor `Email/Password` e a opcao
`Email link (passwordless sign-in)`. O email `gu.correa98@gmail.com` e tratado
como admin pela aplicacao e pelas regras do Firestore.

## Observacoes

- O projeto nao precisa de `GEMINI_API_KEY`.
- Arquivos `.env` reais nao devem ser versionados.
- O build final fica em `dist/`.
