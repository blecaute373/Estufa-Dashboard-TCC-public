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
const cookieParser = require('cookie-parser');
const path         = require('path');

const {
  PORT, getMongoUri, BCRYPT_ROUNDS, TS_CHANNEL, TS_API_KEY, isThingSpeakConfigured,
} = require('./lib/config');
const {
  signToken, setAuthCookie, clearAuthCookie, requireAuthApi, requireAdminApi,
  requireAuthPage, requireAdminPage,
} = require('./lib/auth');
const { validateRegister, normalizeLogin, parsePagination, parseResults } = require('./lib/validators');
const { sendProblem } = require('./lib/errors');
const { requestId, authLimiter } = require('./lib/middleware');
const { logger, auditLog } = require('./lib/logger');
const {
  fetchJsonWithRetry, buildLastUrl, buildHistoryUrl,
} = require('./lib/thingspeak');

const MONGODB_URI = getMongoUri();

if (!isThingSpeakConfigured) {
  logger.warn('thingspeak_nao_configurado', { hint: 'Defina TS_CHANNEL no .env' });
}

const User       = require('./models/User');
const AccessLog  = require('./models/AccessLog');

/* ── Helpers DB ── */
async function log(userId, username, event, req, details = null) {
  await auditLog(AccessLog, { userId, username, event, req, details });
}

/* ── APP ── */
const app = express();
app.set('trust proxy', 1);
app.use(express.json());
app.use(cookieParser());
app.use(requestId);

const requireAuth = requireAuthPage('/index.html');
const requireAdminPageMw = requireAdminPage('/index.html', '/dashboard.html?error=restrito');

/* ── AUTH ROUTES ── */
app.post('/api/auth/register', authLimiter, async (req, res) => {
  const { username, email, password } = req.body || {};
  const validationError = validateRegister({ username, email, password });
  if (validationError) return sendProblem(req, res, 'VALIDATION', validationError);
  try {
    if (await User.findOne({ username: normalizeLogin(username) }))
      return sendProblem(req, res, 'CONFLICT', 'Nome de usuário já em uso.');
    if (await User.findOne({ email: normalizeLogin(email) }))
      return sendProblem(req, res, 'CONFLICT', 'E-mail já cadastrado.');
    const userCount = await User.countDocuments();
    const isAdmin = userCount === 0;
    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await User.create({
      username, email: normalizeLogin(email), password_hash: hash, is_admin: isAdmin,
    });
    await log(user._id, user.username, 'register', req, isAdmin ? { role: 'admin' } : { role: 'user' });
    logger.info('auth_register', { requestId: req.requestId, username: user.username, isAdmin });
    const token = signToken(user);
    setAuthCookie(res, token);
    return res.json({ ok: true, username: user.username, is_admin: isAdmin, token });
  } catch (err) {
    return sendProblem(req, res, 'INTERNAL', 'Erro interno. Tente novamente.', err);
  }
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password)
    return sendProblem(req, res, 'VALIDATION', 'Preencha usuário e senha.');
  try {
    const login = normalizeLogin(username);
    const user = await User.findOne({
      $or: [{ username: login }, { email: login }]
    });
    if (!user || !user.is_active) {
      await log(null, username, 'failed_login', req, { reason: 'not_found' });
      return sendProblem(req, res, 'UNAUTHENTICATED', 'Usuário ou senha incorretos.');
    }
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      await log(user._id, user.username, 'failed_login', req, { reason: 'wrong_password' });
      return sendProblem(req, res, 'UNAUTHENTICATED', 'Usuário ou senha incorretos.');
    }
    user.last_login = new Date();
    if (!user.is_admin) {
      const totalUsers = await User.countDocuments();
      if (totalUsers === 1) user.is_admin = true;
    }
    await user.save();
    await log(user._id, user.username, 'login', req);
    logger.info('auth_login', { requestId: req.requestId, username: user.username });
    const token = signToken(user);
    setAuthCookie(res, token);
    return res.json({ ok: true, username: user.username, is_admin: user.is_admin, token });
  } catch (err) {
    return sendProblem(req, res, 'INTERNAL', 'Erro interno. Tente novamente.', err);
  }
});

app.post('/api/auth/logout', requireAuthApi, async (req, res) => {
  await log(req.user.id, req.user.username, 'logout', req);
  clearAuthCookie(res);
  return res.json({ ok: true });
});

app.get('/api/auth/me', requireAuthApi, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('username email is_active is_admin created_at last_login');
    if (!user) return sendProblem(req, res, 'NOT_FOUND', 'Utilizador não encontrado.');
    return res.json(user);
  } catch (err) {
    return sendProblem(req, res, 'INTERNAL', 'Erro interno. Tente novamente.', err);
  }
});

app.get('/api/auth/status', async (req, res) => {
  try {
    const count = await User.countDocuments();
    res.json({ registeredUsers: count });
  } catch { res.json({ registeredUsers: 0 }); }
});

/* ── THINGSPEAK PROXY (resiliente: timeout + retry, §10) ── */
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

/* ── ADMIN (autorização antes da lógica, §8.2) ── */
app.get('/api/admin/logs', requireAdminApi, async (req, res) => {
  try {
    const { limit, offset } = parsePagination(req.query);
    const logs = await AccessLog.find()
      .populate('user_id', 'email')
      .sort({ created_at: -1 })
      .skip(offset)
      .limit(limit)
      .lean();
    return res.json({
      data: logs.map(l => ({
        id: l._id, user_id: l.user_id?._id || null, username: l.username,
        event: l.event, ip_address: l.ip_address, user_agent: l.user_agent,
        details: l.details, created_at: l.created_at, email: l.user_id?.email || null,
      })),
      pagination: { limit, offset },
    });
  } catch (err) {
    return sendProblem(req, res, 'INTERNAL', 'Erro ao carregar logs. Tente novamente.', err);
  }
});

app.get('/api/admin/users', requireAdminApi, async (req, res) => {
  try {
    const users = await User.find()
      .select('username email is_active is_admin created_at last_login')
      .sort({ created_at: -1 })
      .lean();
    return res.json({ data: users });
  } catch (err) {
    return sendProblem(req, res, 'INTERNAL', 'Erro ao carregar usuários. Tente novamente.', err);
  }
});

/* ── HEALTH (para CI/monitoramento, §9.2) ── */
app.get('/api/health', (req, res) => {
  res.json({ ok: true, uptime: process.uptime(), thingspeak: isThingSpeakConfigured });
});

/* ── PAGES ── */
app.get('/dashboard.html', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));
app.get('/admin.html',     requireAdminPageMw, (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/',               requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));
app.use(express.static(path.join(__dirname, 'public')));

/* ── START ── */
if (require.main === module) {
mongoose.connect(MONGODB_URI)
  .then(() => {
    logger.info('db_conectado', {});
    app.listen(PORT, () => {
      console.log(`\n🌿 Estufa 01 rodando em http://localhost:${PORT}`);
      console.log(`   Dashboard  → http://localhost:${PORT}/dashboard.html`);
      console.log(`   Login      → http://localhost:${PORT}/index.html`);
      console.log(`   Admin/Logs → http://localhost:${PORT}/admin.html`);
      console.log(`   ThingSpeak proxy ativo (canal ${TS_CHANNEL})\n`);
    });
  })
  .catch(err => {
    logger.error('db_erro_conexao', { message: err.message });
    console.error('Certifique-se de que o MongoDB está rodando ou ajuste MONGODB_URI no .env');
    process.exit(1);
  });
}

module.exports = app;