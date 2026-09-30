/**
 * Estufa 01 — Ligação entre o logger estruturado e o registo de sistema
 * (ENGENHARIA §10.1)
 *
 * O `lib/logger.js` já sabia registar eventos (auth, erros, control), mas
 * escrevia-os apenas em stdout. Esta função instala um **sink** que os replica
 * para o `lib/syslog.js` — que por sua vez os persiste no Mongo.
 *
 * É o único ponto do projeto que conhece as duas metades. Qualquer outro
 * módulo limita-se a chamar `logger.info(...)` como já fazia, sem mudar uma
 * linha (regra dos três justificou a abstração; a dependência fica explícita).
 *
 * `MONGODB_LOG_ENABLED=false` desliga a persistência mantendo o log em memória
 * e em stdout — útil em desenvolvimento e como kill-switch em incidente.
 */
'use strict';

const { logger, attachSink } = require('./logger');
const { sysLog, setPersister } = require('./syslog');

/** Converte o evento do logger num registo de sistema. */
function toSystemRecord(level, event, fields = {}) {
  // O `event` é o nome estruturado (ex.: 'auth_login', 'request_error') e vai
  // na `tag`: é ele que permite filtrar sem fazer parsing de texto livre (§10.1).
  //
  // `requestId` é preservado no `data` porque é a chave de correlação entre o
  // erro que o utilizador viu e o log que o suporte lê (§16.3) — descartá-lo
  // deixaria os erros internos órfãos.
  const temCampos = Object.keys(fields).length > 0;
  return {
    source: 'server',
    level,
    tag: event,
    message: describe(event, fields),
    data: temCampos ? { ...fields, requestId: fields.requestId ?? null } : null,
  };
}

/** Texto legível sem perder o nome do evento. */
function describe(event, fields) {
  const chaves = Object.keys(fields);
  if (chaves.length === 0) return event;
  return `${event} ${chaves.map((k) => `${k}=${formatValue(fields[k])}`).join(' ')}`;
}

function formatValue(value) {
  if (value === null || value === undefined) return String(value);
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '[unserializable]';
    }
  }
  return String(value);
}

/** Guarda de instalação: impede que a ponte seja ligada duas vezes (§3, DRY). */
let installed = false;

/**
 * Instala a ponte logger → SystemLog. **Idempotente**: chamar várias vezes não
 * duplica os registos.
 *
 * A guarda vive aqui, e não em `attachSink`, porque `attachSink` deduplica por
 * referência de função — e cada chamada criaria uma arrow nova, que nunca
 * coincidiria com a anterior. Em Vercel, onde `api/index.js` monta `authApp` e
 * `adminApp` (ambos com logging), isso significava cada evento de autenticação
 * gravado duas vezes na base.
 *
 * @param {object} [deps]
 * @param {Function} [deps.create] - função de escrita (injetada pelo adaptador)
 * @param {boolean} [deps.mirrorConsole] - espelha também no terminal
 * @param {boolean} [deps.force] - liga mesmo com MONGODB_LOG_ENABLED=false
 * @returns {boolean} true se a ponte ficou activa
 */
function attachSystemLog({ create, mirrorConsole = false, force = false } = {}) {
  if (force !== true && String(process.env.MONGODB_LOG_ENABLED).toLowerCase() === 'false') {
    logger.warn('system_log_desativado', { motivo: 'MONGODB_LOG_ENABLED=false' });
    return false;
  }

  if (installed) return true;

  if (typeof create === 'function') {
    setPersister((record) => create(record));
  }
  if (mirrorConsole) {
    // O stdout já recebe o log via `logger.*`; o espelho serve para tornar
    // visível o que o ESP/ThingSpeak registam, que não passam pelo logger.
    require('./syslog').setConsoleMirror(true);
  }
  attachSink(sink);
  installed = true;

  logger.info('system_log_ligado', {});
  return true;
}

/** Sink com referência estável — requirement para a deduplicação do `attachSink`. */
function sink(level, event, fields) {
  sysLog(toSystemRecord(level, event, fields));
}

/** Só para testes: repor o estado de instalação da ponte. */
function _resetBridge() {
  installed = false;
}

module.exports = { attachSystemLog, toSystemRecord, _resetBridge };