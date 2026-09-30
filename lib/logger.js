/**
 * Estufa 01 — Logger estruturado mínimo (ENGENHARIA §10.1 / §10.3)
 *
 * Começa-se pelo logging estruturado (campos nomeados, não string
 * interpolada) antes de métricas/traces. A app escreve para stdout;
 * o destino do log é responsabilidade do ambiente (Twelve-Factor).
 *
 * ## Sink (ponte para persistência)
 *
 * `attachSink` liga este logger ao `lib/syslog.js` para que tudo o que **já é
 * registado hoje** (auth, `sendProblem`, `/api/control`) passe também para a
 * `SystemLog` — sem alterar um único call-site (DRY, §3).
 *
 * Duas garantias, ambas deliberadas:
 *
 *  1. **O stdout não é substituído.** Um sink é um destino *adicional*. Se o
 *     sink quebrar, o operador continua a ver o log no terminal — perder o
 *     stdout seria perder a única saída garantida (Twelve-Factor, §17).
 *  2. **O sink nunca propaga erro nem é aguardado.** `logger.error` é chamado
 *     nos caminhos onde algo JÁ correu mal; se a escrita persistente falhasse
 *     de forma síncrona, um Mongo lento transformaria um erro de negócio num
 *     erro de infraestrutura (o sintoma distante que a §16.1 desaconselha).
 */
'use strict';

function toJson(fields) {
  try {
    return JSON.stringify(fields);
  } catch {
    return JSON.stringify({ message: 'unserializable-log-fields' });
  }
}

function base(fields) {
  return { ts: new Date().toISOString(), ...(fields || {}) };
}

/** Sinks registados — array para permitir mais de um consumidor no futuro. */
const sinks = [];

/**
 * Regista um destino adicional para os eventos deste logger.
 * @param {(level: string, event: string, fields: object) => void} fn
 */
function attachSink(fn) {
  if (typeof fn === 'function' && !sinks.includes(fn)) sinks.push(fn);
}

/** Remove um sink (usado em testes; em produção o sink vive até ao fim do processo). */
function detachSinks() {
  sinks.length = 0;
}

/**
 * Entrega o evento aos sinks. Isolado do resto: um sink que lance não pode
 * impedir os restantes nem a escrita em stdout (defesa em profundidade, §9.2).
 */
function emit(level, event, fields) {
  if (sinks.length === 0) return;
  for (const sink of sinks) {
    try {
      sink(level, event, fields || {});
    } catch {
      /* sink_partiu — o stdout já foi escrito, o log não se perde */
    }
  }
}

const logger = {
  info(event, fields) {
    console.log(toJson({ level: 'info', event, ...base(fields) }));
    emit('info', event, fields);
  },
  warn(event, fields) {
    console.warn(toJson({ level: 'warn', event, ...base(fields) }));
    emit('warn', event, fields);
  },
  error(event, fields) {
    console.error(toJson({ level: 'error', event, ...base(fields) }));
    emit('error', event, fields);
  },
};

/** Extrai IP real atrás de proxy (Vercel/express `trust proxy`). */
function clientIp(req) {
  return (
    req.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

/** Regista evento de auditoria em AccessLog sem nunca quebrar o request (§13). */
async function auditLog(AccessLog, { userId, username, event, req, details }) {
  try {
    await AccessLog.create({
      user_id: userId || null,
      username: username || null,
      event,
      ip_address: req ? clientIp(req) : 'unknown',
      user_agent: req?.headers?.['user-agent'] || 'unknown',
      details: details ? JSON.stringify(details) : null,
    });
  } catch (err) {
    logger.warn('audit_log_failed', { event, error: err?.message || String(err) });
  }
}

module.exports = { logger, attachSink, detachSinks, clientIp, auditLog };
