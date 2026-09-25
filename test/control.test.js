/**
 * Estufa 01 — Teste Medium: fila de comandos Upstash Redis (ADR-0008) por HTTP real.
 *
 * Sobe `api/control.js` (rotas de /api/control e /api/control/pending) com
 * stubs de `lib/store.js` e de Mongoose: sem Redis real, sem Mongo, sem rede
 * externa. Cobre o que mais importa: autorização antes da lógica (§9.2),
 * validação do contrato, resposta 202 (enfileirado), o token do dispositivo
 * no poll, o descarte de comandos expirados e a entrega ATÓMICA — o requisito
 * que motivou a migração (a antiga corrida find/updateMany).
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
// Fila em memória que reproduz a semântica do LPUSH/LPOP do Redis.
let fila = [];
let criadoCount = 0;

before(async () => {
  mongoose.connect = async () => ({});

  const logStub = { create: async () => ({}) };

  // Stub de lib/store.js com a MESMA superfície usada por api/control.js.
  // `splice` simula o pop atómico: cada comando sai da fila uma única vez,
  // mesmo com polls concorrentes — é exactamente o que o `LPOP` garante.
  let seq = 0;
  const storeStub = {
    enfileirarComando: async ({ device, actuator, action, payload, username, userId }) => {
      criadoCount += 1;
      const cmd = {
        id: `cmd-${++seq}`,
        device,
        actuator,
        action: String(action),
        payload,
        username: username || null,
        user_id: userId || null,
        created_at: Date.now(),
        expires_at: Date.now() + 5 * 60 * 1000,
      };
      fila.push(cmd);   // LPUSH
      return cmd;
    },
    retirarComandos: async (_device, limite) => {
      // LPOP chave N: operação única e atómica.
      const brutos = fila.splice(0, limite);
      const agora = Date.now();
      const comandos = [];
      let expirados = 0;
      for (const c of brutos) {
        if (c.expires_at <= agora) expirados += 1;
        else comandos.push(c);
      }
      return { comandos, expirados };
    },
  };

  const origRequire = Module.prototype.require;
  Module.prototype.require = function (id) {
    if (id.endsWith('lib/store') || id === './store') return storeStub;
    if (id.endsWith('models/AccessLog') || id === './models/AccessLog') return logStub;
    return origRequire.apply(this, arguments);
  };
  app = origRequire.call(module, '../api/control.js');
  Module.prototype.require = origRequire;

  await new Promise((r) => { server = app.listen(0, '127.0.0.1', r); });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => { await new Promise((r) => server.close(r)); });

beforeEach(() => { fila = []; criadoCount = 0; });

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

const poll = () => fetch(`${baseUrl}/api/control/pending`, { headers: DEVICE_TOKEN_HEADER });

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
    assert.ok(body.id, 'deve devolver o id do comando');
    assert.ok(body.expires_at, 'deve devolver a validade (substitui o TTL index)');
    assert.equal(fila.length, 1, 'comando deve estar na fila');
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

  it('a fila guarda a autoria (username) para a trilha de auditoria', async () => {
    await post({ actuator: 'valve', action: 'off' }, `${COOKIE}=${token(true)}`);
    assert.equal(fila[0].username, 'admin', 'a fila regista quem enfileirou');
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
    const res = await poll();
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.count, 0);
    assert.deepEqual(body.commands, []);
  });

  it('recolhe comandos pendentes e esvazia a fila', async () => {
    // Admin enfileira 2 comandos...
    await post({ actuator: 'vent', action: 'on' }, `${COOKIE}=${token(true)}`);
    await post({ actuator: 'light', action: 40 }, `${COOKIE}=${token(true)}`);
    assert.equal(fila.length, 2);

    // ...ESP32 recolhe no poll.
    const res = await poll();
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.count, 2);
    assert.equal(body.commands[0].payload.command, 'ON');
    assert.equal(body.commands[1].payload.duty, 40);
    assert.equal(fila.length, 0, 'os comandos saem da fila na entrega (at-most-once)');
  });

  it('não devolve o mesmo comando duas vezes', async () => {
    await post({ actuator: 'vent', action: 'on' }, `${COOKIE}=${token(true)}`);
    assert.equal((await (await poll()).json()).count, 1);
    assert.equal(
      (await (await poll()).json()).count, 0,
      'o poll seguinte não pode recolher o mesmo comando (pop atómico)'
    );
  });

  it('polls concorrentes nunca entregam o mesmo comando', async () => {
    // Este é O requisito que justifica o Redis: a implementação anterior
    // fazia find() + updateMany() e podia devolver o mesmo comando a dois
    // polls em simultâneo.
    for (let i = 0; i < 5; i += 1)
      await post({ actuator: 'light', action: i * 10 }, `${COOKIE}=${token(true)}`);

    const respostas = await Promise.all(
      Array.from({ length: 5 }, () => poll().then((r) => r.json()))
    );

    const ids = respostas.flatMap((r) => r.commands.map((c) => c.id));
    assert.equal(ids.length, 5, 'os 5 comandos devem ser entregues exatamente uma vez');
    assert.equal(new Set(ids).size, 5, 'nenhum id pode aparecer em duas respostas');
    assert.equal(fila.length, 0, 'a fila fica vazia');
  });

  it('comandos expirados (>5 min) são descartados, não entregues', async () => {
    await post({ actuator: 'vent', action: 'on' }, `${COOKIE}=${token(true)}`);
    // Envelhece o comando como se tivesse sido enfileirado há 6 minutos.
    fila[0].expires_at = Date.now() - 60 * 1000;

    const body = await (await poll()).json();
    assert.equal(body.count, 0, 'comando expirado não pode ser aplicado na estufa');
    assert.equal(fila.length, 0, 'e é removido da fila para não se repetir');
  });

  it('respeita o limite de 10 comandos por poll', async () => {
    for (let i = 0; i < 12; i += 1)
      await post({ actuator: 'light', action: i }, `${COOKIE}=${token(true)}`);

    const body = await (await poll()).json();
    assert.equal(body.count, 10, 'nunca mais de 10 comandos por poll');
    assert.equal(fila.length, 2, 'os restantes ficam para o poll seguinte');
  });
});