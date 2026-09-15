# ADR-0001 — Monolito modular (sem microsserviços)

- **Status:** aceite
- **Data:** 2026-09-15
- **Contexto:** TCC, equipa pequena (<10), produto <1 ano, fronteiras de domínio ainda a estabilizar (dashboard, admin, proxy ThingSpeak partilham os mesmos modelos `User`/`AccessLog`).

## Decisão

Manter **um único deployable** (Express local + functions Vercel) com **fronteiras internas claras** (`api/`, `lib/`, `models/`, `public/`). Não decompor em microsserviços.

## Alternativas consideradas

- **Microsserviços por domínio (auth / thingspeak / admin):** descartado — sem necessidade de escala independente entre partes, sem equipas autónomas com deploys descoordenados (Lei de Conway não se aplica aqui). Exigiria observabilidade/orquestração que o projeto não tem (ENGENHARIA §4.1).
- **Monolito sem fronteiras (tudo em `server.js`):** descartado — era o estado anterior e gerou duplicação dev/prod + bypass de admin. A modularização por `lib/` resolve sem custo operacional.

## Consequências

- Positivas: 1 pipeline, 1 deploy, testes Medium baratos, assistentes de IA navegam bem módulos pequenos e bem-escopados.
- Negativas aceites: se um dia houver escala genuinamente diferente por domínio, extrair via Strangler Fig.
