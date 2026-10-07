/**
 * Estufa 01 — Testes do gateway MQTT do navegador (Small, sem rede/browser).
 *
 * REGRESSÃO do bug "sempre mostra conectando ao broker e nunca conecta":
 * o `brokerConectar` antigo ligava `reconnectPeriod: 4000` DURANTE a discagem
 * inicial e o timeout de 6,5 s só resolvia a Promise — sem encerrar o cliente.
 * O retry em segundo plano repintava `connecting` ("A ligar…") para sempre.
 *
 * O que estes testes travam:
 *  1. `reconnectPeriod: 0` na discagem (sem retry infinito antes do 1.º connect);
 *  2. porta 1883 recusada antes de tentar (é TCP, nunca WebSocket);
 *  3. diagnóstico acionável por tipo de erro (não só "connection refused");
 *  4. contrato de payload/tópico intacto após o refactor.
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const gw = require('../public/js/mqtt-gateway');

describe('mqtt-gateway — sem retry infinito na discagem (regressão "A ligar…")', () => {
  it('usa reconnectPeriod 0 no mqtt.connect inicial', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'mqtt-gateway.js'), 'utf8');
    assert.match(src, /reconnectPeriod:\s*0/, 'discagem inicial não deve ter auto-reconnect');
    assert.match(src, /reconnectPeriod\s*=\s*4000/, 'auto-reconnect deve ser religado após o 1.º connect');
  });

  it('timeout encerra o cliente (não só resolve a Promise)', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'mqtt-gateway.js'), 'utf8');
    assert.match(src, /encerrarTentativa/, 'timeout/erro deve encerrar o cliente');
    assert.match(src, /removeAllListeners/, 'listeners do cliente morto não devem repintar a UI');
  });

  it('close após falha resolvida não apaga o estado error', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'mqtt-gateway.js'), 'utf8');
    assert.match(src, /if\s*\(resolvido\)\s*return/, 'close tardio não deve sobrescrever o diagnóstico');
  });

  it('porta 1883 é recusada antes de tentar (nunca fala WebSocket)', async () => {
    const r = await gw.brokerConectar({ host: '192.168.0.6', port: 1883, path: '/mqtt', tls: false });
    assert.equal(r.ok, false);
    assert.match(r.erro, /1883/, 'deveria explicar que 1883 é TCP');
  });

  it('sem host pede o IP antes de tentar', async () => {
    const r = await gw.brokerConectar({ host: '', port: 9001, path: '/mqtt', tls: false });
    assert.equal(r.ok, false);
    assert.match(r.erro, /IP\/host/);
  });
});

describe('mqtt-gateway — diagnóstico acionável por tipo de erro', () => {
  const conf = { host: '192.168.0.6', port: 9001, path: '/mqtt', tls: false };

  it('connection refused aponta o listener websockets', () => {
    const msg = gw.diagnosticarErroBroker(new Error('connection refused'), conf, 'ws://x:9001/mqtt');
    assert.match(msg, /listener 9001.*protocol websockets/);
  });

  it('timeout sugere LAN/firewall e lembra da fila', () => {
    const msg = gw.diagnosticarErroBroker(new Error('connection timed out'), conf, 'ws://x:9001/mqtt');
    assert.match(msg, /LAN|firewall/);
    assert.match(msg, /fila/);
  });

  it('falha WSS aponta certificado do browser', () => {
    const msg = gw.diagnosticarErroBroker(new Error('socket hang up'), { ...conf, tls: true }, 'wss://x:9001/mqtt');
    assert.match(msg, /TLS|certificado/);
  });
});

describe('mqtt-gateway — contrato payload/tópico intacto', () => {
  it('monta ON/OFF/AUTO e duty com clamp 0-100', () => {
    assert.deepEqual(gw.brokerMontarPayload('vent', 'on'), { payload: { command: 'ON' } });
    assert.deepEqual(gw.brokerMontarPayload('valve', 'off'), { payload: { command: 'OFF' } });
    assert.deepEqual(gw.brokerMontarPayload('global', 'pause'), { payload: { command: 'PAUSE' } });
    assert.deepEqual(gw.brokerMontarPayload('global', 'auto'), { payload: { command: 'AUTO' } });
    assert.deepEqual(gw.brokerMontarPayload('light', 150), { payload: { duty: 100 } });
    assert.ok(gw.brokerMontarPayload('light', 'x').erro, 'duty inválido deve falhar');
    assert.ok(gw.brokerMontarPayload('invalido', 'on').erro, 'atuador inválido deve falhar');
  });

  it('tópicos seguem o padrão do firmware', () => {
    assert.equal(gw.brokerTopico('vent'), 'fazenda/estufa01/atuador/vent_001/comando');
    assert.equal(gw.brokerTopico('global'), 'fazenda/estufa01/atuador/global_001/comando');
  });

  it('brokerUrl respeita TLS', () => {
    assert.equal(gw.brokerUrl({ host: 'h', port: 9001, path: '/mqtt', tls: false }), 'ws://h:9001/mqtt');
    assert.equal(gw.brokerUrl({ host: 'h', port: 9001, path: '/mqtt', tls: true }), 'wss://h:9001/mqtt');
  });
});
