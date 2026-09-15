/**
 * Estufa 01 — Autenticação partilhada (ENGENHARIA §3 / §8.2)
 *
 * Fonte única para JWT + cookies + middlewares. Elimina a divergência
 * entre `server.js` (dev) e `api/*` (Vercel) que permitia a qualquer
 * utilizador autenticado aceder às rotas admin em desenvolvimento.
 */
'use strict';

const jwt = require('jsonwebtoken');
const { JWT_SECRET, JWT_EXPIRES, COOKIE_NAME } = require('./config');
const { sendProblem } = require('./errors');

function signToken(user) {
  return jwt.sign(
    { id: user._id, username: user.username, is_admin: Boolean(user.is_admin) },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000,
    ...(process.env.NODE_ENV === 'production' || process.env.VERCEL ? { secure: true } : {}),
  });
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME);
}

function extractToken(req) {
  return req.cookies?.[COOKIE_NAME] || req.headers?.authorization?.replace('Bearer ', '') || null;
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

/** API: exige login. Responde 401 JSON (nunca redirect). */
function requireAuthApi(req, res, next) {
  const token = extractToken(req);
  if (!token) return sendProblem(req, res, 'UNAUTHENTICATED', 'Não autenticado.');
  try {
    req.user = verifyToken(token);
    return next();
  } catch {
    return sendProblem(req, res, 'SESSION_EXPIRED', 'Sessão expirada. Faça login novamente.');
  }
}

/** API: exige admin. Autorização ANTES da lógica de negócio (§8.2). */
function requireAdminApi(req, res, next) {
  const token = extractToken(req);
  if (!token) return sendProblem(req, res, 'UNAUTHENTICATED', 'Não autenticado.');
  try {
    req.user = verifyToken(token);
    if (!req.user.is_admin) {
      return sendProblem(req, res, 'FORBIDDEN', 'Acesso restrito. Apenas administradores.');
    }
    return next();
  } catch {
    return sendProblem(req, res, 'SESSION_EXPIRED', 'Sessão expirada. Faça login novamente.');
  }
}

/** Páginas: exige login, senão redirect para login. */
function requireAuthPage(redirectTo = '/index.html') {
  return (req, res, next) => {
    const token = extractToken(req);
    if (!token) return res.redirect(redirectTo);
    try {
      req.user = verifyToken(token);
      return next();
    } catch {
      clearAuthCookie(res);
      return res.redirect(redirectTo);
    }
  };
}

/** Páginas: exige admin, senão redirect (não vaza detalhe, §13.3). */
function requireAdminPage(redirectLogin = '/index.html', redirectForbidden = '/dashboard.html?error=restrito') {
  return (req, res, next) => {
    const token = extractToken(req);
    if (!token) return res.redirect(redirectLogin);
    try {
      req.user = verifyToken(token);
      if (!req.user.is_admin) return res.redirect(redirectForbidden);
      return next();
    } catch {
      clearAuthCookie(res);
      return res.redirect(redirectLogin);
    }
  };
}

module.exports = {
  COOKIE_NAME,
  signToken,
  setAuthCookie,
  clearAuthCookie,
  extractToken,
  verifyToken,
  requireAuthApi,
  requireAdminApi,
  requireAuthPage,
  requireAdminPage,
};
