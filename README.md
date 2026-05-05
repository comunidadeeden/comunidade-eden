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
