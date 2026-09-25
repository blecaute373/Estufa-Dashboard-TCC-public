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
3. **`api/control.js`** — `POST` faz `LPUSH`+`EXPIRE` e responde `202`; `GET /pending` faz `LPOP` e **já não chama `connectDB()`**.
4. **Auditoria best-effort (§13):** o comando entra na fila **antes** de a auditoria correr, e a falha do `AccessLog` é só registada em log. Uma falha do Atlas **não bloqueia o controlo da estufa** (bolkhead §11.3) — era o contrário antes, quando `connectDB()` precedia o `create()`.
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
