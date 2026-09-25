# ADRs — Architecture Decision Records (ENGENHARIA §15.2)

Índice de decisões arquiteturais. Cada ADR regista **contexto, opções,
decisão e consequências** — sobretudo *por que as alternativas foram
descartadas*.

| ADR | Título | Status |
|-----|--------|--------|
| [0001](ADR-0001-monolito-modular.md) | Monolito modular (sem microsserviços) | aceite |
| [0002](ADR-0002-jwt-failfast.md) | JWT fail-fast em produção | aceite |
| [0003](ADR-0003-lib-partilhada.md) | Biblioteca `lib/` partilhada dev/prod | aceite |
| [0004](ADR-0004-erros-rfc9457.md) | Erros padronizados (RFC 9457) | aceite |
| [0005](ADR-0005-thingspeak-resiliente.md) | Proxy ThingSpeak com timeout+retry | aceite |
| [0006](ADR-0006-controle-remoto-mqtt-wss.md) | Controle remoto via MQTT sobre WebSocket | ~~superado~~ pelo 0007 |
| [0007](ADR-0007-fila-comandos-vercel.md) | Controle remoto por fila de comandos na Vercel | ~~superado~~ (fila) pelo 0008 |
| [0008](ADR-0008-fila-upstash-redis.md) | Fila de comandos em Upstash Redis (híbrido) | aceite |
