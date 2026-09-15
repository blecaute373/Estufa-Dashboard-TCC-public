/**
 * Estufa 01 — Middlewares transversais (ENGENHARIA §9 / §11.2 / §13.3)
 *
 * - `requestId`: correlação suporte ↔ log (o cliente recebe um id seguro,
 *   o detalhe interno fica só no log).
 * - `authLimiter` / `strictLimiter`: rate limiting igual em dev e prod.
 */
'use strict';

const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { problem } = require('./errors');

function requestId(req, res, next) {
  const id = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
  req.requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
}

function rateLimitProblemHandler(req, res) {
  const { status, body } = problem({
    code: 'RATE_LIMITED',
    detail: 'Muitas tentativas. Aguarde 15 minutos.',
    requestId: req?.requestId || null,
  });
  res.status(status).json(body);
}

/** Login/registo: 20 tentativas / 15 min por IP (igual em dev e Vercel). */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitProblemHandler,
});

/** Operações sensíveis (bootstrap admin): 5 tentativas / 15 min por IP. */
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitProblemHandler,
});

module.exports = { requestId, authLimiter, strictLimiter };
