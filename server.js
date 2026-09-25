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
const { requestId, authLimiter, controlLimiter } = require('./lib/middleware');
const { logger, auditLog } = require('./lib/logger');
const {
  fetchJsonWithRetry, buildLastUrl, buildHistoryUrl,
} = require('./lib/thingspeak');
const { montarComando } = require('./lib/control');

const MONGODB_URI = getMongoUri();

if (!isThingSpeakConfigured) {
  logger.warn('thingspeak_nao_configurado', { hint: 'Defina TS_CHANNEL no .env' });
}

const User       = require('./models/User');
const AccessLog  = require('./models/AccessLog');



/**
 * Rota /api/control — proxy MQTT para controlo dos atuadores (caminho LOCAL).
 *
 * Este caminho continua válido e é o que dá resposta imediata quando o
 * `server.js` corre na mesma rede do broker. Na Vercel o comando segue outro
 * caminho: a fila de `api/control.js` (ADR-0007), porque serverless não
 * alcança a rede local.
 *
 * O ESP32 (estufa45) escuta comandos nos tópicos:
 *   fazenda/estufa01/atuador/vent_001/comando   → {command:ON|OFF|AUTO}
 *   fazenda/estufa01/atuador/valv_001/comando   → {command:ON|OFF|AUTO}
 *   fazenda/estufa01/atuador/ilum_001/comando   → {duty:0-100} ou {command:AUTO}
 *
 * Requer POST com JSON:
 *   { actuator: 'vent'|'valve'|'light', action: 'on'|'off'|'auto'|<0-100> }
 */
const mqtt = require('mqtt');

const LOCAL_MQTT_BROKER = process.env.LOCAL_MQTT_BROKER || 'mqtt://192.168.100.3:1883';
const MQTT_CONNECT_TIMEOUT_MS = 2000;

/**
 * Cliente MQTT ÚNICO, criado sob demanda; o mqtt.js reconecta sozinho
 * (reconnectPeriod). Não se cria um cliente novo por chamada: a versão
 * anterior criava um cliente a cada pedido enquanto desconectado, o que
 * vazava conexões e — pior — handlers `close/error` de clientes antigos
 * podiam anular o cliente novo (corrida, ENGENHARIA §12.2).
 */
let mqttClient = null;
function getMqttClient() {
  if (!mqttClient) {
    mqttClient = mqtt.connect(LOCAL_MQTT_BROKER, {
      clientId: 'estufa_srv_' + Math.random().toString(16).slice(2, 10),
      reconnectPeriod: 5000,
      connectTimeout: 4000,
    });
    mqttClient.on('connect', () => logger.info('mqtt_broker_conectado', { broker: LOCAL_MQTT_BROKER }));
    mqttClient.on('error', (err) => logger.warn('mqtt_broker_erro', { message: err.message }));
  }
  return mqttClient;
}

/** Espera a ligação ficar pronta sem bloquear indefinidamente (ENGENHARIA §11.1). */
function aguardarBrokerConectado(client, timeoutMs) {
  if (client.connected) return Promise.resolve(true);
  return new Promise((resolve) => {
    const aoConectar = () => { clearTimeout(timer); resolve(true); };
    const timer = setTimeout(() => { client.removeListener('connect', aoConectar); resolve(false); }, timeoutMs);
    client.once('connect', aoConectar);
  });
}

/** Publica aguardando o callback — o erro é tratado ANTES de responder OK (§16.1). */
function publicarMqtt(client, topico, mensagem) {
  return new Promise((resolve, reject) => {
    client.publish(topico, mensagem, (err) => (err ? reject(err) : resolve()));
  });
}

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


// ── CONTROL (caminho LOCAL: publica direto no broker MQTT da rede da estufa).
// Na Vercel o mesmo contrato é servido pela fila de api/control.js (ADR-0007).
// Autorização ANTES da lógica + rate-limit próprio (ENGENHARIA §9.2, §14.2).
app.post('/api/control', requireAuthApi, controlLimiter, async (req, res) => {
  const { actuator, action } = req.body || {};
  if (!actuator || action === undefined)
    return sendProblem(req, res, 'VALIDATION', 'Informe actuator e action.');

  // Contrato (tópico + payload) partilhado com a fila da nuvem — uma regra só.
  const comando = montarComando(actuator, action);
  if (comando.erro)
    return sendProblem(req, res, 'VALIDATION', comando.erro);

  try {
    const client = getMqttClient();
    // Espera curta pela ligação: sem ela, o primeiro comando logo após o
    // broker voltar seria recusado com 502 apesar de o broker já estar de pé.
    if (!(await aguardarBrokerConectado(client, MQTT_CONNECT_TIMEOUT_MS)))
      return sendProblem(req, res, 'UPSTREAM', 'Broker MQTT local indisponivel. Tente novamente.');

    // Publish aguardado: antes, o callback podia responder Erro DEPOIS do
    // res.json({ok:true}), produzindo "Cannot set headers after they are sent".
    try {
      await publicarMqtt(client, comando.topico, JSON.stringify(comando.payload));
    } catch (publishErr) {
      return sendProblem(req, res, 'UPSTREAM', 'Falha ao publicar comando.', publishErr);
    }

    await log(null, req.user?.username || 'desconhecido', 'control_' + actuator, req, { action });
    return res.json({ ok: true, actuator, action, payload: comando.payload });
  } catch (err) {
    return sendProblem(req, res, 'INTERNAL', 'Erro ao enviar comando.', err);
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
/* ── GRACEFUL SHUTDOWN (ENGENHARIA §17.1) ──
   Fecha a ligação MQTT e o servidor HTTP antes de sair, em vez de o
   processo morrer a meio de um pedido. */
let httpServer = null;

function shutdown(sinal) {
  logger.info('shutdown_solicitado', { sinal });
  try { if (mqttClient) mqttClient.end(true); } catch { /* já fechado */ }
  if (!httpServer) { process.exit(0); return; }
  httpServer.close(() => process.exit(0));
  // Rede de segurança: não fica pendurado indefinidamente.
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

if (require.main === module) {
mongoose.connect(MONGODB_URI)
  .then(() => {
    logger.info('db_conectado', {});
    httpServer = app.listen(PORT, () => {
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