/**
 * Serverless: /api/thingspeak/*
 * Proxy para ThingSpeak (evita CORS) com timeout + retry (ENGENHARIA §10).
 *
 * GET é idempotente: repetir não cria efeito colateral, logo retry é seguro.
 *
 * Cache curto (8 s, `lib/cache.js`): o dashboard faz polling a cada 16 s por
 * utilizador e o canal ThingSpeak só publica a cada ~15 s (limite do plano
 * grátis). Servir a mesma leitura durante 8 s evita N-1 idas ao upstream por
 * ciclo — sem devolver dado mais velho do que aquele que o sensor já tem.
 */
'use strict';

const express = require('express');
const { TS_CHANNEL, TS_API_KEY, isThingSpeakConfigured } = require('../lib/config');
const { parseResults } = require('../lib/validators');
const { sendProblem } = require('../lib/errors');
const { requestId } = require('../lib/middleware');
const { fetchJsonWithRetry, buildLastUrl, buildHistoryUrl } = require('../lib/thingspeak');
const { criarCacheTtl, cacheControlPublico, TTL_PADRAO_MS } = require('../lib/cache');

const app = express();
app.use(requestId);

// `max: 8` cobre os dois endpoints com os poucos pedidos de histórico usados
// pelo dashboard (16h/24h) — o resto é evictado, não cresce sem limite.
const cacheLeituras = criarCacheTtl({ ttlMs: TTL_PADRAO_MS, max: 8 });

/**
 * Serve do cache (ou vai buscar UMA vez, mesmo com pedidos simultâneos).
 * O `Cache-Control` acompanha o TTL do servidor: browser e PWA deixam de
 * repetir o pedido dentro da mesma janela — a poupança começa no cliente.
 */
async function responderComCache(req, res, chave, buscar) {
  try {
    const data = await cacheLeituras.obterOuCarregar(chave, buscar);
    res.setHeader('Cache-Control', cacheControlPublico(TTL_PADRAO_MS));
    return res.json(data);
  } catch (err) {
    // Falha NÃO fica em cache (ver lib/cache.js): a tentativa seguinte é limpa.
    return sendProblem(req, res, 'UPSTREAM', 'Falha ao conectar com ThingSpeak. Tente novamente.', err);
  }
}

app.get('/api/thingspeak/last', async (req, res) => {
  if (!isThingSpeakConfigured)
    return sendProblem(req, res, 'INTERNAL', 'ThingSpeak não configurado.');
  return responderComCache(req, res, 'last',
    () => fetchJsonWithRetry(buildLastUrl(TS_CHANNEL, TS_API_KEY)));
});

app.get('/api/thingspeak/history', async (req, res) => {
  if (!isThingSpeakConfigured)
    return sendProblem(req, res, 'INTERNAL', 'ThingSpeak não configurado.');
  const results = parseResults(req.query);
  // Chave por `results`: 16 e 24 são pedidos distintos e não se contaminam.
  return responderComCache(req, res, `history:${results}`,
    () => fetchJsonWithRetry(buildHistoryUrl(TS_CHANNEL, TS_API_KEY, results)));
});

module.exports = app;