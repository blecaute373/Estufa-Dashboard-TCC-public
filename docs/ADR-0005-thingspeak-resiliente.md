# ADR-0005 — Proxy ThingSpeak resiliente (timeout + retry)

- **Status:** aceite
- **Data:** 2026-09-15
- **Contexto:** `fetchThingSpeak` usava `https.get` sem timeout: se o upstream pendurasse, a function Vercel pendurava até ao timeout da plataforma. Sem retry para falhas transitórias de rede.

## Decisão

`lib/thingspeak.js`: timeout 5s por tentativa + retry (máx 3) com backoff exponencial + jitter **apenas** para erro transitório (rede/timeout/5xx/429). GET é idempotente → retry seguro sem chave de idempotência. Erro permanente (4xx, JSON inválido) falha de imediato (fail-fast).

## Alternativas consideradas

- **Circuit breaker completo:** adiado — com um único upstream e baixo tráfego, retry limitado + timeout resolve a dor atual; breaker entra se o volume justificar (começar pequeno, §9.3/§10).
- **Trocar `https` por `fetch` global + AbortController:** considerado equivalente; mantido `https` para não mudar superfície de erro agora. Pode migrar depois sem mudar contrato.

## Consequências

- Latência pior-caso limitada (~5s + backoffs); 502 padronizado com `requestId` em vez de `details` interno.
