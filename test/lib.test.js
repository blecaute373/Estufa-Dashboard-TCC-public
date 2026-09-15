/**
 * Estufa 01 — Testes (ENGENHARIA §5: pirâmide — Small com fakes, sem I/O)
 *
 * Roda com o runner nativo: `npm test` (node --test).
 * Sem dependências novas (KISS/YAGNI para o contexto do projeto).
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  validateRegister,
  normalizeLogin,
  parsePagination,
  parseResults,
} = require('../lib/validators');
const { problem } = require('../lib/errors');
const { isTransientError, backoffDelay, buildLastUrl, buildHistoryUrl } = require('../lib/thingspeak');

describe('validators (Small)', () => {
  it('aceita registo válido', () => {
    assert.equal(
      validateRegister({ username: 'maria_01', email: 'maria@exemplo.com', password: 'segura123' }),
      null
    );
  });

  it('rejeita username curto/inválido', () => {
    assert.match(validateRegister({ username: 'ab', email: 'a@b.com', password: 'segura123' }), /Usuário/);
    assert.match(validateRegister({ username: 'com espaço', email: 'a@b.com', password: 'segura123' }), /Usuário/);
  });

  it('rejeita e-mail inválido e senha curta', () => {
    assert.equal(validateRegister({ username: 'maria', email: 'nao-email', password: 'segura123' }), 'E-mail inválido.');
    assert.equal(validateRegister({ username: 'maria', email: 'm@b.com', password: 'curta' }), 'Senha mínima: 8 caracteres.');
  });

  it('normaliza login (trim + lowercase)', () => {
    assert.equal(normalizeLogin('  Maria@Exemplo.COM '), 'maria@exemplo.com');
  });

  it('paginação defensiva limita e nunca negativa', () => {
    assert.deepEqual(parsePagination({ limit: '9999', offset: '-5' }), { limit: 500, offset: 0 });
    assert.deepEqual(parsePagination({}), { limit: 100, offset: 0 });
  });

  it('results do ThingSpeak é limitado', () => {
    assert.equal(parseResults({ results: '99999' }), 800);
    assert.equal(parseResults({}), 60);
  });
});

describe('errors (Small)', () => {
  it('problem() nunca expõe detalhe interno sem pedir', () => {
    const { status, body } = problem({ code: 'INTERNAL', detail: 'Erro interno. Tente novamente.', requestId: 'abc' });
    assert.equal(status, 500);
    assert.equal(body.title, 'Erro interno');
    assert.equal(body.requestId, 'abc');
    assert.ok(body.type.includes('internal'));
  });

  it('código desconhecido cai em INTERNAL', () => {
    const { status } = problem({ code: 'INEXISTENTE', detail: 'x' });
    assert.equal(status, 500);
  });
});

describe('thingspeak resilience (Small)', () => {
  it('classifica erro transitório vs permanente', () => {
    assert.equal(isTransientError(Object.assign(new Error('socket hang up'), {})), true);
    assert.equal(isTransientError(Object.assign(new Error('x'), { statusCode: 503 })), true);
    assert.equal(isTransientError(Object.assign(new Error('x'), { statusCode: 429 })), true);
    assert.equal(isTransientError(Object.assign(new Error('x'), { statusCode: 404 })), false);
    assert.equal(isTransientError(new Error('Resposta inválida do ThingSpeak')), false);
  });

  it('backoff cresce exponencialmente', () => {
    const d1 = backoffDelay(1, 500);
    const d2 = backoffDelay(2, 500);
    const d3 = backoffDelay(3, 500);
    assert.ok(d1 >= 500 && d1 < 750, `d1=${d1}`);
    assert.ok(d2 >= 1000 && d2 < 1250, `d2=${d2}`);
    assert.ok(d3 >= 2000 && d3 < 2250, `d3=${d3}`);
  });

  it('monta URLs do proxy corretamente', () => {
    assert.equal(
      buildLastUrl(123, 'KEY'),
      'https://api.thingspeak.com/channels/123/feeds/last.json?api_key=KEY'
    );
    assert.equal(
      buildHistoryUrl(123, 'KEY', 60),
      'https://api.thingspeak.com/channels/123/feeds.json?api_key=KEY&results=60'
    );
  });
});
