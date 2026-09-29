/**
 * Estufa 01 — Fila de comandos em Upstash Redis (ADR-0008)
 *
 * PORQUÊ SUBSTITUIR O ControlCommand DO MONGODB (não é "usar a moda"):
 *
 * 1. CORRIDA ATÓMICA. A versão anterior fazia `find()` e depois
 *    `updateMany({status:'pending'})` — duas operações separadas. Entre as
 *    duas, um segundo poll (ou um retry do ESP32) podia ler os MESMOS
 *    comandos e o dispositivo executá-los duas vezes. `LPOP chave N` é uma
 *    única operação atómica: quem popou, tirou. Elimina a janela (§12.2).
 *
 * 2. CUSTO POR POLL. Um poll com a fila vazia passa a custar **1 comando**
 *    (o `LPOP`), contra 2+ queries do Mongo. O plano grátis do Upstash é
 *    contado em comandos, e o poll é a operação mais frequente do sistema
 *    (8640/dia com `POLL_COMANDO_MS = 10000`) — a diferença é o que cabe no
 *    plano grátis. Ver a tabela no ADR-0008.
 *
 * 3. BOLKHEAD (§11.3). O caminho crítico dos atuadores deixa de depender do
 *    MongoDB Atlas: uma falha do Atlas deixa de bloquear o controlo da estufa.
 *
 * O QUE CONTINUA NO MONGODB: `User` e `AccessLog`. Não por preferência
 * estética, mas porque `populate()`, unicidade de username/e-mail,
 * `countDocuments()` e logs paginados com filtro não têm equivalente barato
 * em Redis (ENGENHARIA §2).
 *
 * ── Retenção (§9.5) ────────────────────────────────────────────────────────
 * O TTL index do Mongo apagava cada documento 5 min após a sua criação. Num
 * LIST não há TTL por elemento, portanto a validade é transportada DENTRO do
 * payload (`expires_at`) e verificada no pop — mesma semântica exata.
 * O `EXPIRE` na chave é apenas uma rede de segurança: se o dispositivo ficar
 * dias offline, a chave inteira some em vez de acumular comandos mortos.
 *
 * ── O token do Upstash NUNCA vai para o firmware ───────────────────────────
 * O ESP32 conhece apenas `DEVICE_TOKEN` e o endpoint público da Vercel. O
 * token vive dentro de `REDIS_URL`, apenas no ambiente da Vercel.
 */
'use strict';

const crypto = require('crypto');
const { Redis } = require('@upstash/redis');

const { getRedisConfig } = require('./config');
const { logger } = require('./logger');

/** Mesma validade do antigo TTL index: comando nunca recolhido morre aos 5 min. */
const COMMAND_TTL_MS = 5 * 60 * 1000;
const COMMAND_TTL_SEGUNDOS = Math.floor(COMMAND_TTL_MS / 1000);

const FILA_PREFIX = 'estufa:comandos:';

// Singleton para serverless: reusar a ligação evita novo TLS por cold start.
let cached = null;

function getRedis() {
  if (!cached) {
    const { url, token } = getRedisConfig();   // fail-fast (lib/config.js)
    cached = new Redis({ url, token });
  }
  return cached;
}

/** Chave por dispositivo: a fila não é partilhada entre estufas. */
function chaveFila(deviceId) {
  return `${FILA_PREFIX}${deviceId || 'estufa01'}`;
}

/**
 * Filtro de validade — função PURA, extraída para ser testável sem Redis
 * (é a substituta directa do TTL index que o Mongo fazia sozinho).
 * @param {Array<object>} itens comandos recém-extraídos da fila
 * @param {number} agoraMs timestamp actual em epoch ms
 * @returns {{ validos: object[], expirados: number }}
 */
function separarValidos(itens, agoraMs) {
  const validos = [];
  let expirados = 0;
  // Defensivo: `LPOP` pode devolver `null` (fila vazia) e nunca queremos
  // que um `undefined` aqui derrube o poll inteiro.
  for (const item of itens || []) {
    // Sem `expires_at` (fila escrita por versão anterior do código) => válido.
    if (item && typeof item.expires_at === 'number' && item.expires_at <= agoraMs) {
      expirados += 1;
    } else {
      validos.push(item);
    }
  }
  return { validos, expirados };
}

/**
 * Colapsa comandos do MESMO atuador, mantendo apenas o mais recente.
 *
 * Os comandos são **definidores de estado** (idempotentes: `on`, `off`,
 * `duty=40`), não incrementos. Se o admin clica três vezes no painel
 * (`off` → `on` → `off`) antes de o ESP32 fazer o poll, aplicar os três é
 * escrita de relé que o resultado final não pede — e, pior, com `LPUSH` +
 * `LPOP` a saída é LIFO (o mais novo sai primeiro), portanto a aplicação
 * sequencial terminaria no **mais antigo** (`on`, que o admin já contrariou).
 * Colapsar por atuador preservando o `created_at` mais alto resolve as duas
 * coisas: menos escrita no dispositivo e estado final igual à última intenção
 * de quem clicou.
 *
 * Função PURA (testável sem Redis). Não toca em comandos de atuadores
 * diferentes, não conta para `expirados` e devolve `colapsados` para o log.
 *
 * @param {Array<object>} comandos comandos já filtrados quanto à validade
 * @returns {{ comandos: object[], colapsados: number }}
 */
