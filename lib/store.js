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
  await redis.lpush(chave, JSON.stringify(comando));
  // Rede de segurança (ver cabeçalho). Repor o TTL a cada escrita é correto:
  // um comando novo mantém a chave viva mais 5 min, e os antigos já foram
  // descartados no pop.
  await redis.expire(chave, COMMAND_TTL_SEGUNDOS);

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
 * @returns {Promise<{ comandos: object[], expirados: number }>}
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

  return { comandos, expirados };
}

module.exports = {
  COMMAND_TTL_MS,
  chaveFila,
  separarValidos,
  enfileirarComando,
  retirarComandos,
};