/**
 * Estufa 01 — Registo técnico de sistema (ENGENHARIA §10.1 / §10.3)
 *
 * Dois destinos, com responsabilidades distintas:
 *
 *  1. **Memória** (ring buffer, 500 entradas): imediata, funciona mesmo sem
 *     Mongo ligado e sem rede — alimenta o card de saúde do painel.
 *  2. **Mongo** (`SystemLog`), via um *persister injetado* (`setPersister`).
 *     A biblioteca não importa Mongoose: a dependência é do adaptador
 *     (portas e adaptadores, §4.3), o que mantém isto testável sem base de
 *     dados e impede que uma falha de log alguma vez derrube um request.
 *
 * Nomenclatura (vinculante, BLUEPRINT §13.1): este módulo é o **persistidor**
 * — recebe e guarda. Quem entrega eventos a este módulo é o **sink** do
 * `lib/logger.js` (`logger.attachSink`), que só redireciona. São papéis
 * distintos e por isso nomes distintos.
 *
 * Nunca lança: um log que parte o sistema é pior do que um log perdido.
 */
'use strict';

const MAX_RING = 500;
const MAX_MESSAGE = 2000;
const MAX_TAG = 60;
const MAX_DATA = 2000;

/**
 * Conjuntos canónicos de `source` e `level`.
 *
 * Vivem AQUI, e não no model, por inversão de dependência: `lib/` não conhece
 * Mongoose (§4.3), por isso é esta camada que dita o domínio. `models/SystemLog.js`
 * importa estas listas. Duplicá-las permitiria que um valor novo fosse aceite
 * pelo schema e rejeitado em silêncio pelo `normalize()` — falha invisível.
 */
const SOURCES = ['esp', 'server', 'thingspeak', 'mqtt'];
const LEVELS = ['info', 'warn', 'error'];

const DEFAULT_SOURCE = 'server';
const DEFAULT_LEVEL = 'info';

/** Mais recente primeiro. */
let ring = [];
let persister = null;
let consoleMirror = false;
let espStatus = null;

/** Valores inválidos já reportados — evita inundar o terminal em laço. */
const warned = new Set();

function warnOnce(key, message) {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(`[syslog] ${message}`);
}

function setPersister(fn) {
  persister = typeof fn === 'function' ? fn : null;
}

function setConsoleMirror(enabled) {
  consoleMirror = Boolean(enabled);
}

function str(value, max) {
  if (value === null || value === undefined) return null;
  const s = String(value);
  return s.length > max ? s.slice(0, max) + '…' : s;
}

/** Serializa `data` com fallback — um objeto com ciclo não pode partir o log. */
function serializeData(data) {
  if (data === null || data === undefined) return null;
  if (typeof data === 'string') return str(data, MAX_DATA);
  try {
    return str(JSON.stringify(data), MAX_DATA);
  } catch {
    return JSON.stringify({ unserializable: true });
  }
}

/**
 * Valida e normaliza uma entrada.
 *
 * Nunca lança (§16.2 — um log que parte o sistema é pior que um log perdido),
 * mas um valor inválido é **reportado** em vez de corrigido em silêncio: sem
 * isto, um `source` novo rejeitado aqui apareceria como 'server' no painel e
 * ninguém perceberia de onde veio.
 */
function normalize(entry) {
  const src = entry || {};

  if (src.source !== undefined && !SOURCES.includes(src.source)) {
    warnOnce(`source:${src.source}`, `source inválido "${src.source}" — guardado como "${DEFAULT_SOURCE}".`);
  }
  if (src.level !== undefined && !LEVELS.includes(src.level)) {
    warnOnce(`level:${src.level}`, `level inválido "${src.level}" — guardado como "${DEFAULT_LEVEL}".`);
  }

  return Object.freeze({
    // `created_at` = hora do EVENTO. O Mongoose preenche `createdAt` na escrita,
    // o que perde a hora real quando o registo chega com atraso (ex.: via MQTT
    // após queda de rede) — num log de diagnóstico, "quando" é metade do valor.
    created_at: new Date().toISOString(),
    source: SOURCES.includes(src.source) ? src.source : DEFAULT_SOURCE,
    level: LEVELS.includes(src.level) ? src.level : DEFAULT_LEVEL,
    tag: str(src.tag, MAX_TAG),
    message: str(src.message, MAX_MESSAGE) || '',
    data: serializeData(src.data),
  });
}

