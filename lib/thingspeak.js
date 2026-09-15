/**
 * Estufa 01 — Cliente ThingSpeak resiliente (ENGENHARIA §10)
 *
 * GET é idempotente por natureza (§11.1): repetir não cria efeito colateral,
 * por isso retry automático é seguro aqui. Operações com efeito colateral
 * (POST/DELETE) exigiriam chave de idempotência — não é o caso deste proxy.
 *
 * - timeout por tentativa (evita function pendurada até timeout da Vercel)
 * - retry com backoff exponencial + jitter apenas para erro transitório
 *   (rede/timeout/5xx). Erro permanente (4xx, JSON inválido) falha de imediato.
 */
'use strict';

const https = require('https');

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_MAX_ATTEMPTS = 3;

function isTransientError(err) {
  if (!err) return false;
  // Timeout/abort de rede.
  if (err.name === 'AbortError' || err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT') return true;
  if (typeof err.message === 'string' && /timeout|timed out|econnreset|econnrefused|socket hang up/i.test(err.message)) {
    // ECONNREFUSED pode ser transitório (upstream a reiniciar) — tenta de novo com backoff.
    return true;
  }
  // HTTP 5xx ou 429 do upstream: transitório.
  if (typeof err.statusCode === 'number' && (err.statusCode === 429 || err.statusCode >= 500)) return true;
  return false;
}

function fetchJsonOnce(url, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      const statusCode = res.statusCode || 0;
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        if (statusCode < 200 || statusCode >= 300) {
          const err = new Error(`ThingSpeak respondeu HTTP ${statusCode}`);
          err.statusCode = statusCode;
          reject(err);
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch {
          reject(new Error('Resposta inválida do ThingSpeak'));
        }
      });
    });
    req.on('timeout', () => {
      req.destroy(new Error(`Timeout após ${timeoutMs}ms ao contactar ThingSpeak`));
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs);
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Backoff exponencial + jitter (evita "retry storm" sincronizado, §10.1). */
function backoffDelay(attempt, baseMs = 500) {
  const backoff = baseMs * Math.pow(2, attempt - 1); // 500ms, 1s, 2s...
  const jitter = Math.random() * 250;
  return backoff + jitter;
}

async function fetchJsonWithRetry(url, { maxAttempts = DEFAULT_MAX_ATTEMPTS, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fetchJsonOnce(url, { timeoutMs });
    } catch (err) {
      lastError = err;
      const isLast = attempt >= maxAttempts;
      if (isLast || !isTransientError(err)) throw err;
      await sleep(backoffDelay(attempt));
    }
  }
  throw lastError;
}

function buildLastUrl(channel, apiKey) {
  return `https://api.thingspeak.com/channels/${channel}/feeds/last.json?api_key=${apiKey}`;
}

function buildHistoryUrl(channel, apiKey, results) {
  return `https://api.thingspeak.com/channels/${channel}/feeds.json?api_key=${apiKey}&results=${results}`;
}

module.exports = {
  DEFAULT_TIMEOUT_MS,
  DEFAULT_MAX_ATTEMPTS,
  isTransientError,
  fetchJsonOnce,
  fetchJsonWithRetry,
  backoffDelay,
  buildLastUrl,
  buildHistoryUrl,
};
