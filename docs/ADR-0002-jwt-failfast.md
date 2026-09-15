# ADR-0002 — JWT fail-fast em produção

- **Status:** aceite
- **Data:** 2026-09-15
- **Contexto:** `JWT_SECRET` tinha fallback `crypto.randomBytes()` em todos os entrypoints. Na Vercel (serverless) cada cold-start gerava um segredo diferente → tokens invalidados aleatoriamente. Em `server.js` faltava até o `require('crypto')` → `ReferenceError` se a var estivesse ausente.

## Decisão

`lib/config.js` centraliza o segredo: **falha explícita no arranque em produção** se `JWT_SECRET` ausente; em desenvolvimento usa segredo efémero com aviso. Regra Twelve-Factor: config em env, nunca hardcoded.

## Alternativas consideradas

- **Manter fallback aleatório sempre:** descartado — conveniência dev que quebra sessões em prod de forma intermitente (o pior tipo de bug).
- **Persistir segredo gerado em disco (`.jwt_secret`):** descartado — serverless não tem disco persistente; em dev seria estado escondido fora do `.env`.

## Consequências

- É obrigatório definir `JWT_SECRET` na Vercel (já documentado em `README.md` + `.env.example`). Dev continua `npm start` sem fricção.
