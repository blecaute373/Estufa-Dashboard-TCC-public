# 👥 Contribuidores — Estufa 01

Este projeto de TCC foi desenvolvido em **co-autoria**. Este ficheiro regista a
repartição das contribuições de forma explícita, para que nenhum crédito seja
implicitamente transferido de uma pessoa para outra.

## Autores

### Matheus Garbin — autor original
- GitHub: [@matheusbritogarbin-byte](https://github.com/matheusbritogarbin-byte)
- E-mail: matheusbritogarbin@gmail.com
- **Contribuição:** arquitetura base do sistema (monolito modular, ADR-0001),
  autenticação JWT com fail-fast (ADR-0002), biblioteca `lib/` partilhada entre
  dev e produção (ADR-0003), erros padronizados RFC 9457 (ADR-0004), proxy
  ThingSpeak resiliente (ADR-0005), controlo remoto via MQTT/WSS (ADR-0006),
  primeira fila de comandos na Vercel (ADR-0007), frontend (dashboard, admin,
  PWA), apps mobile (Capacitor) e desktop (Electron).

### Deivisson Lino Campos dos Santos Junior — co-autor
- GitHub: [@blecaute373](https://github.com/blecaute373)
- **Contribuição:**
  - **Fila de comandos em Upstash Redis** (ADR-0008) — migração da fila do
    MongoDB para o Upstash, com `REDIS_URL` numa única string e garantia de
    entrega *at-most-once* pelo lado do dispositivo.
  - **Controlo remoto do atuador (relé) fim-a-fim** — diagnóstico da cadeia
    completa painel → `/api/control` → fila → firmware → relé; identificação da
    causa-raiz (token vazio compilava sem aviso e o painel dizia "enfileirado
    OK" enquanto o relé nunca se movia).
  - **Firmware ESP32** (`260929-*/src/main.cpp`) — injeção do token via
    `include/secrets.h` (gitignored) + `secrets.h.example` versionado, com
    heurística de runtime `tokenPareceUpstash()` e avisos acionáveis na porta
    série.
  - **MongoDB Atlas em produção** (ADR-0010) — utilizador de BD com privilégio
    mínimo (`readWrite@estufa`, em vez de `readWriteAnyDatabase`), diagnóstico
    do *fail-fast* que derrubava o `POST /api/auth/login` com 500.
  - **App partilhada dev/prod** (ADR-0009) e cache de leitura com TTL.
  - **Scripts de diagnóstico** `scripts/check-control-chain.js`
    (`npm run check:control`) e `scripts/check-mongo.js`
    (`npm run check:mongo`), sempre com segredos mascarados.
  - **Deploy em produção** na Vercel (conta `deivisson1`), as 7 variáveis de
    ambiente configuradas e a cadeia de controlo verificada por pedidos HTTP
    reais.

## Nota sobre o histórico Git

O histórico de commits anterior a esta versão foi integralmente produzido pelo
autor original (Matheus Garbin), sob os identificadores `Matheus Garbin
<anonymous070508@gmail.com>`, `anonymous070508-crypto <anonymous070508@gmail.com>`
e `Matheus Garbin <matheusbritogarbin@gmail.com>`. **Esses registos não foram
reescritos nem reatribuídos** — a co-autoria de Deivisson é registada a partir
da v1.6.2 e nas contribuições que efetivamente realizou.
