/**
 * Estufa 01 — Servidor Local (Express + MongoDB)
 * Stack: Express · mongoose · bcryptjs · JWT
 *
 * Para desenvolvimento local. No Vercel, as api/*.js são usadas.
 */
'use strict';

require('dotenv').config();

const express      = require('express');
const mongoose     = require('mongoose');
const bcrypt       = require('bcryptjs');
const jwt          = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const rateLimit    = require('express-rate-limit');
const path         = require('path');
const https        = require('https');

const PORT          = process.env.PORT || 3000;
const MONGODB_URI   = process.env.MONGODB_URI || 'mongodb://localhost:27017/estufa';
const BCRYPT_ROUNDS = 12;
const JWT_EXPIRES   = '8h';
const COOKIE_NAME   = 'estufa_tok';
const JWT_SECRET    = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');

const TS_CHANNEL = parseInt(process.env.TS_CHANNEL) || 3361741;
const TS_API_KEY = process.env.TS_API_KEY || '';

const User       = require('./models/User');
const AccessLog  = require('./models/AccessLog');

/* ── Helper HTTPS ── */
function fetchThingSpeak(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch { reject(new Error('Resposta inválida do ThingSpeak')); }
      });
    }).on('error', reject);
  });
}

/* ── Helpers DB ── */
async function log(userId, username, event, req, details = null) {
  try {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
    const ua = req.headers['user-agent'] || 'unknown';
    await AccessLog.create({
      user_id: userId || null, username: username || null, event,
      ip_address: ip, user_agent: ua,
      details: details ? JSON.stringify(details) : null,
    });
  } catch { /* silent */ }
}

/* ── APP ── */
const app = express();
app.set('trust proxy', 1);
app.use(express.json());
app.use(cookieParser());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 20,
  message: { error: 'Muitas tentativas. Aguarde 15 minutos.' },
  standardHeaders: true, legacyHeaders: false,
});

function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME] || req.headers['authorization']?.replace('Bearer ', '');
  if (!token) return res.redirect('/index.html');
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.clearCookie(COOKIE_NAME); res.redirect('/index.html'); }
}

function requireAuthApi(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME] || req.headers['authorization']?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Não autenticado' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Sessão expirada' }); }
}

/* ── AUTH ROUTES ── */
app.post('/api/auth/register', authLimiter, async (req, res) => {
  const { username, email, password } = req.body || {};
  if (!username || !email || !password)
    return res.status(400).json({ error: 'Preencha todos os campos.' });
  if (!/^[a-zA-Z0-9_]{3,30}$/.test(username))
    return res.status(400).json({ error: 'Usuário: 3–30 caracteres (letras, números, _).' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ error: 'E-mail inválido.' });
  if (password.length < 8)
    return res.status(400).json({ error: 'Senha mínima: 8 caracteres.' });
  try {
    if (await User.findOne({ username: username.toLowerCase() }))
      return res.status(409).json({ error: 'Nome de usuário já em uso.' });
    if (await User.findOne({ email: email.toLowerCase() }))
      return res.status(409).json({ error: 'E-mail já cadastrado.' });
    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await User.create({ username, email: email.toLowerCase(), password_hash: hash });
    await log(user._id, user.username, 'register', req);
    const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
    res.cookie(COOKIE_NAME, token, { httpOnly: true, sameSite: 'lax', maxAge: 8 * 60 * 60 * 1000 })
       .json({ ok: true, username: user.username });
  } catch (err) {
    console.error('[Auth] Register error:', err);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password)
    return res.status(400).json({ error: 'Preencha usuário e senha.' });
  try {
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
    const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
    res.cookie(COOKIE_NAME, token, { httpOnly: true, sameSite: 'lax', maxAge: 8 * 60 * 60 * 1000 })
       .json({ ok: true, username: user.username });
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
  const user = await User.findById(req.user.id).select('username email is_active created_at last_login');
  if (!user) return res.status(404).json({ error: 'Não encontrado' });
  res.json(user);
});

app.get('/api/auth/status', async (req, res) => {
  try {
    const count = await User.countDocuments();
    res.json({ registeredUsers: count });
  } catch { res.json({ registeredUsers: 0 }); }
});

/* ── THINGSPEAK PROXY ── */
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

/* ── ADMIN ── */
app.get('/api/admin/logs', requireAuthApi, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    const logs = await AccessLog.find()
      .populate('user_id', 'email')
      .sort({ created_at: -1 })
      .limit(limit)
      .lean();
    res.json(logs.map(l => ({
      id: l._id, user_id: l.user_id?._id || null, username: l.username,
      event: l.event, ip_address: l.ip_address, user_agent: l.user_agent,
      details: l.details, created_at: l.created_at, email: l.user_id?.email || null,
    })));
  } catch (err) {
    console.error('[Admin] Logs error:', err);
    res.status(500).json({ error: 'Erro ao carregar logs' });
  }
});

app.get('/api/admin/users', requireAuthApi, async (req, res) => {
  try {
    const users = await User.find()
      .select('username email is_active created_at last_login')
      .sort({ created_at: -1 })
      .lean();
    res.json(users);
  } catch (err) {
    console.error('[Admin] Users error:', err);
    res.status(500).json({ error: 'Erro ao carregar usuários' });
  }
});

/* ── PAGES ── */
app.get('/dashboard.html', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));
app.get('/admin.html',     requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/',               requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));
app.use(express.static(path.join(__dirname, 'public')));

/* ── START ── */
mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('[DB] Conectado ao MongoDB');
    app.listen(PORT, () => {
      console.log(`\n🌿 Estufa 01 rodando em http://localhost:${PORT}`);
      console.log(`   Dashboard  → http://localhost:${PORT}/dashboard.html`);
      console.log(`   Login      → http://localhost:${PORT}/index.html`);
      console.log(`   Admin/Logs → http://localhost:${PORT}/admin.html`);
      console.log(`   ThingSpeak proxy ativo (canal ${TS_CHANNEL})\n`);
    });
  })
  .catch(err => {
    console.error('[DB] Erro ao conectar MongoDB:', err.message);
    console.error('Certifique-se de que o MongoDB está rodando ou ajuste MONGODB_URI no .env');
    process.exit(1);
  });