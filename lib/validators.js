/**
 * Estufa 01 — Validadores de input partilhados (ENGENHARIA §3 / §8.2)
 *
 * Fonte única de verdade para regras de registo/login. Antes esta lógica
 * estava duplicada em `server.js` e `api/auth.js` (violação de DRY após a
 * terceira ocorrência — regra dos três).
 */
'use strict';

const USERNAME_RE = /^[a-zA-Z0-9_]{3,30}$/;
// Validação pragmática de e-mail no servidor (não tenta ser RFC completa).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LEN = 8;

/** Normaliza identificador de login (username ou e-mail). */
function normalizeLogin(value) {
  return String(value || '').trim().toLowerCase();
}

function validateUsername(username) {
  if (!username) return 'Preencha todos os campos.';
  if (!USERNAME_RE.test(username)) return 'Usuário: 3–30 caracteres (letras, números, _).';
  return null;
}

function validateEmail(email) {
  if (!email) return 'Preencha todos os campos.';
  if (!EMAIL_RE.test(email)) return 'E-mail inválido.';
  return null;
}

function validatePassword(password) {
  if (!password) return 'Preencha todos os campos.';
  if (password.length < MIN_PASSWORD_LEN) return 'Senha mínima: 8 caracteres.';
  return null;
}

function validateRegister({ username, email, password }) {
  return (
    validateUsername(username) ||
    validateEmail(email) ||
    validatePassword(password) ||
    null
  );
}

/** Paginação defensiva: `limit` limitado, `offset` nunca negativo. */
function parsePagination(query, { defaultLimit = 100, maxLimit = 500 } = {}) {
  const rawLimit = Number.parseInt(query?.limit, 10);
  const rawOffset = Number.parseInt(query?.offset, 10);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), maxLimit) : defaultLimit;
  const offset = Number.isFinite(rawOffset) ? Math.max(rawOffset, 0) : 0;
  return { limit, offset };
}

/** `results` do ThingSpeak: inteiro limitado para evitar abuso. */
function parseResults(query, { defaultValue = 60, maxValue = 800 } = {}) {
  const raw = Number.parseInt(query?.results, 10);
  if (!Number.isFinite(raw)) return defaultValue;
  return Math.min(Math.max(raw, 1), maxValue);
}

module.exports = {
  USERNAME_RE,
  EMAIL_RE,
  MIN_PASSWORD_LEN,
  normalizeLogin,
  validateUsername,
  validateEmail,
  validatePassword,
  validateRegister,
  parsePagination,
  parseResults,
};
