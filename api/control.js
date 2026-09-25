/**
 * Serverless: /api/control/*
 *
 * Controlo de atuadores 100% Vercel (ADR-0007). A Vercel e serverless e nao
 * alcanca a rede local da estufa, portanto o SENTIDO do comando e invertido:
 *
 *   admin (POST)  -> grava o comando na fila (MongoDB)
 *   ESP32 (GET)   -> recolhe os comandos pendentes no proximo poll e executa
 *
 * Nao ha ngrok, nem broker externo, nem servico novo: so a Vercel e o
 * MongoDB Atlas que o dashboard ja exigia. Custo: o comando passa a ser
 * aplicado em ate ~5 s (intervalo de poll) em vez de imediato.
 *
 * Autorizacao ANTES da logica (§9.2): o comando so e enfileirado por admin
 * autenticado, e so o dispositivo com o token le a fila.
 */
'use strict';

const crypto = require('crypto');
const express = require('express');
const cookieParser = require('cookie-parser');

const connectDB = require('./db');
const ControlCommand = require('../models/ControlCommand');
const AccessLog = require('../models/AccessLog');
const { requireAdminApi } = require('../lib/auth');
const { validarComando } = require('../lib/control');
const { sendProblem } = require('../lib/errors');
const { requestId, controlLimiter, deviceLimiter } = require('../lib/middleware');
const { logger, auditLog } = require('../lib/logger');

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(requestId);

// Comando nunca buscado expira sozinho (5 min) — o TTL index do modelo apaga.
const COMMAND_TTL_MS = 5 * 60 * 1000;
const DEVICE_ID = process.env.DEVICE_ID || 'estufa01';
const MAX_COMMANDS_PER_POLL = 10;

/**
 * Compara o token do dispositivo em tempo constante (§9.7): o `==` normal
 * deixa vazar, por tempo de resposta, quantos bytes iniciais bateram.
 * Como o hash tem tamanho fixo, o timingSafeEqual nunca recebe buffers de
 * tamanhos diferentes (que lancaria excepcao).
 */
function tokenValido(req) {
  const esperado = process.env.DEVICE_TOKEN || '';
  const recebido = req.headers['x-device-token'] || '';
  // Fail-closed: sem DEVICE_TOKEN configurado, ninguem le a fila.
  if (!esperado || !recebido) return false;
  const a = crypto.createHash('sha256').update(esperado).digest();
  const b = crypto.createHash('sha256').update(recebido).digest();
  return crypto.timingSafeEqual(a, b);
}

/* ── POST /api/control — enfileira o comando (admin) ── */
app.post('/api/control', requireAdminApi, controlLimiter, async (req, res) => {
  const { actuator, action } = req.body || {};
  if (!actuator || action === undefined)
    return sendProblem(req, res, 'VALIDATION', 'Informe actuator e action.');

  // Regra de negocio partilhada com o caminho local (lib/control.js).
  const validacao = validarComando(actuator, action);
  if (validacao.erro)
    return sendProblem(req, res, 'VALIDATION', validacao.erro);

  try {
    await connectDB();
    const cmd = await ControlCommand.create({
      device: DEVICE_ID,
      actuator,
      action: String(action),
      payload: validacao.payload,
      user_id: req.user?.id || null,
      username: req.user?.username || null,
      expires_at: new Date(Date.now() + COMMAND_TTL_MS),
    });

    // Trilha de auditoria: quem mandou o que (§10.1 / §20.5).
    await auditLog(AccessLog, {
      userId: req.user?.id || null,
      username: req.user?.username || null,
      event: 'control_' + actuator,
      req,
      details: { action, origem: 'fila_vercel', id: String(cmd._id) },
    });

    logger.info('controlo_enfileirado', {
      requestId: req.requestId, actuator, action, username: req.user?.username || null,
    });

    // 202 = aceito para processamento, ainda nao aplicado (§14.1).
    return res.status(202).json({
      ok: true, queued: true, id: String(cmd._id),
      actuator, action, payload: validacao.payload,
      expires_at: cmd.expires_at,
    });
  } catch (err) {
    return sendProblem(req, res, 'INTERNAL', 'Erro ao enfileirar comando.', err);
  }
});

/* ── GET /api/control/pending — o ESP32 recolhe a fila ── */
app.get('/api/control/pending', deviceLimiter, async (req, res) => {
  if (!tokenValido(req)) {
    // Mesma resposta para token ausente e incorreto: nao damos pista ao
    // atacante sobre qual dos dois falhou (§9.7).
    logger.warn('poll_sem_token_valido', { requestId: req.requestId, ip: req.ip });
    return sendProblem(req, res, 'UNAUTHENTICATED', 'Nao autorizado.');
  }

  try {
    await connectDB();
    const agora = new Date();
    const pendentes = await ControlCommand.find({
      device: DEVICE_ID,
      status: 'pending',
      expires_at: { $gt: agora },
    })
      .sort({ created_at: 1 })
      .limit(MAX_COMMANDS_PER_POLL)
      .lean();

    if (pendentes.length > 0) {
      // Marca como entregue na ENTREGA (at-most-once). Como os comandos são
      // idempotentes (definem estado, não incrementam), uma reentrega seria
      // inofensiva — por isso dispensa chave de idempotência (§11.1).
      await ControlCommand.updateMany(
        { _id: { $in: pendentes.map((c) => c._id) }, status: 'pending' },
        { $set: { status: 'delivered', delivered_at: agora } }
      );
    }

    if (pendentes.length > 0) {
      logger.info('comandos_entregues', {
        requestId: req.requestId, device: DEVICE_ID, count: pendentes.length,
      });
    }

    return res.json({
      ok: true,
      device: DEVICE_ID,
      count: pendentes.length,
      commands: pendentes.map((c) => ({
        id: String(c._id),
        actuator: c.actuator,
        action: c.action,
        payload: c.payload,
      })),
    });
  } catch (err) {
    return sendProblem(req, res, 'INTERNAL', 'Erro ao ler a fila de comandos.', err);
  }
});

module.exports = app;
