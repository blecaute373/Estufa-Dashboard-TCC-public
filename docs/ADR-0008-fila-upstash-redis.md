# ADR-0008 — Fila de comandos em Upstash Redis (híbrido), no lugar do MongoDB

- **Status:** aceite
- **Data:** 2026-09-25
- **Contexto:** o [ADR-0007](ADR-0007-fila-comandos-vercel.md) pôs a fila de comandos no MongoDB (`models/ControlCommand.js`), resolvendo o "só publicar na Vercel" sem serviço novo. Mas o poll do ESP32 é, de longe, a operação mais frequente do sistema (a cada 5 s) e no MongoDB custava **2+ queries por poll** — `find()` seguido de `updateMany()`. Duas consequências: (a) a consulta mais comum do sistema inteiro era a mais cara, e (b) essa dupla operação **não era atómica** — entre o `find` e o `updateMany`, um segundo poll podia ler os mesmos comandos e o dispositivo executá-los duas vezes (ENGENHARIA §12.2).

## Decisão

**Arquitetura híbrida, deliberada** — não "Redis em vez de MongoDB":

| Dado | Onde vive | Porquê |
|---|---|---|
| `User`, `AccessLog` | **MongoDB Atlas** (inalterado) | `populate()`, unicidade de username/e-mail, `countDocuments()`, logs paginados com filtro — sem equivalente barato em Redis |
| `ControlCommand` | **Upstash Redis** (`estufa:comandos:<device>`) | Fila pop-atómico, 1 comando por poll, caminho crítico isolado do Atlas |

```
admin (Vercel) ──POST /api/control──► Vercel ──► Upstash Redis  (LPUSH + EXPIRE 300)
                                          ▲
ESP32 ──GET /api/control/pending (X-Device-Token, a cada 10 s)──┘
   └─► aplica relés/PWM (mesmos payloads do caminho local)
```

### Como se decide o intervalo do poll

O plano grátis é contado em **comandos**, e o poll é o que o consome. Com `LPOP` um poll com fila vazia custa **1 comando** (o caso comum: 99 % do tempo).

| Poll | Comandos/dia | /mês | Cabe nos 500K/mês? |
|---:|---:|---:|---|
| 5 s (ADR-0007) | 17 280 | 518 400 | ❌ estoura |
| **10 s (decidido)** | **8 640** | **259 200** | ✅ ~48 % de folga |

**Os 10 s são uma melhoria, não um custo:** o ThingSpeak publica a cada ~15 s, portanto aos 10 s o **controlo dos atuadores passa a ser mais responsivo do que a própria telemetria**.

> ⚠️ A documentação do Upstash é **inconsistente** sobre o limite: a tabela de preços diz *500K comandos/mês*, mas o FAQ ainda diz *"10 000 requests per day"*. Adoptámos a **restrição mais apertada** para não haver surpresa em produção. Mesmo assim, 8 640 comandos/dia também caberia em 10 000/dia. Confirmar o número no console antes do deploy.

### Implementação

1. **`lib/store.js` (novo)** — porta única para o Redis (ENGENHARIA §4.3): `enfileirarComando()` e `retirarComandos()`. Nada mais no projeto fala com o `@upstash/redis`.
   - `LPOP chave 10` — **uma** operação atómica, fecha a corrida do `find`/`updateMany`.
   - **Retenção (§9.5):** um LIST não tem TTL por elemento, portanto a validade viaja **dentro do payload** (`expires_at`) e é verificada no pop — mesma semântica exacta do TTL index. O `EXPIRE 300` na chave é apenas rede de segurança (fila abandonada pelo dispositivo durante dias).
2. **`models/ControlCommand.js` — removido.** `User` e `AccessLog` ficam no Mongo.
3. **`api/control.js`** — `POST` enfileira com **pipeline** (`LPUSH`+`EXPIRE` numa
   única viagem de rede) e responde `202`; `GET /pending` faz `LPOP` e
   **já não chama `connectDB()`**.
