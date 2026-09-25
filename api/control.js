/**
 * Serverless: /api/control/*
 *
 * Controlo de atuadores 100% Vercel (ADR-0007 + ADR-0008). A Vercel e serverless e nao
 * alcanca a rede local da estufa, portanto o SENTIDO do comando e invertido:
 *
 *   admin (POST)  -> grava o comando na fila (Upstash Redis)
 *   ESP32 (GET)   -> recolhe os comandos pendentes no proximo poll e executa
 *
 * Nao ha ngrok, nem broker externo: a fila passou do MongoDB para o Upstash
 * Redis (ADR-0008), que a) entrega o pop de forma ATOMICA (elimina a corrida
 * find/updateMany) e b) custa 1 comando por poll — o que torna o plano gratis
 * viavel. Custo: o comando passa a ser aplicado em ate ~10 s (intervalo de
 * poll) em vez de imediato.
 *
 * Autorizacao ANTES da logica (§9.2): o comando so e enfileirado por admin
 * autenticado, e so o dispositivo com o token le a fila.
 */
'use strict';

const crypto = require('crypto');
const express = require('express');
const cookieParser = require('cookie-parser');

const connectDB = require('./db');
const AccessLog = require('../models/AccessLog');
const { requireAdminApi } = require('../lib/auth');
const { validarComando } = require('../lib/control');
const { sendProblem } = require('../lib/errors');
const { requestId, controlLimiter, deviceLimiter } = require('../lib/middleware');
const { logger, auditLog } = require('../lib/logger');
const { enfileirarComando, retirarComandos } = require('../lib/store');

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(requestId);

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

/**
 * Trilha de auditoria (`AccessLog` no MongoDB) — deliberadamente
 * **best-effort e não bloqueante**.
 *
 * O caminho crítico dos atuadores não pode depender do MongoDB (ADR-0008,
 * bolkhead §11.3): se o Atlas estiver em baixo, o comando tem de continuar a
 * ser entregue ao ESP32. Por isso a auditoria corre DEPOIS de o comando já
 * estar na fila, e qualquer falha sua é apenas registada em log.
 */
async function auditar(req, actuator, action, cmdId) {
  try {
    await connectDB();
    await auditLog(AccessLog, {
      userId: req.user?.id || null,
      username: req.user?.username || null,
      event: 'control_' + actuator,
      req,
      details: { action, origem: 'fila_upstash', id: cmdId },
    });
  } catch (err) {
    logger.warn('audit_log_indisponivel', {
      requestId: req.requestId, actuator,
      error: err?.message || String(err),
    });
  }
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
    // Fila primeiro: e o caminho critico. `LPUSH` + `EXPIRE` (Lib/store.js).
    const cmd = await enfileirarComando({
      device: DEVICE_ID,
      actuator,
      action,
      payload: validacao.payload,
      username: req.user?.username || null,
      userId: req.user?.id || null,
    });

    logger.info('controlo_enfileirado', {
      requestId: req.requestId, actuator, action, username: req.user?.username || null,
    });

    // Auditoria depois (Mongo) — nunca pode impedir a entrega (§10.1).
    await auditar(req, actuator, action, cmd.id);

    // 202 = aceito para processamento, ainda nao aplicado (§14.1).
    return res.status(202).json({
      ok: true, queued: true, id: cmd.id,
      actuator, action, payload: validacao.payload,
      expires_at: new Date(cmd.expires_at).toISOString(),
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
    // `LPOP chave 10`: UMA operacao atomica. A versao anterior lia com
    // `find()` e marcava com `updateMany()` em separado — entre as duas, um
    // segundo poll podia recolher os mesmos comandos (ENGENHARIA §12.2).
    // Nao ha connectDB() aqui: o poll nao toca no MongoDB.
    const { comandos, expirados } = await retirarComandos(DEVICE_ID, MAX_COMMANDS_PER_POLL);

    if (expirados > 0) {
      // Comando nunca recolhido apos 5 min: descartado (TTL logico, ADR-0008).
      logger.info('comandos_expirados_descartados', {
        requestId: req.requestId, device: DEVICE_ID, count: expirados,
      });
    }

    if (comandos.length > 0) {
      logger.info('comandos_entregues', {
        requestId: req.requestId, device: DEVICE_ID, count: comandos.length,
      });
    }

    return res.json({
      ok: true,
      device: DEVICE_ID,
      count: comandos.length,
      commands: comandos.map((c) => ({
        id: c.id,
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
