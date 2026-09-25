/**
 * Estufa 01 — Configuração centralizada (Twelve-Factor, ENGENHARIA §14)
 *
 * Toda a configuração vem de variáveis de ambiente, nunca hardcoded.
 * - JWT_SECRET faz fail-fast em produção (nunca segredo volátil em serverless).
 * - Em desenvolvimento, usa fallback efémero apenas para não travar o `npm start`.
 */
'use strict';

try {
  require('dotenv').config();
} catch {
  /* dotenv opcional — em produção as vars vêm do ambiente (Vercel) */
}

const crypto = require('crypto');

const NODE_ENV = process.env.NODE_ENV || (process.env.VERCEL ? 'production' : 'development');
const isProduction = NODE_ENV === 'production' || Boolean(process.env.VERCEL);

let devFallbackWarned = false;

function resolveJwtSecret() {
  const raw = process.env.JWT_SECRET;
  if (raw && raw.trim() !== '') return raw;
  if (isProduction) {
    throw new Error(
      '[config] JWT_SECRET não definida. Defina JWT_SECRET nas variáveis de ambiente de produção.'
    );
  }
  if (!devFallbackWarned) {
    console.warn(
      '[config] JWT_SECRET ausente — a usar segredo efémero (apenas desenvolvimento). ' +
        'Tokens serão invalidados ao reiniciar.'
    );
    devFallbackWarned = true;
  }
  return crypto.randomBytes(64).toString('hex');
}

const PORT = Number.parseInt(process.env.PORT, 10) || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/estufa';
const BCRYPT_ROUNDS = 12;
const JWT_EXPIRES = '8h';
const COOKIE_NAME = 'estufa_tok';

const TS_CHANNEL = Number.parseInt(process.env.TS_CHANNEL, 10);
const TS_API_KEY = process.env.TS_API_KEY || '';
const isThingSpeakConfigured = Number.isFinite(TS_CHANNEL);

/** URI do MongoDB — falha explícita em produção se não configurada (fail-fast, §13.1). */
function getMongoUri() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    if (isProduction) {
      throw new Error('[config] MONGODB_URI não definida nas variáveis de ambiente de produção.');
    }
    return 'mongodb://localhost:27017/estufa';
  }
  return uri;
}

/**
 * Credenciais do Upstash Redis (fila de comandos, ADR-0008).
 *
 * `fail-fast` deliberado e SEM fallback: as duas variáveis têm de existir
 * ambas. Uma delas em falta produziria um `new Redis({url: null})` que só
 * rebentaria no primeiro poll real, em produção, com 500 no caminho crítico
 * dos atuadores. Melhor rebentar aqui, com mensagem explícita.
 *
 * O token NUNCA é exposto ao firmware: o ESP32 só conhece `DEVICE_TOKEN`.
 */
function getRedisConfig() {
  const url = (process.env.UPSTASH_REDIS_REST_URL || '').trim();
  const token = (process.env.UPSTASH_REDIS_REST_TOKEN || '').trim();
  if (!url || !token) {
    throw new Error(
      isProduction
        ? '[config] UPSTASH_REDIS_REST_URL e/ou UPSTASH_REDIS_REST_TOKEN não definidas. ' +
          'A fila de comandos na Vercel depende delas (ver ADR-0008).'
        : '[config] UPSTASH_REDIS_REST_URL e/ou UPSTASH_REDIS_REST_TOKEN ausentes. ' +
          'A fila de comandos na nuvem não funciona (caminho local usa MQTT).'
    );
  }
  return { url, token };
}

const JWT_SECRET = resolveJwtSecret();

module.exports = {
  NODE_ENV,
  isProduction,
  PORT,
  MONGODB_URI,
  getMongoUri,
  getRedisConfig,
  JWT_SECRET,
  BCRYPT_ROUNDS,
  JWT_EXPIRES,
  COOKIE_NAME,
  TS_CHANNEL,
  TS_API_KEY,
  isThingSpeakConfigured,
};