4. **Auditoria best-effort (§13):** o comando entra na fila **antes** de a auditoria correr, e a falha do `AccessLog` é só registada em log. Uma falha do Atlas **não bloqueia o controlo da estufa** (bolkhead §11.3) — era o contrário antes, quando `connectDB()` precedia o `create()`. Desde a v1.7.0 a auditoria corre **depois de a resposta `202` ter saído** (`res.on('finish')`), pelo que nem a latência do Atlas aparece mais no `POST`.
5. **`lib/config.js`** — `REDIS_URL`: **uma única variável** com endpoint **e** token, que é o que o painel da Upstash/Vercel KV mostra. `parseRedisUrl()` extrai o `{url, token}` que o SDK `@upstash/redis` continua a receber, e aceita os formatos documentados (`?_token=`, `https://TOKEN@host`, `https://default:TOKEN@host`). O token é removido do URL devolvido — o SDK envia o cabeçalho `Authorization: Bearer` e não quer o token duplicado na query string. *Fail-fast* e **sem fallback**: uma variável a menos para alguém errar, e sem ela a fila não funciona logo com mensagem explícita, em vez de rebentar no primeiro poll real com 500 no caminho crítico.
6. **Firmware:** `POLL_COMANDO_MS` de 5 s → **10 s**. Nada mais muda — o contrato HTTP é idêntico.

## Alternativas consideradas

- **Manter tudo no MongoDB (ADR-0007 como estava):** zero trabalho, mas mantém a corrida `find`/`updateMany` e deixa a operação mais frequente do sistema ser a mais cara. Uma fila é exactamente o caso em que o Redis é a ferramenta certa.
- **Migrar TUDO para o Redis (User + AccessLog + fila):** tecnicamente viável — `User` em HASH + SET (`SCARD` resolve o `countDocuments` em O(1)) e `AccessLog` em ZSET com `ZREVRANGEBYSCORE` a mapear a paginação. Rejeitado: (a) ~12 ficheiros e perda da validação de schema do Mongoose; (b) para `User` obriga a denormalizar o e-mail no log para manter o filtro "logs por utilizador" — trabalho a mais, resultado igual; (c) para `AccessLog` os 256 MB da base grátis tornam-se o gargalo — e os logs são justamente o dado que *não* se pode perder. Um dado que precisa de histórico durável não deve viver numa base de 256 MB sem redundância.
- **Sorted set (ZSET) com `ZPOPMIN`/Lua em vez de LIST:** o score daria ordenação por validade, mas `ZRANGE`+`ZREM` são **duas** operações (a corrida volta) e um script Lua é mais superfície para um ganho que a app já resolve em memória filtrando `expires_at`. **KISS/YAGNI.**
- **Intervalo de 15 s** (acompanhar o ThingSpeak): 5 760 comandos/mês, ainda mais folga, mas piora a latência de controlo sem necessidade — 10 s já têm 48 % de folga.
- **Fila apenas em memória na função serverless:** inválido — o estado não sobrevive a um cold start.

## Consequências

- **Corrida eliminada** e validada por teste: 5 polls concorrentes sobre 5 comandos entregam cada `id` **exatamente uma vez** (`test/control.test.js`).
- **Latência:** ~10 s (era ~5 s), mas continua mais rápida que a telemetria ThingSpeak.
- **Custo:** $0. O plano grátis está calculado para o caso normal com 48 % de folga.
- **Isolamento de falhas:** o caminho crítico dos atuadores deixou de depender do MongoDB Atlas.
- **Duas dependências** em vez de uma: aceito, e justificado pela cobertura do caminho crítico — não por preferência estética.
- **Limites do plano grátis (verificados na documentação):** sem réplicação multi-instância (ponto único de infraestrutura, *não* perda de dados — o Durable Storage escreve em memória **e** disco); *eviction* **desligado por padrão**, ou seja, ao atingir 256 MB as escritas são **rejeitadas** em vez de apagar chaves; base arquivada após 30 dias de inatividade (irrelevante: com poll de 10 s nunca fica inativa).
- **Segredos:** o token vive dentro de `REDIS_URL`, **só** no ambiente da Vercel. O firmware conhece apenas `DEVICE_TOKEN`.


---

## Aditivo (v1.7.0, 2026-09-29) — três decisões de caminho

Estas três não mudam a arquitetura: tiram latência e comportamento-surpresa do
caminho que este ADR já descrevia. Ficam aqui porque alteram o que o código faz.

### 1. `LPUSH` + `EXPIRE` numa pipeline

