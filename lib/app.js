/**
 * Estufa 01 — Montagem partilhada da app Express (ADR-0003)
 *
 * PORQUÊ ESTE FICHEIRO: as duas entradas do sistema (`server.js` para o local,
 * `api/index.js` para a Vercel) estavam a montar a MESMA app à mão, cada uma
 * com a sua cópia dos mesmos dez blocos. A duplicação já tinha divergido uma
 * vez — `/api/control` local aceitava qualquer autenticado enquanto o
 * serverless exigia admin — e `test/parity.test.js` existe para travar novas
 * divergências. Duplicar menos é a correção na raiz: o que está aqui corre
 * igual nos dois ambientes, e o que é genuinamente diferente (MQTT local vs
 * fila na nuvem) fica explícito em cada entrada.
 *
 * O que NÃO vem para cá, de propósito:
 *   - a rota `/api/control` — local publica no broker MQTT da estufa,
 *     serverless enfileira no Redis (ADR-0007). Duas implementações, um
 *     contrato (lib/control.js, test/parity.test.js).
 *   - o arranque (listen/Mongo do local, runtime da Vercel) e o shutdown.
 */
'use strict';

const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');

const { requireAuthPage, requireAdminPage } = require('./auth');
const { requestId, securityHeaders } = require('./middleware');
const { sendProblem } = require('./errors');
const { isThingSpeakConfigured } = require('./config');

/**
 * Middlewares base, na ORDEM que importa:
 *
 * 1. `trust proxy` — sem isto, atrás do proxy da Vercel `req.ip` é o IP do
 *    proxy e o rate limiting conta todos os utilizadores no mesmo bucket.
 * 2. `requestId` ANTES de `express.json()` — um corpo JSON malformado faz o
 *    body-parser lançar, e sem requestId registado o erro saía sem forma de o
 *    correlacionar com o log (§9.1).
 * 3. Limite de corpo 32 kB: nada nesta API se aproxima disso, e um limite
 *    explícito evita que um pedido grande consuma memória da função.
 * 4. `securityHeaders()` por último, para aplicar também às respostas de erro.
 */
function montarBase(app) {
  app.set('trust proxy', 1);
  app.use(requestId);
  app.use(express.json({ limit: '32kb' }));
  app.use(cookieParser());
  app.use(securityHeaders());
}

/**
 * Rotas de página.
 *
 * As duas páginas de login são públicas (é onde se autentica); o dashboard e o
 * admin exigem sessão, e o admin exige `is_admin` — quem não for volta ao
 * dashboard com um aviso, em vez de ver um 403 seco numa página HTML.
 */
function rotasDePaginas(app, dirPublico) {
  const ficheiro = (nome) => path.join(dirPublico, nome);
  const requireAuth = requireAuthPage('/index.html');
  const requireAdminPageMw = requireAdminPage('/index.html', '/dashboard.html?error=restrito');

  app.get('/login-dashboard.html', (req, res) => res.sendFile(ficheiro('login-dashboard.html')));
  app.get('/login-admin.html', (req, res) => res.sendFile(ficheiro('login-admin.html')));
  app.get('/dashboard.html', requireAuth, (req, res) => res.sendFile(ficheiro('dashboard.html')));
  app.get('/admin.html', requireAdminPageMw, (req, res) => res.sendFile(ficheiro('admin.html')));
  // A raiz entrega o dashboard (o login vive em /index.html) — ver BLUEPRINT §8.
  app.get('/', requireAuth, (req, res) => res.sendFile(ficheiro('dashboard.html')));
}

/**
 * Health check (§9.2). Uma rota, duas entradas: inclui o estado do ThingSpeak
 * porque era a única diferença entre as versões (`server.js` dizia-o, o
 * serverless não) e um monitor externo merece a mesma informação nos dois.
 */
function rotaHealth(app) {
  app.get('/api/health', (req, res) => {
    res.json({ ok: true, uptime: process.uptime(), thingspeak: isThingSpeakConfigured });
  });
}

/**
 * Fecho da app. A ORDEM é o contrato — foi uma ordem errada que produziu o
 * bug de `/api/*` responder 200 com HTML do `index.html`, e um corpo HTML
 * onde o cliente esperava JSON:
 *
 *   1. `/api` inexistente → 404 Problem Details (nunca o fallback de páginas);
 *   2. estáticos públicos;
 *   3. fallback de página (só no serverless, onde o HTML não é servido pelo
 *      Edge — a Vercel só trata `public/**\/*.!(html)` como estático);
 *   4. error handler final de 4 argumentos, com a mesma normalização RFC 9457
 *      das respostas normais (sem ele, o Express devolvia a sua página HTML de
 *      erro, com stack em dev).
 */
function fecharApp(app, { dirPublico, fallbackSpa = false } = {}) {
  app.use('/api', (req, res) => {
    sendProblem(req, res, 'NOT_FOUND', 'Endpoint inexistente.');
  });

  app.use(express.static(dirPublico));

  if (fallbackSpa) {
    app.get('*', (req, res) => res.sendFile(path.join(dirPublico, 'index.html')));
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const isBadJson = err?.type === 'entity.parse.failed' || err instanceof SyntaxError;
    const code = isBadJson ? 'VALIDATION' : 'INTERNAL';
    const publicDetail = isBadJson ? 'Corpo JSON inválido.' : 'Erro interno. Tente novamente.';
    return sendProblem(req, res, code, publicDetail, err);
  });
}

module.exports = { montarBase, rotasDePaginas, rotaHealth, fecharApp };
