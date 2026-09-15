/**
 * Serverless: /api/thingspeak/*
 * Proxy para ThingSpeak (evita CORS) com timeout + retry (ENGENHARIA §10).
 *
 * GET é idempotente: repetir não cria efeito colateral, logo retry é seguro.
 */
'use strict';

const express = require('express');
const { TS_CHANNEL, TS_API_KEY, isThingSpeakConfigured } = require('../lib/config');
const { parseResults } = require('../lib/validators');
const { sendProblem } = require('../lib/errors');
const { requestId } = require('../lib/middleware');
const { fetchJsonWithRetry, buildLastUrl, buildHistoryUrl } = require('../lib/thingspeak');

const app = express();
app.use(requestId);

app.get('/api/thingspeak/last', async (req, res) => {
  if (!isThingSpeakConfigured)
    return sendProblem(req, res, 'INTERNAL', 'ThingSpeak não configurado.');
  try {
    const data = await fetchJsonWithRetry(buildLastUrl(TS_CHANNEL, TS_API_KEY));
    return res.json(data);
  } catch (err) {
    return sendProblem(req, res, 'UPSTREAM', 'Falha ao conectar com ThingSpeak. Tente novamente.', err);
  }
});

app.get('/api/thingspeak/history', async (req, res) => {
  if (!isThingSpeakConfigured)
    return sendProblem(req, res, 'INTERNAL', 'ThingSpeak não configurado.');
  const results = parseResults(req.query);
  try {
    const data = await fetchJsonWithRetry(buildHistoryUrl(TS_CHANNEL, TS_API_KEY, results));
    return res.json(data);
  } catch (err) {
    return sendProblem(req, res, 'UPSTREAM', 'Falha ao conectar com ThingSpeak. Tente novamente.', err);
  }
});

module.exports = app;