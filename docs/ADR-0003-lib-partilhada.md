# ADR-0003 — Biblioteca `lib/` partilhada entre dev e Vercel

- **Status:** aceite
- **Data:** 2026-09-15
- **Contexto:** `server.js` (dev) e `api/*.js` (Vercel) duplicavam `log()`, `fetchThingSpeak()`, validadores, middlewares JWT e rate-limit. A duplicação divergiu: rotas admin em dev aceitavam qualquer utilizador logado (`requireAuthApi` em vez de `requireAdminApi`), enquanto a Vercel exigia admin. Paridade dev/prod quebrada (ENGENHARIA §14).

## Decisão

Extrair para `lib/` após a terceira ocorrência (regra dos três, §3): `config`, `auth`, `validators`, `errors`, `middleware`, `logger`, `thingspeak`. Ambos os entrypoints consomem a mesma fonte.

## Alternativas consideradas

- **Tolerar duplicação:** descartado — as ocorrências já provaram ser o mesmo conceito (não coincidência), e a divergência causou bug de autorização real.
- **Pacote interno / monorepo (Turborepo):** descartado — over-engineering para este tamanho; `require('../lib/x')` resolve sem tooling novo (YAGNI).

## Consequências

- Correção do bypass de admin em dev; rate-limit, erros e logs idênticos nos dois ambientes.
