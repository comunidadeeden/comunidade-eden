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
APP_URL=https://www.comunidadeeden.com.br
RESEND_API_KEY=
RESEND_FROM_EMAIL="Eden <acesso@brunosimplicio.com.br>"
RESEND_REPLY_TO=suporte@brunosimplicio.com.br
ACCESS_EMAIL_TEST_SECRET=
```

Antes de ativar a automacao de compras, configure o dominio na Resend e valide os
registros DNS de SPF, DKIM e DMARC. Isso melhora a entrega dos emails de criacao
de senha e reduz risco de cair em spam.

Para testar o envio pela Vercel, configure `ACCESS_EMAIL_TEST_SECRET` com um
valor forte e envie uma requisicao `POST` para `/api/test-access-email` usando o
header `x-eden-test-secret`. Se a variavel nao existir, o endpoint fica
desativado.

## Webhook Hotmart

O endpoint da Hotmart fica em:

```bash
https://www.comunidadeeden.com.br/api/webhooks/hotmart
```

Variaveis de ambiente necessarias na Vercel:

```bash
HOTMART_HOTTOK=
HOTMART_MAIN_PRODUCT_IDS=123456,789012
HOTMART_OFFER_MAP={"123456":"id_da_oferta_no_firestore","123456:ABCDEF":"id_da_oferta_no_firestore"}
DEFAULT_ACCESS_DAYS=365

FIREBASE_PROJECT_ID=gen-lang-client-0773439289
FIRESTORE_DATABASE_ID=ai-studio-7894fd20-6f3b-4479-9bc3-4af439615a46
FIREBASE_WEB_API_KEY=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
```

`HOTMART_MAIN_PRODUCT_IDS` libera o acesso principal da comunidade. `HOTMART_OFFER_MAP`
liga produtos/ofertas da Hotmart a ofertas criadas no painel do Eden; a chave pode
ser o ID do produto, o codigo da oferta, ou `produto:oferta`.

Quando a Hotmart enviar uma compra aprovada, o backend cria/encontra o usuario no
Firebase Auth, atualiza `users/{uid}`, gera um link de criacao de senha e envia o
email pelo Resend. Reembolso, chargeback e cancelamento removem a oferta comprada
ou bloqueiam o acesso quando o produto for de acesso principal.

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
