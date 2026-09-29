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
const { validarComando, montarComando, normalizarDuty } = require('../lib/control');
const { separarValidos, chaveFila, COMMAND_TTL_MS, colapsarPorAtuador } = require('../lib/store');
const { criarCacheTtl, cacheControlPublico } = require('../lib/cache');
const { parseRedisUrl } = require('../lib/config');

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

describe('lib/control — contrato dos comandos (Small)', () => {
  it('vent/valve: on/off/auto viram {command}', () => {
    assert.deepEqual(validarComando('vent', 'on'),  { payload: { command: 'ON' } });
    assert.deepEqual(validarComando('vent', 'off'), { payload: { command: 'OFF' } });
    assert.deepEqual(validarComando('valve', 'auto'), { payload: { command: 'AUTO' } });
  });

  it('light: auto vira {command:AUTO}; numero vira {duty} com clamp 0-100', () => {
    assert.deepEqual(validarComando('light', 'auto'), { payload: { command: 'AUTO' } });
    assert.deepEqual(validarComando('light', 0),   { payload: { duty: 0 } });
    assert.deepEqual(validarComando('light', 100), { payload: { duty: 100 } });
    assert.deepEqual(validarComando('light', 150), { payload: { duty: 100 } });  // clamp acima
    assert.deepEqual(validarComando('light', -5),  { payload: { duty: 0 } });    // clamp abaixo
    assert.deepEqual(validarComando('light', '40'), { payload: { duty: 40 } });  // string numérica
  });

  it('rejeita actuator desconhecido, action inválida e NaN', () => {
    assert.match(validarComando('fan', 'on').erro, /Actuator/);
    assert.match(validarComando('vent', 'talvez').erro, /action deve ser/);
    assert.match(validarComando('light', 'abc').erro, /numero \(duty 0-100\)/);
  });

  // Regressão: `Number(action)` convertia em duty válido valores que o
  // utilizador nunca pediu, e o comando chegava ao firmware como {duty: 0}.
  // Cada valor abaixo passava a validação antiga e era entregue ao relé.
  it('rejeita coerções implícitas do JS que viravam duty 0/1 sem erro', () => {
    for (const action of [[], true, false, null, {}, [5], '50px', '1e3', '0x10', '+50', ' 50 ']) {
      assert.equal(
        validarComando('light', action).erro !== undefined,
        true,
        `esperava rejeitar ${JSON.stringify(action)} (${typeof action})`
      );
    }
  });

  it('rejeita NaN e Infinity como duty', () => {
    assert.equal(validarComando('light', NaN).erro !== undefined, true);
    assert.equal(validarComando('light', Infinity).erro !== undefined, true);
    assert.equal(validarComando('light', -Infinity).erro !== undefined, true);
  });

  it('normalizarDuty aceita o que é legitimo e recusa o resto', () => {
    assert.equal(normalizarDuty(0), 0);
    assert.equal(normalizarDuty(75), 75);
    assert.equal(normalizarDuty(150), 150);      // clamp é feito noutro sitio
    assert.equal(normalizarDuty('75'), 75);
    assert.equal(normalizarDuty('7.5'), 7.5);
    assert.equal(normalizarDuty(''), null);
    assert.equal(normalizarDuty('abc'), null);
    assert.equal(normalizarDuty(null), null);
    assert.equal(normalizarDuty(undefined), null);
    assert.equal(normalizarDuty([]), null);
    assert.equal(normalizarDuty(true), null);
  });

  it('montarComando junta o topico MQTT do firmware (contrato unico dos 2 caminhos)', () => {
    assert.deepEqual(montarComando('vent', 'on'), {
      topico: 'fazenda/estufa01/atuador/vent_001/comando',
      payload: { command: 'ON' },
    });
    assert.deepEqual(montarComando('valve', 'off'), {
      topico: 'fazenda/estufa01/atuador/valv_001/comando',
      payload: { command: 'OFF' },
    });
    assert.deepEqual(montarComando('light', 50), {
      topico: 'fazenda/estufa01/atuador/ilum_001/comando',
      payload: { duty: 50 },
    });
  });
});

