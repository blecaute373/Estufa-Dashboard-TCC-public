/**
 * Estufa 01 — Testes do diagnóstico da cadeia de controlo (Small)
 *
 * Só as funções PURAS: nada de disco, nada de rede. O I/O do script
 * (`lerFirmware`, `verificarRedis`) é deliberadamente não testado aqui — o que
 * interessa garantir é a REGRA (que token o firmware realmente usa, e o que
 * conta como "parece Upstash"), porque é essa regra que falha em silêncio no
 * campo, com o sintoma errado.
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  extrairToken,
  resolverTokenFirmware,
  pareceTokenUpstash,
} = require('../scripts/check-control-chain');

describe('check:control — leitura do token do firmware (Small)', () => {
  it('lê o literal do main.cpp', () => {
    assert.equal(extrairToken('const char* API_VERCEL_TOKEN = "abc123";', 'main'), 'abc123');
  });

  it('lê o #define do secrets.h', () => {
    assert.equal(extrairToken('#define API_VERCEL_TOKEN "abc123"', 'secrets'), 'abc123');
  });

  it('ignora definição COMENTADA (ainda é exemplo, não configuração)', () => {
    assert.equal(extrairToken('// const char* API_VERCEL_TOKEN = "exemplo";', 'main'), null);
    assert.equal(extrairToken(' * #define API_VERCEL_TOKEN "exemplo"', 'secrets'), null);
    assert.equal(extrairToken('/* const char* API_VERCEL_TOKEN = "x"; */', 'main'), null);
  });

  it('aceita token VAZIO como definição presente (é a falha que o runtime denuncia)', () => {
    assert.equal(extrairToken('const char* API_VERCEL_TOKEN = "";', 'main'), '');
  });

  it('não confunde o comentário do cabeçalho com a definição', () => {
    const texto = [
      '//   API_VERCEL_TOKEN (aqui)  == DEVICE_TOKEN (Vercel)',
      '#ifndef API_VERCEL_TOKEN',
      '  const char* API_VERCEL_TOKEN = "valor-real";',
      '#endif',
    ].join('\n');
    assert.equal(extrairToken(texto, 'main'), 'valor-real');
  });

  it('é defensiva com conteúdo ausente', () => {
    assert.equal(extrairToken(null, 'main'), null);
    assert.equal(extrairToken('int x = 1;', 'main'), null);
  });
});

describe('check:control — precedência secrets.h > main.cpp (Small)', () => {
  it('secrets.h ganha quando define o token', () => {
    assert.deepEqual(
      resolverTokenFirmware({
        secretsTexto: '#define API_VERCEL_TOKEN "do-secrets"',
        mainTexto: 'const char* API_VERCEL_TOKEN = "do-main";',
      }),
      { valor: 'do-secrets', origem: 'secrets.h' }
    );
  });

  it('cai para o main.cpp quando não há secrets.h', () => {
    assert.deepEqual(
      resolverTokenFirmware({
        secretsTexto: null,
        mainTexto: 'const char* API_VERCEL_TOKEN = "do-main";',
      }),
      { valor: 'do-main', origem: 'main.cpp' }
    );
  });

  it('devolve null quando nada define o token', () => {
    assert.deepEqual(resolverTokenFirmware({ secretsTexto: null, mainTexto: 'int x;' }), {
      valor: null,
      origem: null,
    });
  });
});

describe('check:control — heurística "parece token do Upstash" (Small)', () => {
  it('reconhece o perfil do token REST da Upstash (36 [a-z0-9])', () => {
    assert.equal(pareceTokenUpstash('0ic14fz8wjrk5nbmg3yv9qoxdlu76h2satep'), true);
  });

  it('NÃO classifica um DEVICE_TOKEN hex de 64 como Upstash', () => {
    assert.equal(pareceTokenUpstash('a'.repeat(64)), false);
  });

  it('não classifica valores curtos, longos, ou com símbolos', () => {
    assert.equal(pareceTokenUpstash('curto'), false);
    assert.equal(pareceTokenUpstash('a'.repeat(50)), false);
    assert.equal(pareceTokenUpstash('a'.repeat(36) + '-'), false);
    assert.equal(pareceTokenUpstash('A'.repeat(36)), false, 'maiúsculas não são o perfil Upstash');
  });

  it('é defensiva com valores não-string', () => {
    assert.equal(pareceTokenUpstash(undefined), false);
    assert.equal(pareceTokenUpstash(null), false);
    assert.equal(pareceTokenUpstash(12345), false);
  });
});