/**
 * Regista um evento de sistema.
 * @returns {object} o registo normalizado (mesmo que a persistência falhe).
 */
function sysLog({ source, level, tag, message, data } = {}) {
  const record = normalize({ source, level, tag, message, data });

  ring.push(record);
  if (ring.length > MAX_RING) ring.shift();

  if (consoleMirror) {
    const line = `[${record.created_at}] ${record.level.toUpperCase()} ${record.source}${record.tag ? `/${record.tag}` : ''} ${record.message}`;
    if (record.level === 'error') console.error(line);
    else if (record.level === 'warn') console.warn(line);
    else console.log(line);
  }

  if (persister) {
    try {
      // Fire-and-forget: o adapter pode devolver Promise, mas o resultado é
      // deliberadamente ignorado — nenhuma rota espera pela escrita de log.
      Promise.resolve(persister(record)).catch(() => {});
    } catch {
      /* persister_partiu — o registo continua disponível em memória */
    }
  }

  return record;
}

/**
 * Últimos registos, mais recentes primeiro.
 * O ring buffer insere no fim, por isso percorre de trás para a frente — a
 * ordem importa: o painel mostra os 100 mais recentes, não os 100 mais antigos.
 * Filtros inválidos são ignorados (não rejeitam a leitura).
 */
function getRecent({ source, level, q, limit = 100 } = {}) {
  const n = Math.min(Math.max(Number.parseInt(limit, 10) || 100, 1), MAX_RING);
  const term = typeof q === 'string' ? q.trim().toLowerCase() : '';
  const out = [];

  for (let i = ring.length - 1; i >= 0 && out.length < n; i -= 1) {
    const r = ring[i];
    if (source && r.source !== source) continue;
    if (level && r.level !== level) continue;
    if (term) {
      const hit =
        r.message.toLowerCase().includes(term) ||
        String(r.tag || '').toLowerCase().includes(term);
      if (!hit) continue;
    }
    out.push(r);
  }

  return out;
}

/**
 * Congela recursivamente um objecto JSON.
 *
 * `Object.freeze` sozinho é RASO: congelar `{ sistema: {...} }` não impede
 * `x.sistema.uptime_s = 999`. Num estado partilhado e lido por várias rotas
 * isso é exactamente o tipo de bug silencioso que custa horas (§12.2), por isso
 * aqui a garantia é de profundidade.
 *
 * Usa `structuredClone` quando disponível (Node 17+) para não partilhar
 * referências com o payload de origem; em fallback, percorre as próprias chaves.
 */
function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;

  if (typeof structuredClone === 'function') {
    // Clona (corta referências com a origem) e depois congela em profundidade.
    return freezeInPlace(structuredClone(value));
  }

  // Fallback: congela cada chave já existente, sem criar cópias.
  return freezeInPlace(value);
}

function freezeInPlace(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const key of Object.keys(value)) freezeInPlace(value[key]);
  return Object.freeze(value);
}

/**
 * Último `master/status` recebido do ESP (dados voláteis, ficam em memória).
 *
 * Congelado em profundidade pela mesma razão dos registos: `getEspStatus()` é
 * lido por código que não o deve poder alterar (e no Marco 4 é serializado
 * para JSON) — e um freeze raso daria uma garantia falsa.
 */
function setEspStatus(payload) {
  if (!payload || typeof payload !== 'object') {
    espStatus = null;
    return espStatus;
  }
  // `received_at` é nosso (o ESP não o envia) e sobrevive ao deepFreeze porque
  // é escrito antes de congelar.
  espStatus = deepFreeze({ ...payload, received_at: new Date().toISOString() });
  return espStatus;
}

function getEspStatus() {
  return espStatus;
}

function getRingSize() {
  return ring.length;
}

/** Só para testes — limpa o estado entre casos. */
function _reset() {
  ring = [];
  espStatus = null;
  persister = null;
  consoleMirror = false;
  warned.clear();
}

module.exports = {
  MAX_RING,
  SOURCES,
  LEVELS,
  setPersister,
  setConsoleMirror,
  sysLog,
  getRecent,
  setEspStatus,
  getEspStatus,
  getRingSize,
  _reset,
};