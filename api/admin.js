/**
 * Serverless: /api/admin/*
 */
const express = require('express');
const cookieParser = require('cookie-parser');
const connectDB = require('./db');
const User = require('../models/User');
const AccessLog = require('../models/AccessLog');
const { requireAdminApi } = require('./auth');

const app = express();
app.use(express.json());
app.use(cookieParser());

app.get('/api/admin/logs', requireAdminApi, async (req, res) => {
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

app.get('/api/admin/users', requireAdminApi, async (req, res) => {
  try {
    await connectDB();
    const users = await User.find()
      .select('username email is_active is_admin created_at last_login')
      .sort({ created_at: -1 })
      .lean();
    res.json(users);
  } catch (err) {
    console.error('[Admin] Users error:', err);
    res.status(500).json({ error: 'Erro ao carregar usuários' });
  }
});

// Rota de emergência: promove o primeiro usuário a admin
// Funciona apenas se não existir nenhum admin no banco
// GET para poder acessar direto pelo navegador
app.get('/api/admin/promote-first', async (req, res) => {
  try {
    await connectDB();
    const adminCount = await User.countDocuments({ is_admin: true });
    if (adminCount > 0) {
      return res.status(400).json({ error: 'Já existe um administrador no sistema.' });
    }

    const firstUser = await User.findOne().sort({ created_at: 1 });
    if (!firstUser) {
      return res.status(400).json({ error: 'Nenhum usuário encontrado.' });
    }

    firstUser.is_admin = true;
    await firstUser.save();

    console.log(`[Admin] Usuário "${firstUser.username}" promovido a admin via rota de emergência.`);
    res.json({
      ok: true,
      message: `Usuário "${firstUser.username}" agora é administrador. Faça logout e login novamente.`,
      username: firstUser.username,
    });
  } catch (err) {
    console.error('[Admin] Promote error:', err);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

module.exports = app;
