/**
 * Serverless: /api/admin/*
 *
 * Autorização (requireAdminApi) ANTES da lógica de negócio (ENGENHARIA §8.2).
 * Erros padronizados (RFC 9457) + paginação real em /logs.
 */
'use strict';

const express = require('express');
const cookieParser = require('cookie-parser');
const connectDB = require('./db');
const User = require('../models/User');
const AccessLog = require('../models/AccessLog');
const { requireAdminApi } = require('../lib/auth');
const { parsePagination } = require('../lib/validators');
const { sendProblem } = require('../lib/errors');
const { requestId, strictLimiter } = require('../lib/middleware');
const { logger } = require('../lib/logger');

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(requestId);

app.get('/api/admin/logs', requireAdminApi, async (req, res) => {
  try {
    await connectDB();
    const { limit, offset } = parsePagination(req.query);
    const logs = await AccessLog.find()
      .populate('user_id', 'email')
      .sort({ created_at: -1 })
      .skip(offset)
      .limit(limit)
      .lean();
    const result = logs.map(l => ({
      id: l._id,
      user_id: l.user_id?._id || null,
      username: l.username,
      event: l.event,
      ip_address: l.ip_address,
      user_agent: l.user_agent,
      details: l.details,
      created_at: l.created_at,
      email: l.user_id?.email || null,
    }));
    return res.json({ data: result, pagination: { limit, offset } });
  } catch (err) {
    return sendProblem(req, res, 'INTERNAL', 'Erro ao carregar logs. Tente novamente.', err);
  }
});

app.get('/api/admin/users', requireAdminApi, async (req, res) => {
  try {
    await connectDB();
    const users = await User.find()
      .select('username email is_active is_admin created_at last_login')
      .sort({ created_at: -1 })
      .lean();
    return res.json({ data: users });
  } catch (err) {
    return sendProblem(req, res, 'INTERNAL', 'Erro ao carregar usuários. Tente novamente.', err);
  }
});

// Bootstrap de emergência: promove o primeiro utilizador a admin.
// Funciona apenas se não existir nenhum admin. POST + rate-limit estrito
// (GET aberto sem auth seria vetor de elevação — ENGENHARIA §8.2).
// Desative/remova após o primeiro admin existir.
app.post('/api/admin/promote-first', strictLimiter, async (req, res) => {
  try {
    await connectDB();
    const adminCount = await User.countDocuments({ is_admin: true });
    if (adminCount > 0) {
      return sendProblem(req, res, 'VALIDATION', 'Já existe um administrador no sistema.');
    }

    const firstUser = await User.findOne().sort({ created_at: 1 });
    if (!firstUser) {
      return sendProblem(req, res, 'VALIDATION', 'Nenhum usuário encontrado.');
    }

    firstUser.is_admin = true;
    await firstUser.save();

    logger.info('admin_promote_first', { requestId: req.requestId, username: firstUser.username });
    return res.json({
      ok: true,
      message: `Usuário "${firstUser.username}" agora é administrador. Faça logout e login novamente.`,
      username: firstUser.username,
    });
  } catch (err) {
    return sendProblem(req, res, 'INTERNAL', 'Erro interno. Tente novamente.', err);
  }
});

module.exports = app;
