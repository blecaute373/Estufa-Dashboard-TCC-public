/**
 * Estufa 01 — Teste Medium: PARIDADE entre `server.js` (dev) e `api/index.js` (Vercel).
 *
 * Este é o teste que impede a divergência que o ADR-0003 existe para evitar.
 * As rotas estavam duplicadas à mão nos dois ficheiros, e a duplicação divergiu:
 * `/api/control` local aceitava qualquer utilizador autenticado enquanto a
 * versão serverless exigia admin — o caminho de produção era o MAIS restrito.
 * Um teste que só dissesse "ambos respondem 401 sem sessão" não apanharia isso;
 * o que apanha é comparar os STATUS lado a lado, rota a rota.
 *
 * Sem DB nem Redis reais: `models/*` e `lib/store.js` são substituídos por
 * stubs antes de qualquer `require` das duas entradas.
 */
'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = 'segredo-de-teste-com-32-caracteres-minimo';
process.env.TS_CHANNEL = '123';
process.env.TS_API_KEY = 'KEY';
process.env.MONGODB_URI = 'mongodb://localhost:27017/estufa_teste';
process.env.DEVICE_TOKEN = 'token-de-dispositivo-teste';
process.env.DEVICE_ID = 'estufa01';

const Module = require('module');
const mongoose = require('mongoose');

// Rotas cujo status tem de ser IDÊNTICO nos dois ambientes. Só entram rotas
// cujo resultado não depende de dados (sem sessão → 401/404/400 determinístico).
const ROTAS_PARIDADE = [
  { metodo: 'GET', rota: '/api/auth/me', esperado: 401 },
  { metodo: 'GET', rota: '/api/admin/logs', esperado: 401 },
  { metodo: 'GET', rota: '/api/admin/users', esperado: 401 },
  { metodo: 'POST', rota: '/api/control', esperado: 401 },
  { metodo: 'POST', rota: '/api/control', esperado: 401, corpo: { actuator: 'vent', action: 'on' } },
  { metodo: 'GET', rota: '/api/nao-existe', esperado: 404 },
  { metodo: 'POST', rota: '/api/auth/login', esperado: 400, corpo: {} },
];

let serverDev;
let serverProd;
let devUrl;
let prodUrl;

function subir(app) {
  return new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
}

before(async () => {
  mongoose.connect = async () => ({});

  const userStub = {
    findOne: async () => null,
    findById: () => ({ select: async () => null }),
    countDocuments: async () => 0,
    find: () => ({ select: () => ({ sort: () => ({ lean: async () => [] }) }) }),
  };
  const logStub = {
    create: async () => ({}),
    find: () => ({
      populate: () => ({ sort: () => ({ skip: () => ({ limit: () => ({ lean: async () => [] }) }) }) }),
    }),
  };
  // Stub de Redis: o teste de paridade não deve tocar na fila real.
  const storeStub = {
    enfileirarComando: async () => ({}),
    retirarComandos: async () => ({ comandos: [], expirados: 0 }),
  };

  const origRequire = Module.prototype.require;
  Module.prototype.require = function (id) {
    if (id.endsWith('models/User') || id === './models/User') return userStub;
    if (id.endsWith('models/AccessLog') || id === './models/AccessLog') return logStub;
    if (id.endsWith('lib/store') || id === './lib/store') return storeStub;
    return origRequire.apply(this, arguments);
  };
  try {
    serverDev = await subir(origRequire.call(module, '../server.js'));
    serverProd = await subir(origRequire.call(module, '../api/index.js'));
  } finally {
    Module.prototype.require = origRequire;
  }

  devUrl = `http://127.0.0.1:${serverDev.address().port}`;
  prodUrl = `http://127.0.0.1:${serverProd.address().port}`;
});

after(async () => {
  await new Promise((r) => serverDev.close(r));
  await new Promise((r) => serverProd.close(r));
});

describe('paridade dev/prod: as duas entradas devolvem o mesmo status', () => {
  for (const { metodo, rota, esperado, corpo } of ROTAS_PARIDADE) {
    const rotulo = `${metodo} ${rota}${corpo ? ' com corpo' : ''}`;

    it(`${rotulo} → ${esperado} em AMBOS`, async () => {
      const opcoes = { method: metodo, redirect: 'manual' };
      if (corpo) {
        opcoes.headers = { 'Content-Type': 'application/json' };
        opcoes.body = JSON.stringify(corpo);
      }

      const [dev, prod] = await Promise.all([
        fetch(`${devUrl}${rota}`, opcoes),
        fetch(`${prodUrl}${rota}`, opcoes),

      ]);

      assert.equal(
        dev.status,
        prod.status,
        `DIVERGIU em ${rotulo}: server.js=${dev.status} vs api/index.js=${prod.status}. ` +
          'O ADR-0003 exige paridade dev/prod.'
      );
      assert.equal(dev.status, esperado, `${rotulo} devolveu ${dev.status}, esperava ${esperado}`);
    });
  }
});
describe('assimetrias INTENCIONAIS entre dev e prod (Medium)', () => {
  // O poll do ESP32 só existe na nuvem: é a fila de comandos da ADR-0007.
  // Localmente o comando é entregue por MQTT ao broker da rede da estufa
  // (`server.js` → Mosquitto), que não passa por HTTP. Não é uma divergência
  // de paridade a corrigir — é o desenho. Fica registado para que, se alguém
  // decidir implementar o poll também no local, saiba que este teste o exige.
  it('/api/control/pending: 401 na nuvem (fila), 404 no local (não existe por desenho)', async () => {
    const [dev, prod] = await Promise.all([
      fetch(`${devUrl}/api/control/pending`),
      fetch(`${prodUrl}/api/control/pending`),
    ]);
    assert.equal(prod.status, 401, 'a fila tem de continuar a exigir X-Device-Token');
    assert.equal(dev.status, 404, 'o caminho local não tem poll de fila (entrega é por MQTT)');
  });
});



describe('headers de segurança (Medium)', () => {
  it('devolve nosniff, DENY e no-referrer, e NÃO HSTS em dev', async () => {
    const res = await fetch(`${prodUrl}/api/health`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('x-frame-options'), 'DENY');
    assert.equal(res.headers.get('referrer-policy'), 'no-referrer');
    // HSTS fora de produção quebraria o dev em http://localhost.
    assert.equal(res.headers.get('strict-transport-security'), null);
  });
});

describe('erros de API em JSON, nunca HTML (Medium)', () => {
  it('rota /api inexistente devolve 404 Problem Details', async () => {
    for (const base of [devUrl, prodUrl]) {
      const res = await fetch(`${base}/api/rota-que-nao-existe`);
      assert.equal(res.status, 404);
      const tipo = res.headers.get('content-type') || '';
      assert.match(tipo, /application\/json/, `resposta devia ser JSON, veio ${tipo}`);
      const body = await res.json();
      assert.equal(body.status, 404);
      assert.equal(body.title, 'Não encontrado');
      assert.ok(body.requestId, 'o erro de API deve trazer requestId');
    }
  });

  it('JSON malformado devolve 400 Problem Details (não a página de erro do Express)', async () => {
    for (const base of [devUrl, prodUrl]) {
      const res = await fetch(`${base}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{ isto nao e json',
      });
      assert.equal(res.status, 400);
      const tipo = res.headers.get('content-type') || '';
      assert.match(tipo, /application\/json/, `resposta devia ser JSON, veio ${tipo}`);
      const body = await res.json();
      assert.equal(body.status, 400);
    }
  });
});
