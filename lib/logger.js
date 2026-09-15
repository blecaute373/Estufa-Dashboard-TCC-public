/**
 * Estufa 01 — Logger estruturado mínimo (ENGENHARIA §9.1 / §9.3)
 *
 * Começa-se pelo logging estruturado (campos nomeados, não string
 * interpolada) antes de métricas/traces. A app escreve para stdout;
 * o destino do log é responsabilidade do ambiente (Twelve-Factor).
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

const logger = {
  info(event, fields) {
    console.log(toJson({ level: 'info', event, ...base(fields) }));
  },
  warn(event, fields) {
    console.warn(toJson({ level: 'warn', event, ...base(fields) }));
  },
  error(event, fields) {
    console.error(toJson({ level: 'error', event, ...base(fields) }));
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

module.exports = { logger, clientIp, auditLog };
