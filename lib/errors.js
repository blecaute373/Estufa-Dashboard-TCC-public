/**
 * Estufa 01 — Erros de API padronizados (ENGENHARIA §11.1 / §13.3)
 *
 * Formato inspirado em RFC 9457 Problem Details: corpo de erro estruturado
 * e consistente. O detalhe exposto ao cliente é sempre genérico e seguro;
 * o detalhe interno vai apenas para o log estruturado com `requestId`.
 */
'use strict';

const { logger } = require('./logger');

/** Mapa de erros de domínio → status HTTP + título público e seguro. */
const ERROR_CATALOG = {
  VALIDATION: { status: 400, title: 'Pedido inválido' },
  UNAUTHENTICATED: { status: 401, title: 'Não autenticado' },
  SESSION_EXPIRED: { status: 401, title: 'Sessão expirada' },
  FORBIDDEN: { status: 403, title: 'Acesso restrito' },
  NOT_FOUND: { status: 404, title: 'Não encontrado' },
  CONFLICT: { status: 409, title: 'Conflito' },
  RATE_LIMITED: { status: 429, title: 'Muitas tentativas' },
  UPSTREAM: { status: 502, title: 'Falha em serviço externo' },
  INTERNAL: { status: 500, title: 'Erro interno' },
};

function problem({ code, detail, requestId, statusOverride }) {
  const entry = ERROR_CATALOG[code] || ERROR_CATALOG.INTERNAL;
  return {
    status: statusOverride || entry.status,
    body: {
      type: `https://estufa.local/problemas/${String(code || 'INTERNAL').toLowerCase()}`,
      title: entry.title,
      status: statusOverride || entry.status,
      detail: detail || entry.title,
      ...(requestId ? { requestId } : {}),
    },
  };
}

/**
 * Envia erro público + log interno completo.
 * `internal` nunca é exposto ao cliente.
 */
function sendProblem(req, res, code, publicDetail, internal) {
  const requestId = req?.requestId || null;
  if (internal) {
    const message = internal instanceof Error ? internal.message : String(internal);
    const stack = internal instanceof Error ? internal.stack : undefined;
    logger.error('request_error', { code, requestId, message, ...(stack ? { stack } : {}) });
  }
  const { status, body } = problem({ code, detail: publicDetail, requestId });
  return res.status(status).json(body);
}

module.exports = { ERROR_CATALOG, problem, sendProblem };
