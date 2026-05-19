/**
 * Serverless: /api/auth/*
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const connectDB = require('./db');
const User = require('../models/User');
const AccessLog = require('../models/AccessLog');

const app = express();
app.use(express.json());
app.use(cookieParser());

const JWT_SECRET = process.env.JWT_SECRET || 'REDACTED_JWT_SECRET==';
const BCRYPT_ROUNDS = 12;
const JWT_EXPIRES = '8h';
const COOKIE_NAME = 'estufa_tok';

function signToken(user) {
  return jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

function setCookie(res, token) {
  res.cookie(COOKIE_NAME, token, { httpOnly: true, sameSite: 'lax', maxAge: 8 * 60 * 60 * 1000 });
}

async function log(userId, username, event, req, details = null) {
  try {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
    const ua = req.headers['user-agent'] || 'unknown';
    await AccessLog.create({
      user_id: userId || null,
      username: username || null,
      event,
      ip_address: ip,
      user_agent: ua,
      details: details ? JSON.stringify(details) : null,
    });
  } catch { /* silently fail */ }
}

async function requireAuthApi(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME] || req.headers['authorization']?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Não autenticado' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Sessão expirada' });
  }
}

/* ── Routes ── */
// Sem rate-limit (não funciona em serverless). No Vercel, usar Vercel Firewall ou headers.
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body || {};
    if (!username || !email || !password)
      return res.status(400).json({ error: 'Preencha todos os campos.' });
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(username))
      return res.status(400).json({ error: 'Usuário: 3–30 caracteres (letras, números, _).' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return res.status(400).json({ error: 'E-mail inválido.' });
    if (password.length < 8)
      return res.status(400).json({ error: 'Senha mínima: 8 caracteres.' });
    
    await connectDB();
    
    if (await User.findOne({ username: username.toLowerCase() }))
      return res.status(409).json({ error: 'Nome de usuário já em uso.' });
    if (await User.findOne({ email: email.toLowerCase() }))
      return res.status(409).json({ error: 'E-mail já cadastrado.' });

    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await User.create({ username, email: email.toLowerCase(), password_hash: hash });
    await log(user._id, user.username, 'register', req);
    const token = signToken(user);
    setCookie(res, token);
    return res.json({ ok: true, username: user.username });
  } catch (err) {
    console.error('[Auth] Register error:', err.message);
    console.error(err.stack);
    return res.status(500).json({ error: 'Erro interno: ' + err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password)
      return res.status(400).json({ error: 'Preencha usuário e senha.' });
    
    await connectDB();
    

    const user = await User.findOne({
      $or: [{ username: username.toLowerCase() }, { email: username.toLowerCase() }]
    });

    if (!user || !user.is_active) {
      await log(null, username, 'failed_login', req, { reason: 'not_found' });
      return res.status(401).json({ error: 'Usuário ou senha incorretos.' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      await log(user._id, user.username, 'failed_login', req, { reason: 'wrong_password' });
      return res.status(401).json({ error: 'Usuário ou senha incorretos.' });
    }

    user.last_login = new Date();
    await user.save();
    await log(user._id, user.username, 'login', req);
    const token = signToken(user);
    setCookie(res, token);
    res.json({ ok: true, username: user.username });
  } catch (err) {
    console.error('[Auth] Login error:', err);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

app.post('/api/auth/logout', requireAuthApi, async (req, res) => {
  await log(req.user.id, req.user.username, 'logout', req);
  res.clearCookie(COOKIE_NAME).json({ ok: true });
});

app.get('/api/auth/me', requireAuthApi, async (req, res) => {
  await connectDB();
  const user = await User.findById(req.user.id).select('username email is_active created_at last_login');
  if (!user) return res.status(404).json({ error: 'Não encontrado' });
  res.json(user);
});

app.get('/api/auth/status', async (req, res) => {
  try {
    await connectDB();
    const count = await User.countDocuments();
    res.json({ registeredUsers: count });
  } catch {
    res.json({ registeredUsers: 0 });
  }
});

/* ── Export for Vercel serverless ── */
module.exports = app;