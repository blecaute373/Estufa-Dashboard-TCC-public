# ADR-0008 — Registo de sistema (SystemLog) com ponte logger→Mongo

- **Status:** aceite
- **Data:** 2026-09-24
- **Contexto:** o `lib/logger.js` estruturado registava autenticação, erros de
  request (`sendProblem`) e comandos de controlo — mas **apenas em stdout**. O
  painel de admin só mostrava `AccessLog` (auditoria: `login`, `logout`,
  `register`, `failed_login`, `control_*`). Quando algo corria mal, a única
  forma de reconstruir o que aconteceu era o terminal do servidor. Em Vercel
  isso é pior: cada função serverless tem stdout efémero.

## Decisão

Um registo técnico distinto do `AccessLog`, com `lib/syslog.js` (memória +
persistência injetada) e uma ponte em `lib/logbridge.js` que replica **tudo o
que o logger já emitia**, sem alterar um único call-site.

Pontos que não são obvios e ficaram fixados:

1. **`SystemLog` separado do `AccessLog`.** Auditoria (escrita pelo servidor,
   fiável, para efeitos legais) e diagnóstico (cresce muito mais rápido, TTL
   30 dias) têm ciclos de vida, volume e consumidores diferentes. Num só
   `event` field não se consegue filtrar um do outro sem ambiguidade.

2. **`created_at` = hora do EVENTO; `inserted_at` = hora da ESCRITA.** O
   Mongoose preenche timestamps na escrita, o que perderia a hora real de
   eventos que chegam com atraso (ex.: MQTT após queda de rede). Num log de
   diagnóstico, "quando" é metade do valor — persistir só a hora de escrita
   degrada o registo exactamente quando ele é mais útil.

3. **Portas e adaptadores (§4.3):** `lib/syslog.js` **não importa Mongoose**.
   A persistência é injetada (`setPersister`). Testável sem base de dados e
   uma falha de log nunca derruba um request.

4. **O sink nunca substitui o stdout, nunca é aguardado.** Um sink é um destino
   *adicional*. `logger.error` é chamado nos caminhos onde algo já correu mal;
   se a escrita persistente fosse síncrona, um Mongo lento transformaria um
   erro de negócio num erro de infraestrutura. Verificado com o Mongo em baixo:
   `POST /api/auth/login` respondeu 401 em 80 ms, com `requestId` intacto.

5. **A ponte é idempotente**, com guarda de módulo. `attachSink` deduplica por
   referência de função, mas cada chamada criaria uma arrow nova — em Vercel
   (onde `api/index.js` monta `authApp` e `adminApp`, ambos com logging) cada
   evento de autenticação seria gravado **duas vezes**.

6. **`source: 'esp'` NÃO é autoritativo.** Chega por MQTT através de um broker
   sem autenticação na LAN da estufa — qualquer um nela pode publicar eventos
   falsos. A UI tem de o apresentar como diagnóstico, nunca como prova.

## Alternativas consideradas

- **Ampliar o `AccessLog` com eventos técnicos:** descartado — mistura
  auditoria (que precisa de ser fiável e de retenção longa) com ruído
  operacional, e não permite retenção diferente por tipo.
- **Grafana Loki / Sentry / CloudWatch:** resolve a dor real (ver o que
  aconteceu no painel que já existe), mas exige infraestrutura e operação
  desproporcionadas para um TCC de uma pessoa, hostado em MongoDB free tier
  (incompatível com a restrição de custo, §28).
- **WebSocket/SSE para streaming de logs:** adiado — polling de 15 s resolve a
  necessidade atual; serverless e conexão persistente não se misturam (§28.3),
  e o broker só é alcançável do `server.js` local.
- **Persistir cada `master/status` do ESP (10 s):** descartado — 8 640
  registos/dia para informação que muda devagar. Persistir **transições**
  (ficou offline, sensor caiu) responde à pergunta real com uma fração do
  volume.

## Consequências

- `MONGODB_LOG_ENABLED=false` desliga só a persistência (stdout e memória
  continuam) — kill-switch em incidente, documentado no `.env.example`.
- O `SystemLog` **herda a mesma dependência do broker sem autenticação**: é
  diagnóstico, não prova. A distinção está escrita no BLUEPRINT §11.2.
- Persiste-se um ring buffer em memória (500 entradas) por processo — volátil
  por natureza; o que sobrevive a um restart é o que foi persistido.
- Testes: 67 → 79 `node:test` (Small, sem I/O) — o `lib.test.js` partilha
  agora o ficheiro com os testes de `lib/control.js`.