function colapsarPorAtuador(comandos) {
  const ultimoPorAtuador = new Map();
  const semAtuador = [];
  let colapsados = 0;

  for (const cmd of comandos || []) {
    const atuador = cmd?.actuator;
    // Sem atuador identificável não há como colapsar: passa tal e qual, em vez
    // de ser silenciosamente descartado (defensivo com filas antigas).
    if (atuador === undefined || atuador === null) {
      semAtuador.push(cmd);
      continue;
    }

    const anterior = ultimoPorAtuador.get(atuador);
    if (anterior === undefined) {
      ultimoPorAtuador.set(atuador, cmd);
      continue;
    }

    colapsados += 1;
    // `>` e não `>=`: em empate de timestamp fica o primeiro visto, que com
    // LPUSH+LPOP (LIFO) é o que foi enfileirado mais recentemente.
    if (Number(cmd.created_at) > Number(anterior.created_at)) {
      ultimoPorAtuador.set(atuador, cmd);
    }
  }

  return { comandos: [...ultimoPorAtuador.values(), ...semAtuador], colapsados };
}

/**
 * Enfileira um comando (caminho do painel, POST /api/control).
 *
 * @returns {Promise<object>} o comando tal como foi gravado (com `id` e `expires_at`)
 */
async function enfileirarComando({ device, actuator, action, payload, username, userId }) {
  const agora = Date.now();
  const comando = {
    id: crypto.randomUUID(),
    device,
    actuator,
    action: String(action),
    payload,
    username: username || null,
    user_id: userId || null,
    created_at: agora,
    expires_at: agora + COMMAND_TTL_MS,
  };

  const redis = getRedis();
  const chave = chaveFila(device);

  // Pipeline: `LPUSH` + `EXPIRE` numa única ida ao Upstash (2 comandos, 1 round
  // trip). A documentação de billing do Upstash é explícita — "each command
  // inside a pipeline ... is still billed individually" — portanto o ganho é
  // de LATÊNCIA no caminho crítico do POST /api/control, não de contagem.
  // Não se usa `multi()` (transação) de propósito: não há nada a tornar atómico
  // entre os dois comandos (o pior caso é a chave ficar sem TTL, que é apenas a
  // rede de segurança) e MULTI/EXEC é superfície a mais para o mesmo efeito.
  //
  // Rede de segurança (ver cabeçalho): repor o TTL a cada escrita é correto —
  // um comando novo mantém a chave viva mais 5 min, e os antigos já foram
  // descartados no pop.
  await redis
    .pipeline()
    .lpush(chave, JSON.stringify(comando))
    .expire(chave, COMMAND_TTL_SEGUNDOS)
    .exec();

  return comando;
}

/**
 * Recolhe comandos para entrega (caminho do dispositivo, GET /api/control/pending).
 *
 * `LPOP chave N` é atómico — não existe o `find` seguido de `updateMany`, logo
 * dois polls concorrentes nunca recebem o mesmo comando. Entrega at-most-once
 * (§11.1): se o ESP32 recolher e cair antes de executar, o comando perde-se.
 * Aceitável porque os comandos são **idempotentes** (definem estado, não
 * incrementam) — reenviar seria inofensivo.
 *
 * @param {string} device
 * @param {number} limite máximo de comandos a retirar num poll
 * @returns {Promise<{ comandos: object[], expirados: number, colapsados: number }>}
 */
async function retirarComandos(device, limite) {
  const redis = getRedis();
  const brutos = await redis.lpop(chaveFila(device), limite);

  // `LPOP` devolve `null` em chave inexistente (fila vazia = 1 comando, o caso
  // comum) e um array quando há `count`. Normalizamos ambos.
  const itens = Array.isArray(brutos) ? brutos : brutos ? [brutos] : [];

  const { validos, expirados } = separarValidos(itens, Date.now());

  const comandos = [];
  for (const bruto of validos) {
    try {
      comandos.push(typeof bruto === 'string' ? JSON.parse(bruto) : bruto);
    } catch (err) {
      // Payload corrompido: descartamos e seguimos — um comando ilegível
      // não pode travar o poll e deixar os restantes comandos presos.
      logger.warn('comando_ilegivel_descartado', { error: err?.message || String(err) });
    }
  }

  // Colapso por atuador só depois de o payload ser legível: o descarte acima
  // mexe na lista, e o colapso compara `created_at` — ver `colapsarPorAtuador`.
  const { comandos: comandosColapsados, colapsados } = colapsarPorAtuador(comandos);

  return { comandos: comandosColapsados, expirados, colapsados };
}

module.exports = {
  COMMAND_TTL_MS,
  chaveFila,
  separarValidos,
  colapsarPorAtuador,
  enfileirarComando,
  retirarComandos,
};