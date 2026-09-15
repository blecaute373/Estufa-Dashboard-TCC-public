# ADR-0004 — Erros de API padronizados (RFC 9457)

- **Status:** aceite
- **Data:** 2026-09-15
- **Contexto:** cada endpoint inventava o seu formato (`{error}`, `{ok}`, `details: err.message` com detalhe interno vazado — OWASP A10). Frontend fazia `d.error` e quebrava com qualquer mudança.

## Decisão

`lib/errors.js`: corpo `{type, title, status, detail, requestId}`. Detalhe público sempre genérico; detalhe interno só no log com `requestId` para o suporte rastrear.

## Alternativas consideradas

- **Manter `{error: string}`:** descartado — inconsistente, sem correlação, e vazava `err.message`/stack em `register` e no proxy ThingSpeak.
- **Adoptar biblioteca `http-problem` externa:** descartado — 30 linhas próprias bastam; evita dependência nova (KISS).

## Consequências

- Frontend atualizado para `detail||title||error` com fallback legado (`unwrapList`/`apiErrorMessage` em `admin.html`). Migração compatível, sem breaking imediato.