Eram **duas** chamadas de rede por comando, quando o `EXPIRE` só serve de rede de
segurança para uma fila abandonada. `lib/store.js` agora usa a pipeline do SDK
(`client.pipeline()`) e devolve `{ ok: false, erro: 'redis_unavailable' }` se a
escrita falhar — em vez de deixar a exceção subir, o que produzia **500 sem
mensagem** no `POST /api/control` (a `erroInterno()` lê `err.message`, e o erro do
Upstash não dizia o que faltava). *Consequência:* metade dos round-trips no `POST`
e um 502 com mensagem acionável quando falta `REDIS_URL`.

### 2. Colapso por atuador antes de enfileirar (último clique vence)

`retirarComandos()` entrega até 10 comandos **por ordem de chegada**. Se o
utilizador clicar `ligar → desligar → ligar` no ventilador enquanto o ESP32 não
vai à fila, o firmware executa os três e **para no estado do clique mais antigo**
— o `LPOP` entrega o mais velho primeiro. A UI mostrava "comando enviado" três
vezes e a estufa ficava no estado errado, sem que nada o denunciasse.

`lib/store.js` ganhou `colapsarPorAtuador()`: para cada `(dispositivo, atuador)`
fica **apenas o comando mais recente** do lote (mantendo os `auto` por serem
modo, não estado). *Consequência:* o `202 {queued:true}` passa a significar
"este é o comando vigente deste atuador", não "vai ser executado". O `id`
colapsado continua no AccessLog. A UI mantém os 5 s de bloqueio por atuador, que
são o desenho original do polling.

> ⚠️ **Armadilha que este helper evita:** a lista é `LPUSH`, logo o pop devolve o
> **mais recente primeiro** (LIFO). Colapsar sem **inverter o lote primeiro**
> escolheria o comando **mais antigo** de cada atuador — o oposto do pretendido,
> e silencioso. Está coberto por teste em `test/lib.test.js`.

### 3. Auditoria fora do caminho crítico

O `202` é enviado antes de o `AccessLog` ser escrito (`res.on('finish')`). O `202`
significa "na fila", e a fila já estava confirmada antes disso. *Consequência:* um
Atlas lento ou em manutenção deixa de aparecer na latência do clique do admin; e o
`setImmediate` do teste da entrada local passou a esperar **duas** voltas do event
loop (uma para a resposta sair, outra para a auditoria começar).

---

## Aditivo (v1.7.1, 2026-10-01) — token ausente deixa de ser uma falha silenciosa

**Sintoma reportado:** "o acionamento manual dos relés pelo dashboard não funciona".
O painel devolvia `202 {queued:true}` (comando enfileirado) e **o relé nunca
mudava**. Nada no servidor falhava: a fila recebia o comando e o `LPOP` estava
correto. O defeito estava **a montante**, do lado do dispositivo.

### Causa raiz

`src/main.cpp` tinha o token do dispositivo como um **placeholder vazio**:

```cpp
const char* API_VERCEL_TOKEN = "";   // <-- OBRIGATORIO: cole o seu token
```

Como `prepararHttpsVercel()` faz `if (strlen(API_VERCEL_TOKEN) < 16) return false;`,
com o token vazio o `pollComandosVercel()` **retornava imediatamente** e o ESP32
**nunca chamava** `GET /api/control/pending`. Os comandos ficavam na fila até
expirarem aos 5 min (`expires_at`) e o atuador nunca era acionado.

O que tornou isto caro de diagnosticar não foi o bug — foi o **silêncio**: um token
vazio **compila sem qualquer aviso**, e o único sinal era uma linha de `Serial` que
ninguém vê sem consola ligada. O painel dizia "sucesso" e o hardware não se mexia.

### Decisão

1. **O token sai do código versionado** (ENGENHARIA §9.2) e passa a ser injetado
   por um ficheiro **local**, ignorado pelo Git:
   - `include/secrets.h.example` (versionado, com instruções) →
   - `include/secrets.h` (local, com `#define API_VERCEL_TOKEN "..."`).

   `main.cpp` usa `#if __has_include("secrets.h")`, portanto **sem** o ficheiro o
   projeto continua a compilar — apenas com o token vazio.

2. **O modo de falha passa a ser visível no BUILD**, não só na consola série:

   ```cpp
   #ifndef API_VERCEL_TOKEN
     #warning "API_VERCEL_TOKEN ausente: o ESP32 NAO vai buscar comandos da fila..."
     const char* API_VERCEL_TOKEN = "";
   #endif
   ```

   *Consequência:* recompilar sem o `secrets.h` produz um `-Wcpp` no log do
   PlatformIO (confirmado no build: `src/main.cpp:113:4: warning: #warning ...`).
   A avaria deixa de ser invisível.

