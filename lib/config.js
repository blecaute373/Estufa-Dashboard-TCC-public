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
 * Extrai `{ url, token }` de uma ÚNICA string `REDIS_URL`.
 *
 * Porque uma variável só: é o que o painel da Upstash/Vercel KV mostra, e é
 * uma variável a menos para alguém errar em produção. O SDK `@upstash/redis`
 * continua a receber os dois campos — a divisão é feita aqui, uma vez.
 *
 * Aceita os formatos que a documentação da Upstash documenta
 * (https://upstash.com/docs/redis/features/restapi):
 *   1. `https://host.upstash.io/?_token=SEU_TOKEN`   (parâmetro `_token`)
 *   2. `https://SEU_TOKEN@host.upstash.io`          (userinfo)
 *   3. `https://default:SEU_TOKEN@host.upstash.io`  (userinfo com password)
 *
 * O token é REMOVIDO do URL devolvido: o SDK envia o próprio cabeçalho
 * `Authorization: Bearer` e não quer encontrá-lo também na query string
 * (ficaria em duplicado e, pior, em logs de URL).
 *
 * @param {string} raw valor cru da variável
 * @returns {{ url: string, token: string }}
 * @throws {Error} com mensagem explícita se o formato nao for reconhecido
 */
function parseRedisUrl(raw) {
  const valor = String(raw || '').trim();
  if (!valor) {
    throw new Error(
      isProduction
        ? '[config] REDIS_URL não definida. A fila de comandos na Vercel depende dela (ADR-0008).'
        : '[config] REDIS_URL ausente. A fila de comandos na nuvem não funciona (o caminho local usa MQTT).'
    );
  }

  // `rediss://`/`redis://` e o URL de TCP (ioredis/node-redis), nao o REST.
  // Dizer isso explicitamente evita a confusao de um "token nao encontrado"
  // quando o problema real e o esquema.
  if (/^rediss?:\/\//i.test(valor)) {
    throw new Error(
      '[config] REDIS_URL parece um URL de TCP (redis:// ou rediss://). ' +
        'Use o endpoint REST HTTPS da Upstash (o que começa por https://).'
    );
  }

  let u;
  try {
    u = new URL(valor);
  } catch {
    throw new Error('[config] REDIS_URL inválida. Formatos aceites: https://host.upstash.io/?_token=SEU_TOKEN');
  }

  // Ordem de prioridade deliberada:
  //  1. `?_token=` / `?token=` — o formato REST documentado pela Upstash;
  //  2. `password` ANTES de `username`: em `https://default:TOKEN@host` o
  //     username é a palavra "default" e o token é a password. Preferir o
  //     username devolveria literalmente a string "default" como token;
  //  3. `username` — para `https://TOKEN@host`, onde não há password.
  const token =
    u.searchParams.get('_token') ||
    u.searchParams.get('token') ||
    (u.password ? decodeURIComponent(u.password) : '') ||
    (u.username ? decodeURIComponent(u.username) : '');

  if (!token) {
    throw new Error(
      '[config] REDIS_URL sem token. Acrescente-o como ?_token=SEU_TOKEN ' +
        '(ou https://SEU_TOKEN@host.upstash.io). O token NUNCA vai para o firmware.'
    );
  }

  // Limpa o token do URL — o SDK trata da autenticacao.
  u.searchParams.delete('_token');
  u.searchParams.delete('token');
  u.username = '';
  u.password = '';

  return { url: u.toString().replace(/\/+$/, ''), token };
}

/**
 * Credenciais do Upstash Redis (fila de comandos, ADR-0008).
 *
 * `fail-fast` deliberado e SEM fallback: sem `REDIS_URL` a fila não funciona,
 * e um token mal extraído só rebentaria no primeiro poll real, em produção,
 * com 500 no caminho crítico dos atuadores. Melhor rebentar aqui, com
 * mensagem explícita.
 *
 * O token NUNCA é exposto ao firmware: o ESP32 só conhece `DEVICE_TOKEN`.
 */
function getRedisConfig() {
  return parseRedisUrl(process.env.REDIS_URL);
}

const JWT_SECRET = resolveJwtSecret();

module.exports = {
  NODE_ENV,
  isProduction,
  PORT,
  MONGODB_URI,
  getMongoUri,
  getRedisConfig,
  parseRedisUrl,
  JWT_SECRET,
  BCRYPT_ROUNDS,
  JWT_EXPIRES,
  COOKIE_NAME,
  TS_CHANNEL,
  TS_API_KEY,
  isThingSpeakConfigured,
};
