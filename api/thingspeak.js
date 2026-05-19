/**
 * Serverless: /api/thingspeak/*
 * Proxy para ThingSpeak (evita CORS)
 */
const express = require('express');
const https = require('https');

const app = express();

const TS_CHANNEL = parseInt(process.env.TS_CHANNEL);
const TS_API_KEY = process.env.TS_API_KEY || '';

function fetchThingSpeak(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          reject(new Error('Resposta inválida do ThingSpeak'));
        }
      });
    }).on('error', reject);
  });
}

app.get('/api/thingspeak/last', async (req, res) => {
  try {
    const url = `https://api.thingspeak.com/channels/${TS_CHANNEL}/feeds/last.json?api_key=${TS_API_KEY}`;
    const data = await fetchThingSpeak(url);
    res.json(data);
  } catch (err) {
    console.error('[TS Proxy] Erro ao buscar último:', err.message);
    res.status(502).json({ error: 'Falha ao conectar com ThingSpeak', details: err.message });
  }
});

app.get('/api/thingspeak/history', async (req, res) => {
  const results = Math.min(parseInt(req.query.results) || 60, 800);
  try {
    const url = `https://api.thingspeak.com/channels/${TS_CHANNEL}/feeds.json?api_key=${TS_API_KEY}&results=${results}`;
    const data = await fetchThingSpeak(url);
    res.json(data);
  } catch (err) {
    console.error('[TS Proxy] Erro ao buscar histórico:', err.message);
    res.status(502).json({ error: 'Falha ao conectar com ThingSpeak', details: err.message });
  }
});

module.exports = app;