3. **O aviso de arranque ficou acionável** (diz o que falta e como corrigir), em
   vez do antigo `"AVISO: API_VERCEL_TOKEN vazio"` sem instrução.

4. **`server.js` (caminho local):** o broker por omissão passou a coincidir com o
   `.env.example` (`mqtt://192.168.0.6:1883`; era `192.168.100.3`) e, se
   `LOCAL_MQTT_BROKER` não estiver definido, o arranque **regista um aviso** — o
   mesmo sintoma ("o relé não reage") tem duas causas possíveis (token na nuvem,
   IP do broker no local) e o utilizador passa a ver qual delas está ativa.

### Alternativas descartadas

- **Deixar o placeholder e confiar na disciplina** — foi exatamente o que falhou.
  O custo de corrigir isto é um `#warning`; o custo de o não ter é um TCC em que o
  hardware não responde e o código "parece" certo.
- **Token com valor por omissão no código** — segredo versionado (§9.2). Fora.

## Aditivo (v1.7.2, 2026-10-02) — os DOIS segredos, lado a lado

A v1.7.1 tratou o token **ausente**. O passo seguinte em campo foi trocar os
**segredos** entre si: o token do Upstash foi colado em `API_VERCEL_TOKEN`
(firmware) e o `REDIS_URL` ficou com o endpoint sozinho. Cada um quebra uma
metade diferente do caminho, e nenhum dos dois falha de forma óbvia:

| Variável | Onde vive | Valor | Se estiver errada |
| --- | --- | --- | --- |
| `DEVICE_TOKEN` (Vercel) **e** `API_VERCEL_TOKEN` (firmware) | os dois lados, **iguais** | string longa que o autor gera (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) | `GET /api/control/pending` → **401** fail-closed; o ESP32 nunca aplica nada |
| `REDIS_URL` (só Vercel) | apenas ambiente da Vercel | `https://HOST.upstash.io/?_token=<TOKEN-UPSTASH>` | `parseRedisUrl()` lança logo *"REDIS_URL sem token"*; `POST /api/control` falha e nada entra na fila |

**Porque é que o endpoint sozinho não serve (verificado, não suposto):**
`https://SEU-ENDPOINT.upstash.io` **sem** `?_token=` faz o `lib/config.js`
lançar `[config] REDIS_URL sem token...` — o token tem de estar *na própria
string*, porque é o único sítio de onde é extraído. `test/lib.test.js` já cobre
este caso ("URL sem token → erro que diz COMO resolver").

**E o token tem de ser o REST token, não a password TCP (confirmado em campo, 02/10/2026):**
uma base Upstash expõe **dois segredos diferentes** — a password da ligação
`redis://` (TCP, uma string curta tipo `0ic14fz...`) e o **REST token** usado
pelo endpoint HTTPS (começa por `AX`, mais longo). A password TCP **passa** a
validação sintáctica do `parseRedisUrl`, e o `SET` chega a sair — mas o Upstash
responde **`WRONGPASS invalid or missing auth token`**. Nenhum teste de formato
distingue os dois casos; só um round-trip real distingue, que é exactamente o
que `npm run check:control` faz (`SET`/`GET`/`DEL` de uma chave de diagnóstico
com TTL de 60 s — 3 comandos do plano grátis, contra horas a depurar o sítio
errado).

**O erro que mais engana:** o token do Upstash *parece* um token válido (36
caracteres alfanuméricos, sem espaços) e cola-se em `API_VERCEL_TOKEN` sem
levantar suspeita em build nem em arranque. O resultado é o pior tipo de falha:
o painel devolve `202 {queued:true}`, o comando entra na fila, e o relé não se
mexe. Duas defesas novas:

1. **Firmware:** `tokenPareceUpstash()` — heurística de forma (30–40 caracteres
   `[a-z0-9]`, o perfil do token REST da Upstash, contra os 64 hex do
   `DEVICE_TOKEN` recomendado) imprime aviso explícito no arranque. É uma
   heurística e está escrita como tal: **avisa, não bloqueia**.
2. **Mensagem de 401** no poll deixou de ser ambígua — nomeia as duas causas
   (token diferente entre os lados / token do Upstash colado no sítio errado).