describe('lib/store — fila Upstash Redis (Small, ADR-0008)', () => {
  const agora = 1_000_000_000;

  it('a chave é por dispositivo (a fila não é partilhada entre estufas)', () => {
    assert.equal(chaveFila('estufa01'), 'estufa:comandos:estufa01');
    assert.notEqual(chaveFila('estufa01'), chaveFila('estufa02'));
    assert.equal(chaveFila(undefined), 'estufa:comandos:estufa01', 'default igual ao DEVICE_ID');
  });

  it('descarta o que já expirou e devolve o resto (substitui o TTL index do Mongo)', () => {
    const itens = [
      { id: 'a', expires_at: agora - 1 },     // expirado (1 ms atrás)
      { id: 'b', expires_at: agora + 1000 },  // válido
      { id: 'c', expires_at: agora - 1 },
      { id: 'd', expires_at: agora + 60_000 }, // válido
    ];
    const r = separarValidos(itens, agora);
    assert.deepEqual(r.validos.map((c) => c.id), ['b', 'd']);
    assert.equal(r.expirados, 2);
  });

  it('o limite de validade é exactamente o do TTL index antigo (5 min)', () => {
    assert.equal(COMMAND_TTL_MS, 5 * 60 * 1000);
  });

  it('fronteira: expira quando expires_at é IGUAL ao instante do poll', () => {
    const r = separarValidos([{ id: 'x', expires_at: agora }], agora);
    assert.equal(r.validos.length, 0, 'expires_at <= agora conta como expirado');
    assert.equal(r.expirados, 1);
  });

  it('comando sem expires_at é aceite (fila escrita por versão anterior)', () => {
    const r = separarValidos([{ id: 'antigo' }], agora);
    assert.equal(r.validos.length, 1, 'não descartar em massa dados sem validade');
    assert.equal(r.expirados, 0);
  });

  it('fila vazia devolve listas vazias sem lancar', () => {
    assert.deepEqual(separarValidos([], agora), { validos: [], expirados: 0 });
    assert.deepEqual(separarValidos(null, agora), { validos: [], expirados: 0 });
  });
});

describe('lib/config — REDIS_URL numa string so (Small, ADR-0008)', () => {
  const HOST = 'https://us1-gato-feliz-12345.upstash.io';
  const TOKEN = 'AbCdEf0123456789';

  it('formato ?_token= (o que a documentacao da Upstash mostra)', () => {
    assert.deepEqual(parseRedisUrl(`${HOST}/?_token=${TOKEN}`), { url: HOST, token: TOKEN });
  });

  it('formato userinfo: token antes do @', () => {
    assert.deepEqual(parseRedisUrl(`https://${TOKEN}@us1-gato-feliz-12345.upstash.io`), {
      url: HOST,
      token: TOKEN,
    });
  });

  it('formato userinfo com default:token@', () => {
    assert.deepEqual(parseRedisUrl(`https://default:${TOKEN}@us1-gato-feliz-12345.upstash.io`), {
      url: HOST,
      token: TOKEN,
    });
  });

  it('NUNCA devolve o token dentro do url (o SDK envia o header Bearer)', () => {
    for (const entrada of [
      `${HOST}/?_token=${TOKEN}`,
      `https://${TOKEN}@us1-gato-feliz-12345.upstash.io`,
      `https://default:${TOKEN}@us1-gato-feliz-12345.upstash.io`,
    ]) {
      const r = parseRedisUrl(entrada);
      assert.equal(r.url.includes(TOKEN), false, `token vazou no url: ${r.url}`);
      assert.equal(r.token, TOKEN);
    }
  });

  it('ignora espacos em volta (copiar/colar do console costuma trazer)', () => {
    assert.deepEqual(parseRedisUrl(`  ${HOST}/?_token=${TOKEN}  `), { url: HOST, token: TOKEN });
  });

  it('aceita o parametro ?token= sem underscore', () => {
    assert.deepEqual(parseRedisUrl(`${HOST}/?token=${TOKEN}`), { url: HOST, token: TOKEN });
  });

  it('URL sem token → erro que diz COMO resolver', () => {
    assert.throws(() => parseRedisUrl(HOST), /sem token.*\?_token=/s);
  });

  it('URL de TCP (rediss://) → erro que aponta para o endpoint HTTPS', () => {
    assert.throws(
      () => parseRedisUrl(`rediss://default:${TOKEN}@us1-gato-feliz-12345.upstash.io:6379`),
      /URL de TCP/
    );
  });

  it('vazio/ausente → erro com o nome da variavel', () => {
    assert.throws(() => parseRedisUrl(''), /REDIS_URL/);
    assert.throws(() => parseRedisUrl(undefined), /REDIS_URL/);
    assert.throws(() => parseRedisUrl(null), /REDIS_URL/);
  });

  it('lixo que nao e URL → erro, nunca um token inventado', () => {
    assert.throws(() => parseRedisUrl('nao-e-um-url'), /REDIS_URL invalida|REDIS_URL/);
  });
});

