/**
 * Entry point para Vercel serverless
 * Combina auth, thingspeak, admin, control + serve páginas com auth
 *
 * A montagem comum (base, páginas, health, fecho da app) vive em `lib/app.js`
 * — é o MESMO código que o `server.js` corre em local. Aqui fica só o que é
 * genuinamente diferente: o controlo por fila (`api/control.js`, ADR-0007).
 */
'use strict';

const express = require('express');
const path = require('path');

const authApp = require('./auth');
const thingspeakApp = require('./thingspeak');
const adminApp = require('./admin');
const controlApp = require('./control');
const { montarBase, rotasDePaginas, rotaHealth, fecharApp } = require('../lib/app');

const app = express();
const DIR_PUBLICO = path.join(__dirname, '..', 'public');

// trust proxy + requestId + json 32kb + cookies + headers de segurança.
montarBase(app);

// Páginas (login público, dashboard/admin com sessão).
rotasDePaginas(app, DIR_PUBLICO);

// Rotas das APIs (sem auth no mount — cada rota autoriza por si, §9.2).
app.use(authApp);
app.use(thingspeakApp);
app.use(adminApp);
// /api/control (fila de comandos) + /api/control/pending (poll do ESP32) — ADR-0007
app.use(controlApp);

rotaHealth(app);

// 404 JSON de /api → estáticos → fallback de página → error handler.
// `fallbackSpa: true` porque na Vercel o HTML não é servido pelo Edge: o
// build só trata `public/**/*.!(html)` como estático, e as rotas de página
// acima mais este fallback é que entregam as páginas.
fecharApp(app, { dirPublico: DIR_PUBLICO, fallbackSpa: true });

module.exports = app;
