# ADR-0007 — Controlo remoto de atuadores por fila de comandos na Vercel

- **Status:** ~~superado~~ pela parte do armazenamento da fila pelo [ADR-0008](ADR-0008-fila-upstash-redis.md) — a **inversão do sentido do comando e os endpoints mantêm-se**. O `models/ControlCommand.js` foi removido e a fila passou para o Upstash Redis.
- **Data:** 2026-09-24
- **Contexto:** o dashboard publicado na Vercel devolvia **503** em `/api/control` por design — a função serverless não alcança o broker MQTT (Mosquitto) na rede local da estufa. O controlo manual só funcionava com o `server.js` a correr na mesma rede do ESP32. O requisito é controlar os atuadores **a partir do site publicado, usando apenas a Vercel** (sem ngrok, sem túnel, sem broker externo). Substitui o [ADR-0006](ADR-0006-controle-remoto-mqtt-wss.md).

## Decisão

**Inverter o sentido do comando**: em vez de o servidor "puxar" o comando até à estufa (impossível — serverless não tem rota para a LAN), **é o dispositivo que vai buscar o comando**.

```
admin (Vercel) ──POST /api/control──► Vercel ──► MongoDB Atlas (fila: pending → delivered, TTL 5 min)
                                          ▲
ESP32 ──GET /api/control/pending (X-Device-Token, a cada 5 s)──┘
   └─► aplica relés/PWM (mesmos payloads do caminho local)
```

1. **`lib/control.js`** passa a ser a **fonte única do contrato** `(actuator, action) → payload` (`{command}` / `{duty}`), usada tanto pelo caminho local (publica num tópico MQTT) como pela fila na nuvem — uma regra de negócio, dois transportes (DRY com 2 ocorrências reais, não abstração preventiva).
2. **`api/control.js`** (serverless) expõe:
   - `POST /api/control` — `requireAdminApi` + `controlLimiter`; valida com o contrato partilhado, grava o comando como `pending`, regista auditoria no `AccessLog` (`control_<actuator>`) e responde **`202 {queued: true}`** (aceito, ainda não aplicado).
   - `GET /api/control/pending` — `deviceLimiter`; autentica o dispositivo por **`X-Device-Token` comparado em tempo constante** (`crypto.timingSafeEqual` sobre o SHA-256, para nunca vazar bytes por tempo de resposta), devolve até 10 comandos pendentes e marca-os `delivered` na entrega.
   - `models/ControlCommand.js` com **TTL index em `expires_at`**: comando nunca buscado expira sozinho (retenção com prazo, sem job de limpeza).
3. **Firmware (`estufa45`)**: novo `GET` HTTPS a cada `POLL_COMANDO_MS` (5 s), com `WiFiClientSecure` + CA do domínio da Vercel, `X-Device-Token`, timeout de 4 s e `esp_task_wdt_reset()` dentro do poll. O handler dos atuadores da fila é o espelho do `callbackLocal()` do MQTT — **payloads e tópicos inalterados**, o firmware continua a subscrever os tópicos MQTT no modo local.
4. **Removido** o caminho WSS do ADR-0006 (`api/mqtt.js`, `public/js/mqtt.min.js` — 342 KB fora do PWA — e o respetivo fallback em `control.js`), por ser código morto (ENGENHARIA §2.4).
5. **`server.js` (caminho local)**: mantém a publicação direta no broker, agora com cliente MQTT **único** (a versão anterior criava um cliente novo por pedido e sofria de corrida nos handlers), espera de ligação (2 s) e **publish aguardado** antes de responder `ok` (elimina o `Cannot set headers after they are sent`).

## Alternativas consideradas

- **Broker MQTT na nuvem (HiveMQ Cloud / EMQX grátis):** o melhor em tempo real (~1 s) e standards-compliant, mas é um **serviço novo** e uma conta nova — contrariou o requisito "somente Vercel".
- **Expor o Mosquitto na Internet (port-forward + WSS):** seguro apenas com TLS/ACLs Properly configurados, expõe a rede local e exige manutenção permanente — rejeitado.
- **ThingSpeak como transporte de comando:** verificado — a opção gratuita tem **intervalo de atualização de 15 s por canal** e limite de 4 canais; comandos em sequência seriam descartados.
- **Long-polling na função serverless:** seguro, mas segurar a função 30–60 s a cada poll rebusta o limite de *memory-hours* do plano Hobby (verificado: 360 GB-h/mês).
- **Só controlo local:** mantém o 503 na nuvem e não atende ao requisito.

## Consequências

- **Latência:** o comando é aplicado em até ~5 s (intervalo de poll), não de imediato. É o preço explícito de não ter nenhum processo a correr na rede local.
- **Custo:** 5 s ⇒ ~518 mil invocações/mês, dentro do limite de **1.000.000** do plano Hobby (verificado). Com 10 s desce para ~26%.
- **Confiabilidade:** se o ESP32 recolhe e cai antes de executar, o comando é perdido (marcado `delivered` na entrega) — aceitável porque os comandos são **idempotentes** (definem estado, não incrementam): reenviar é inofensivo.
- **Segurança:** o painel exige admin; o dispositivo é autenticado por token de ambiente com comparação em tempo constante; `DEVICE_TOKEN` ausente ⇒ *fail-closed* (401), nenhum comando é aplicado.
- **Escalabilidade:** a fila vive no MongoDB (já exigido pelo projeto) — sem broker, sem serviço extra, sem túneis.
