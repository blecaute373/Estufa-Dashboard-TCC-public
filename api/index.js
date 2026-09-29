/**
 * Entry point para Vercel serverless
 * Combina auth, thingspeak, admin, control + serve páginas com auth
 */
'use strict';

const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');

const authApp = require('./auth');
const thingspeakApp = require('./thingspeak');
const adminApp = require('./admin');
const controlApp = require('./control');
const { requireAuthPage, requireAdminPage } = require('../lib/auth');
const { requestId, securityHeaders } = require('../lib/middleware');
const { sendProblem } = require('../lib/errors');

const app = express();

// A Vercel põe a app atrás de um proxy: sem isto, `req.ip` é o IP do proxy
// interno e o rate limiting passa a contar TODOS os utilizadores no mesmo
// bucket (o limite de login virava global, não por IP). O AccessLog
// registava também o endereço errado. Paridade com `server.js`, que já fazia
// isto. `1` = confiar apenas no primeiro salto (o proxy da plataforma), nunca
// na cadeia toda — confiar em tudo permitiria falsificar `X-Forwarded-For`.
app.set('trust proxy', 1);

// `requestId` ANTES de `express.json()`: um corpo JSON malformado faz o
// body-parser lançar dentro do middleware, e se o requestId ainda não existisse
// o erro saía com `requestId: null` — ou seja, sem forma de correlacionar a
// falha com o log. A ordem é o que dá rastreabilidade ao erro (§9.1).
app.use(requestId);
app.use(express.json({ limit: '32kb' }));
app.use(cookieParser());
app.use(securityHeaders());

// Middleware de auth para páginas protegidas (lib partilhada)
const requireAuth = requireAuthPage('/index.html');

// Middleware que só admin passa — outros voltam pro dashboard
const requireAdminPageMw = requireAdminPage('/index.html', '/dashboard.html?error=restrito');

// Rotas das APIs (montadas primeiro, sem auth)
app.use(authApp);
app.use(thingspeakApp);
app.use(adminApp);
// /api/control (fila de comandos) + /api/control/pending (poll do ESP32) — ADR-0007
app.use(controlApp);

// Páginas públicas (login — sem auth)
app.get('/login-dashboard.html', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'login-dashboard.html'));
});
app.get('/login-admin.html', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'login-admin.html'));
});

// Páginas protegidas
app.get('/dashboard.html', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'dashboard.html'));
});
app.get('/admin.html', requireAdminPageMw, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'admin.html'));
});
app.get('/', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'dashboard.html'));
});


// ── CONTROL: as rotas reais vivem em api/control.js (ADR-0007 — fila de
// comandos: admin enfileira, o ESP32 recolhe no poll). ──

// Health para monitoramento (Vercel/monitor externo)
app.get('/api/health', (req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

// Rota de API inexistente → 404 em JSON (RFC 9457), NUNCA o `index.html`.
// Sem isto, o fallback `*` abaixo respondia 200 com HTML a `/api/qualquer-coisa`,
// e o cliente tentava `res.json()` sobre um corpo HTML (ver BLUEPRINT §14.1
// "Contrato de API previsível").
app.use('/api', (req, res) => {
  sendProblem(req, res, 'NOT_FOUND', 'Endpoint inexistente.');
});

// Arquivos estáticos (públicos)
app.use(express.static(path.join(__dirname, '..', 'public')));

// Fallback das páginas (SPA): só agora, depois de /api estar fechado acima.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Error handler final. O Express, por omissão, devolve o HTML da página de
// erro (com stack em desenvolvimento) quando uma rota lança — o que quebra o
// contrato JSON da API e chega a vazar internals. O handler de 4 argumentos
// é reconhecido pelo Express como error handler.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // JSON malformado (body-parser) e erros do nosso próprio código seguem a
  // mesma normalização: detalhe público genérico, causa real só no log.
  const isBadJson = err?.type === 'entity.parse.failed' || err instanceof SyntaxError;
  const code = isBadJson ? 'VALIDATION' : 'INTERNAL';
  const publicDetail = isBadJson ? 'Corpo JSON inválido.' : 'Erro interno. Tente novamente.';
  return sendProblem(req, res, code, publicDetail, err);
});

module.exports = app;