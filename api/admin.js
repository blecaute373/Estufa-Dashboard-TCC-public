/**
 * Serverless: /api/admin/*
 */
const express = require('express');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const connectDB = require('./db');
const User = require('../models/User');
const AccessLog = require('../models/AccessLog');

const app = express();
app.use(express.json());
app.use(cookieParser());

const JWT_SECRET = process.env.JWT_SECRET || 'REDACTED_JWT_SECRET==';
const COOKIE_NAME = 'estufa_tok';

function requireAuthApi(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME] || req.headers['authorization']?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Não autenticado' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Sessão expirada' });
  }
}

app.get('/api/admin/logs', requireAuthApi, async (req, res) => {
  try {
    await connectDB();
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    const logs = await AccessLog.find()
      .populate('user_id', 'email')
      .sort({ created_at: -1 })
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
    res.json(result);
  } catch (err) {
    console.error('[Admin] Logs error:', err);
    res.status(500).json({ error: 'Erro ao carregar logs' });
  }
});

app.get('/api/admin/users', requireAuthApi, async (req, res) => {
  try {
    await connectDB();
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

module.exports = app;