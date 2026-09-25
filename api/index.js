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
const { requestId } = require('../lib/middleware');

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(requestId);

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

// Arquivos estáticos (públicos)
app.use(express.static(path.join(__dirname, '..', 'public')));

// Fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

module.exports = app;