describe('lib/cache — TTL + coalescência (Small)', () => {
  it('serve da cache dentro do TTL e volta ao upstream depois de expirar', async () => {
    let agora = 1000;
    let chamadas = 0;
    const cache = criarCacheTtl({ ttlMs: 8000, agora: () => agora });
    const buscar = async () => { chamadas += 1; return { valor: chamadas }; };

    assert.deepEqual(await cache.obterOuCarregar('k', buscar), { valor: 1 });
    agora += 7999;   // 1 ms antes de expirar
    assert.deepEqual(await cache.obterOuCarregar('k', buscar), { valor: 1 }, 'dentro do TTL é cache hit');
    assert.equal(chamadas, 1, 'não repetiu a ida ao upstream');

    agora += 1;      // 8000 ms: expirou
    assert.deepEqual(await cache.obterOuCarregar('k', buscar), { valor: 2 });
    assert.equal(chamadas, 2, 'depois do TTL vai buscar de novo');
  });

  it('pedidos simultâneos com cache fria partilham UMA ida ao upstream', async () => {
    let chamadas = 0;
    let libertar;
    const bloqueio = new Promise((r) => { libertar = r; });
    const cache = criarCacheTtl({ ttlMs: 8000 });
    const buscar = async () => { chamadas += 1; await bloqueio; return 'dado'; };

    const emParalelo = Promise.all([
      cache.obterOuCarregar('k', buscar),
      cache.obterOuCarregar('k', buscar),
      cache.obterOuCarregar('k', buscar),
    ]);
    libertar();      // o primeiro fetch ainda está em curso quando os outros chegam
    assert.deepEqual(await emParalelo, ['dado', 'dado', 'dado']);
    assert.equal(chamadas, 1, 'coalescência: 3 pedidos, 1 fetch');
  });

  it('falha NÃO fica em cache (erro transitório não contamina a janela de 8 s)', async () => {
    let chamadas = 0;
    const cache = criarCacheTtl({ ttlMs: 8000 });
    const buscar = async () => {
      chamadas += 1;
      if (chamadas === 1) throw new Error('upstream em baixo');
      return 'ok';
    };

    await assert.rejects(() => cache.obterOuCarregar('k', buscar), /upstream em baixo/);
    assert.equal(cache.tamanho(), 0, 'nada foi guardado');
    assert.equal(await cache.obterOuCarregar('k', buscar), 'ok', 'a tentativa seguinte é limpa');
    assert.equal(chamadas, 2);
  });

  it('limite de entradas evicta a mais antiga (memória limitada)', () => {
    const cache = criarCacheTtl({ ttlMs: 8000, max: 2 });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    assert.equal(cache.get('a'), undefined, 'a mais antiga saiu');
    assert.equal(cache.get('b'), 2);
    assert.equal(cache.get('c'), 3);
    assert.equal(cache.tamanho(), 2);
  });

  it('cacheControlPublico segue o TTL em segundos (browser dedupe)', () => {
    assert.equal(cacheControlPublico(8000), 'public, max-age=8');
    assert.equal(cacheControlPublico(1500), 'public, max-age=1');
  });
});

describe('lib/store — colapso por atuador (Small)', () => {
  const cmd = (actuator, created_at, action = 'on') => ({ id: `${actuator}-${created_at}`, actuator, action, created_at });

  // A ordem de saída do `LPOP` sobre `LPUSH` é LIFO: o mais novo chega
  // primeiro. Esta é exactamente a lista que o dispositivo receberia.
  it('mantém só o comando mais recente de cada atuador', () => {
    const r = colapsarPorAtuador([
      cmd('vent', 300, 'off'),
      cmd('vent', 200, 'on'),
      cmd('vent', 100, 'off'),
    ]);
    assert.equal(r.comandos.length, 1);
    assert.equal(r.comandos[0].action, 'off', 'o estado final é a última intenção do admin');
    assert.equal(r.colapsados, 2);
  });

  it('não toca em atuadores diferentes', () => {
    const r = colapsarPorAtuador([cmd('vent', 300), cmd('light', 200), cmd('valve', 100)]);
    assert.equal(r.comandos.length, 3);
    assert.equal(r.colapsados, 0);
  });

  it('em empate de created_at fica o primeiro visto (o mais recente, em LIFO)', () => {
    const r = colapsarPorAtuador([cmd('vent', 100, 'novo'), cmd('vent', 100, 'antigo')]);
    assert.equal(r.comandos.length, 1);
    assert.equal(r.comandos[0].action, 'novo');
  });

  it('comando sem actuator passa tal e qual (nunca descartado em silêncio)', () => {
    const r = colapsarPorAtuador([{ id: 'x', action: 'on' }, cmd('vent', 10)]);
    assert.equal(r.comandos.length, 2);
    assert.equal(r.colapsados, 0);
  });

  it('lista vazia/null devolve vazio sem lançar', () => {
    assert.deepEqual(colapsarPorAtuador([]), { comandos: [], colapsados: 0 });
    assert.deepEqual(colapsarPorAtuador(null), { comandos: [], colapsados: 0 });
  });
});
