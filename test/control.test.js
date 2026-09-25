/**
 * Estufa 01 — Teste Medium: fila de comandos (ADR-0007) por HTTP real.
 *
 * Sobe `api/control.js` (rotas de /api/control e /api/control/pending) com
 * stubs de Mongoose: sem Mongo real, sem broker, sem rede externa.
 * Cobre o que mais importa: autorização antes da lógica (§9.2), validação do
 * contrato, resposta 202 (enfileirado) e o token do dispositivo no poll.
 */
'use strict';

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = 'segredo-de-teste-com-32-caracteres-minimo';
process.env.MONGODB_URI = 'mongodb://localhost:27017/estufa_teste';
process.env.DEVICE_TOKEN = 'token-de-dispositivo-teste';
process.env.DEVICE_ID = 'estufa01';

const Module = require('module');
const mongoose = require('mongoose');
const { signToken } = require('../lib/auth');

const COOKIE = 'estufa_tok';
const DEVICE_TOKEN_HEADER = { 'X-Device-Token': 'token-de-dispositivo-teste' };

let app, server, baseUrl;
// Fila em memória (substitui a collection): guarda o que seria gravado/consultado.
let fila = [];
let criadoCount = 0;
let entregueCount = 0;

before(async () => {
  mongoose.connect = async () => ({});

  const logStub = { create: async () => ({}) };

  // Stub da ControlCommand com a mesma superfície usada por api/control.js.
  // Atencao: `status: 'pending'` e o DEFAULT do schema (models/ControlCommand.js)
  // — o stub tem de reproduzir esse default, senao nao reflecte a.collection real.
  const controlStub = {
    create: async (doc) => {
      criadoCount += 1;
      const salvo = { status: 'pending', ...doc, _id: `cmd-${criadoCount}` };
      fila.push(salvo);
      return salvo;
    },
    find: (filtro) => {
      const qtde = filtro.limit || 100;
      const res = fila.filter((c) => c.status === filtro.status).slice(0, qtde);
      return { sort: () => ({ limit: () => ({ lean: async () => res }) }) };
    },
    updateMany: async (_filtro, update) => {
      for (const c of fila) {
        if (c.status === 'pending' && update.$set) {
          c.status = update.$set.status;
          c.delivered_at = update.$set.delivered_at;
          entregueCount += 1;
        }
      }
      return { modifiedCount: entregueCount };
    },
  };

  const origRequire = Module.prototype.require;
  Module.prototype.require = function (id) {
    if (id.endsWith('models/ControlCommand') || id === './models/ControlCommand') return controlStub;
    if (id.endsWith('models/AccessLog') || id === './models/AccessLog') return logStub;
    return origRequire.apply(this, arguments);
  };
  app = origRequire.call(module, '../api/control.js');
  Module.prototype.require = origRequire;

  await new Promise((r) => { server = app.listen(0, '127.0.0.1', r); });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => { await new Promise((r) => server.close(r)); });

beforeEach(() => { fila = []; criadoCount = 0; entregueCount = 0; });

const token = (isAdmin) => signToken({
  _id: isAdmin ? 'admin-1' : 'user-1',
  username: isAdmin ? 'admin' : 'comum',
  is_admin: isAdmin,
});

async function post(body, cookie) {
  return fetch(`${baseUrl}/api/control`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
  });
}

describe('POST /api/control — enfileirar (admin)', () => {
  it('sem sessão → 401 (autorização antes da lógica)', async () => {
    const res = await post({ actuator: 'vent', action: 'on' });
    assert.equal(res.status, 401);
    assert.equal((await res.json()).status, 401);
    assert.equal(criadoCount, 0, 'não deve enfileirar nada sem autenticação');
  });

  it('admin → 202 queued e grava na fila', async () => {
    const res = await post({ actuator: 'vent', action: 'on' }, `${COOKIE}=${token(true)}`);
    assert.equal(res.status, 202, '202 = enfileirado, não aplicado ainda');
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.queued, true);
    assert.equal(body.payload.command, 'ON');
    assert.equal(fila.length, 1, 'comando deve estar na fila');
    assert.equal(fila[0].status, 'pending');
  });

  it('payload de duty é normalizado/clampado', async () => {
    const res = await post({ actuator: 'light', action: 150 }, `${COOKIE}=${token(true)}`);
    assert.equal(res.status, 202);
    const body = await res.json();
    assert.equal(body.payload.duty, 100, 'duty acima de 100 é limitado a 100');
  });

  it('actuator/action inválidos → 400 Problem Details e não enfileira', async () => {
    for (const payload of [
      { actuator: 'fan', action: 'on' },
      { actuator: 'vent', action: 'talvez' },
      { actuator: 'light', action: 'abc' },
    ]) {
      const res = await post(payload, `${COOKIE}=${token(true)}`);
      assert.equal(res.status, 400, `esperava 400 para ${JSON.stringify(payload)}`);
    }
    assert.equal(criadoCount, 0, 'comandos inválidos não entram na fila');
  });
});

describe('GET /api/control/pending — poll do ESP32', () => {
  it('sem token → 401 (não revela a fila)', async () => {
    const res = await fetch(`${baseUrl}/api/control/pending`);
    assert.equal(res.status, 401);
  });

  it('token errado → 401', async () => {
    const res = await fetch(`${baseUrl}/api/control/pending`, { headers: { 'X-Device-Token': 'errado' } });
    assert.equal(res.status, 401);
  });

  it('com token e fila vazia → 200 count 0', async () => {
    const res = await fetch(`${baseUrl}/api/control/pending`, { headers: DEVICE_TOKEN_HEADER });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.count, 0);
    assert.deepEqual(body.commands, []);
  });

  it('recolhe comandos pendentes e marca como entregues', async () => {
    // Admin enfileira 2 comandos...
    await post({ actuator: 'vent', action: 'on' }, `${COOKIE}=${token(true)}`);
    await post({ actuator: 'light', action: 40 }, `${COOKIE}=${token(true)}`);
    assert.equal(entregueCount, 0);

    // ...ESP32 recolhe no poll.
    const res = await fetch(`${baseUrl}/api/control/pending`, { headers: DEVICE_TOKEN_HEADER });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.count, 2);
    assert.equal(body.commands[0].payload.command, 'ON');
    assert.equal(body.commands[1].payload.duty, 40);
    assert.equal(entregueCount, 2, 'comandos devem sair de pending ao serem entregues');
  });
});