**Nota de segurança (§9.2/§9.10):** o token ficou hardcoded no `main.cpp`, que é
um ficheiro versionável. O `.gitignore` passou a excluir o **diretório inteiro**
do projeto PlatformIO (`260929-*/`) — o `main.cpp` tem as mesmas credenciais do
`.ino` (WiFi, ThingSpeak, token), e foi esse padrão que a v1.1.0 teve de reverter
com `security: remove leaked secrets`. A alternativa sem segredo no código
continua disponível: `include/secrets.h` (ignorado), lido por
`#if __has_include("secrets.h")`.

### Como verificar (checklist)

**Deploy de 02/10/2026 — resultado FINAL medido no site publicado** (não inferido;
cada linha é um pedido real, antes → depois de configurar as variáveis):

| Pedido | Antes | Depois |
|---|---|---|
| `GET /api/health` | 200 | **200** `{"ok":true,"thingspeak":true}` |
| `GET /api/control/pending` **sem** token | 401 | **401** (fail-closed) |
| `GET /api/control/pending` **com** token | 500 | **200** `{"ok":true,"count":0}` |
| `GET /api/thingspeak/last` | 502 | **200** com dados reais (`27.40 °C`) |
| `POST /api/control` | 401 | **202** `{"ok":true,"queued":true,"id":"c6378c0e-…"}` |
| `POST /api/auth/login` | 500 | **200** `{"ok":true,"is_admin":true}` |

**Prova ponta-a-ponta da fila** (o que interessa para o acionamento manual) —
enfileirar pelo MESMO `lib/store.js` que a Vercel usa, e buscar pelo endpoint
público, que é o que o ESP32 faz:

```
1_ENFILEIRADO  id=f33b8e4e-…  payload={"command":"ON"}
2_POLL         status=200 count=1
2_IDS_IGUAIS   true      ← o dispositivo recebe o MESMO id e payload
3_SEGUNDO_POLL count=0   ← at-most-once: não entrega duas vezes
```

Um comando deixado na fila além dos 5 min foi **descartado** no poll seguinte
(`count:0`, chave removida) — o TTL lógico funciona, tal como desenhado.

O que isto prova: o **transporte** está correcto (o ESP32 alcança o endpoint
publicamente, sem bloqueio de Deployment Protection) e a **fila** entrega e não
duplica. O que faltava era apenas **configuração** — e cada variável em falta
falhava num sítio diferente, que é precisamente por que as três se diagnosticam
em segundos com pedidos reais em vez de leitura de código.

> **Lição operacional do deploy:** os `vercel --prod` ficavam **`Blocked`** — o
> processo do CLI era morto a meio de "Building…" quando uma nova sessão de
> terminal arrancava, e a Vercel não conclui o deployment. O que funciona é
> **`vercel redeploy <url> --no-wait --non-interactive`**: a criação acontece do
> lado do servidor e o CLI devolve imediatamente, sem depender de manter o
> processo vivo. (O `redeploy` não aceita `--yes`; a lista de opções válidas
> termina em `--no-wait`, `--non-interactive`, `--target`.)

> **Dois projetos com o mesmo nome-base.** `dashboardestufaiot.vercel.app`
> responde noutra conta (a do colega de TCC) e o firmware apontava para lá. Este
> deploy ficou em `dashboardestufaiot-omega.vercel.app` e o firmware foi movido
> para esse host — **ambos os lados têm de apontar para o mesmo projeto**, senão
> o painel enfileira num lado e o poll vai buscar ao outro (o sintoma volta a ser
> "202 no painel, relé parado", sem nenhum erro em sítio nenhum).

| Elo | Verificação |
|---|---|
| Vercel env | `REDIS_URL` (Upstash REST, com `?_token=`) presente — sem ela o `POST /api/control` responde `502 redis_unavailable` |
| Vercel env | `DEVICE_TOKEN` presente — sem ela o `GET /pending` responde `401` (fail-closed) |
| Firmware | `include/secrets.h` criado e `API_VERCEL_TOKEN` = **uso o mesmo valor** de `DEVICE_TOKEN` |
| Firmware | build sem o `#warning` acima; serial com `[VERCEL] Poll de comandos ativo (fila OK).` |
| Local (LAN) | `server.js` na mesma rede do Mosquitto: `LOCAL_MQTT_BROKER` correto e `mqtt_broker_conectado` no log |
