/**
 * Serverless: /api/auth/*
 *
 * Usa lib partilhada (config/auth/validators/errors/middleware/logger).
 */
'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const cookieParser = require('cookie-parser');
const connectDB = require('./db');
const User = require('../models/User');
const AccessLog = require('../models/AccessLog');
const { BCRYPT_ROUNDS } = require('../lib/config');
const { signToken, setAuthCookie, clearAuthCookie, requireAuthApi, requireAdminApi } = require('../lib/auth');
const { validateRegister, normalizeLogin } = require('../lib/validators');
const { sendProblem } = require('../lib/errors');
const { requestId, authLimiter } = require('../lib/middleware');
const { logger, auditLog } = require('../lib/logger');

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(requestId);

async function log(userId, username, event, req, details = null) {
  await auditLog(AccessLog, { userId, username, event, req, details });
}

/* ── Routes ── */
app.post('/api/auth/register', authLimiter, async (req, res) => {
  const { username, email, password } = req.body || {};
  const validationError = validateRegister({ username, email, password });
  if (validationError) return sendProblem(req, res, 'VALIDATION', validationError);

  try {
    await connectDB();

    if (await User.findOne({ username: normalizeLogin(username) }))
      return sendProblem(req, res, 'CONFLICT', 'Nome de usuário já em uso.');
    if (await User.findOne({ email: normalizeLogin(email) }))
      return sendProblem(req, res, 'CONFLICT', 'E-mail já cadastrado.');

    const userCount = await User.countDocuments();
    const isAdmin = userCount === 0;

    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await User.create({
      username,
      email: normalizeLogin(email),
      password_hash: hash,
      is_admin: isAdmin,
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
    await connectDB();

    const login = normalizeLogin(username);
    const user = await User.findOne({
      $or: [{ username: login }, { email: login }],
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
      if (totalUsers === 1) {
        user.is_admin = true;
      }
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
    await connectDB();
    const user = await User.findById(req.user.id).select('username email is_active is_admin created_at last_login');
    if (!user) return sendProblem(req, res, 'NOT_FOUND', 'Utilizador não encontrado.');
    return res.json(user);
  } catch (err) {
    return sendProblem(req, res, 'INTERNAL', 'Erro interno. Tente novamente.', err);
  }
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

/* ── Export ── */
module.exports = app;
module.exports.requireAdminApi = requireAdminApi;
module.exports.requireAuthApi = requireAuthApi;