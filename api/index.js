/**
 * Entry point para Vercel serverless
 * Combina auth, thingspeak, admin + serve páginas com auth
 */
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const path = require('path');

const authApp = require('./auth');
const thingspeakApp = require('./thingspeak');
const adminApp = require('./admin');

const app = express();
app.use(express.json());
app.use(cookieParser());

const JWT_SECRET = process.env.JWT_SECRET || 'REDACTED_JWT_SECRET==';
const COOKIE_NAME = 'estufa_tok';

// Middleware de auth para páginas protegidas
function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME] || req.headers['authorization']?.replace('Bearer ', '');
  if (!token) return res.redirect('/index.html');
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.clearCookie(COOKIE_NAME);
    res.redirect('/index.html');
  }
}

// Middleware que só admin passa — outros voltam pro dashboard
function requireAdminPage(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME] || req.headers['authorization']?.replace('Bearer ', '');
  if (!token) return res.redirect('/index.html');
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    if (!req.user.is_admin) {
      return res.redirect('/dashboard.html?error=restrito');
    }
    next();
  } catch {
    res.clearCookie(COOKIE_NAME);
    res.redirect('/index.html');
  }
}

// Rotas das APIs (montadas primeiro, sem auth)
app.use(authApp);
app.use(thingspeakApp);
app.use(adminApp);

// Páginas protegidas
app.get('/dashboard.html', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'dashboard.html'));
});
app.get('/admin.html', requireAdminPage, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'admin.html'));
});
app.get('/', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'dashboard.html'));
});

// Arquivos estáticos (públicos)
app.use(express.static(path.join(__dirname, '..', 'public')));

// Fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

module.exports = app;