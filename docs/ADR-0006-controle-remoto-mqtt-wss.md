# ADR-0006 — Controle remoto de atuadores via MQTT sobre WebSocket (WSS) — ~~SUPERADO~~

> **Superado pelo [ADR-0007](ADR-0007-fila-comandos-vercel.md)** (fila de comandos na
> Vercel, sem ngrok/broker externo). O código deste ADR (`api/mqtt.js`,
> `public/js/mqtt.min.js` e o fallback WSS em `control.js`) foi removido.
> Fica no histórico porque define o contrato `{command}`/`{duty}` e os tópicos
> MQTT que o ADR-0007 reutiliza.

- **Status:** superado (por ADR-0007)
- **Data:** 2026-09-24
- **Contexto:** o dashboard publicado na Vercel devolve **503** em `/api/control` por design — a função serverless não alcança o broker MQTT (Mosquitto) na rede local da estufa. Comandos manuais só funcionavam com o `server.js` rodando na rede local. O TCC precisa controlar os atuadores pelo site publicado.

## Decisão

O navegador passa a falar MQTT diretamente com o broker, através de **WebSocket seguro (WSS)**:

1. **Mosquitto no Raspberry Pi** ganha um listener WebSocket (`9001`, bind em loopback) com autenticação própria por senha (`per_listener_settings`), exposto à Internet por um **túnel TLS** (ngrok/cloudflared) — sem abrir portas no roteador. O listener `1883` continua anónimo e restrito à LAN (o firmware ESP32 conecta sem credenciais).
2. **Novo endpoint `GET /api/mqtt/config`** (serverless, `api/mqtt.js`) entrega `{url, username, password, prefix}` **apenas a admin autenticado** (`requireAdminApi`). Credenciais vivem em variáveis de ambiente (Twelve-Factor), nunca no JS público.
3. **`public/js/control.js`** mantém o `POST /api/control` como caminho principal; ao receber **503** (caso Vercel), publica direto no broker via `mqtt.min.js` (vendorizado em `public/js/`, sem CDN). Sem configuração, mantém o aviso atual.
4. Os payloads/tópicos são **idênticos** aos do caminho local (`fazenda/estufa01/atuador/<id>/comando`; `{command}`/`{duty}`), sem `origem:"auto"` — o firmware não distingue a origem, só o formato.

## Alternativas consideradas

- **Proxy no serverless para um túnel HTTP do `server.js`:** exigiria manter `server.js` + MongoDB acessíveis 24/7 e partilhar `JWT_SECRET` entre nuvem e casa; mais peças móveis, mesmo resultado para o utilizador.
- **Expor o broker MQTT cru (1883) na Internet:** rejeitado — sem TLS e sem autenticação, qualquer um publicaria nos tópicos.
- **Somente controle local:** mantém o 503 na nuvem e não atende ao requisito do TCC.

## Consequências

- O primeiro comando após abrir a página pode aguardar ~1 s (handshake WSS); cliques seguintes são imediatos (cliente com reconexão automática).
- Depende do túnel ativo no Raspberry para o controle remoto; sem ele, o comportamento antigo (aviso "Broker MQTT local indisponível") permanece.
- Novas variáveis de ambiente: `MQTT_WSS_URL`, `MQTT_WS_USER`, `MQTT_WS_PASS` (+ opcional `MQTT_TOPIC_PREFIX`).
