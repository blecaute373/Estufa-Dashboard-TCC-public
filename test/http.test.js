/**
 * Estufa 01 — Teste Medium: app Express sem DB nem rede.
 *
 * Sobe o `server.js` com stubs de Mongoose (sem Mongo real) e stub de
 * fetch ThingSpeak, exercendo HTTP de verdade em localhost (Medium, §5.2).
 */
'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = 'segredo-de-teste-com-32-caracteres-minimo';
process.env.TS_CHANNEL = '123';
process.env.TS_API_KEY = 'KEY';
process.env.MONGODB_URI = 'mongodb://localhost:27017/estufa_teste';

const Module = require('module');
const mongoose = require('mongoose');

let app;
let server;
let baseUrl;

before(async () => {
  // Stub: nunca liga a Mongo real neste teste.
  mongoose.connect = async () => ({});
  // Models exigem schemas registados — usa stubs por cima dos requires.
  const userStub = { findOne: async () => null, findById: () => ({ select: async () => null }), countDocuments: async () => 0 };
  const logStub = { create: async () => ({}), find: () => ({ populate: () => ({ sort: () => ({ skip: () => ({ limit: () => ({ lean: async () => [] }) }) }) }) }) };
  // O SystemLog tem de ser interceptado também: o `server.js` liga-o à ponte
  // logger→Mongo no arranque, e o Mongoose real passaria 10 s em *buffering*
  // por cada registo (bufferCommands só é desligado em `api/db.js`).
  const sysLogStub = { create: async () => ({}) };

  const origRequire = Module.prototype.require;
  Module.prototype.require = function (id) {
    if (id.endsWith('models/User') || id === './models/User') return userStub;
    if (id.endsWith('models/AccessLog') || id === './models/AccessLog') return logStub;
    if (id.endsWith('models/SystemLog') || id === './models/SystemLog') return sysLogStub;
    return origRequire.apply(this, arguments);
  };

  app = origRequire.call(module, '../server.js');
  Module.prototype.require = origRequire;

  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

describe('http (Medium, sem DB real)', () => {
  it('GET /api/health responde ok + X-Request-Id', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.status, 200);
    assert.ok(res.headers.get('x-request-id'), 'deveria expor X-Request-Id');
    const body = await res.json();
    assert.equal(body.ok, true);
  });

  it('POST /api/auth/register sem campos → 400 Problem Details', async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.title, 'Pedido inválido');
    assert.ok(body.requestId, 'deveria incluir requestId para suporte');
  });

  it('GET /api/admin/logs sem token → 401 (não redirect)', async () => {
    const res = await fetch(`${baseUrl}/api/admin/logs`, { redirect: 'manual' });
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.status, 401);
  });

  it('rate-limit responde 429 Problem Details após 20 tentativas', async () => {
    let lastStatus = 0;
    for (let i = 0; i < 25; i += 1) {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'x', password: 'y' }),
      });
      lastStatus = res.status;
      await res.arrayBuffer();
      if (lastStatus === 429) break;
    }
    assert.equal(lastStatus, 429);
  });
});
