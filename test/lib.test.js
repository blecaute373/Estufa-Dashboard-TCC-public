/**
 * Estufa 01 — Testes (ENGENHARIA §5: pirâmide — Small com fakes, sem I/O)
 *
 * Roda com o runner nativo: `npm test` (node --test).
 * Sem dependências novas (KISS/YAGNI para o contexto do projeto).
 */
'use strict';

const { describe, it, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');

const {
  validateRegister,
  normalizeLogin,
  parsePagination,
  parseResults,
} = require('../lib/validators');
const { problem } = require('../lib/errors');
const { isTransientError, backoffDelay, buildLastUrl, buildHistoryUrl } = require('../lib/thingspeak');
const { validarComando, montarComando } = require('../lib/control');
const syslog = require('../lib/syslog');
const { toSystemRecord, attachSystemLog, _resetBridge } = require('../lib/logbridge');
const { detachSinks, logger } = require('../lib/logger');

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

describe('syslog (Small, sem I/O)', () => {
  beforeEach(() => syslog._reset());
  after(() => syslog._reset());

  it('sysLog guarda em memória com created_at/source/level normalizados', () => {
    const r = syslog.sysLog({ source: 'esp', level: 'warn', tag: 'WIFI', message: 'Desligado' });
    assert.equal(r.source, 'esp');
    assert.equal(r.level, 'warn');
    assert.ok(r.created_at, 'deveria carimbar timestamp');
    assert.ok(!Number.isNaN(Date.parse(r.created_at)), 'created_at deve ser uma data válida');
    assert.equal(syslog.getRecent().length, 1);
  });

  it('source/level inválidos caem no default MAS são reportados', () => {
    const avisos = [];
    const origWarn = console.warn;
    console.warn = (m) => avisos.push(m);
    try {
      const r = syslog.sysLog({ source: 'invasado', level: 'critical', message: 'x' });
      assert.equal(r.source, 'server');
      assert.equal(r.level, 'info');
      assert.equal(avisos.length, 2, 'deveria avisar source e level inválidos');
      assert.match(avisos.join(' '), /invasado/);
    } finally {
      console.warn = origWarn;
    }
  });

  it('o mesmo valor inválido só é reportado uma vez (não inunda o terminal)', () => {
    const avisos = [];
    const origWarn = console.warn;
    console.warn = (m) => avisos.push(m);
    try {
      for (let i = 0; i < 20; i += 1) syslog.sysLog({ source: 'invasado', message: `m${i}` });
      assert.equal(avisos.length, 1, 'deveria deduplicar o aviso');
    } finally {
      console.warn = origWarn;
    }
  });

  it('registos são imutáveis (getRecent não expõe referências mutáveis)', () => {
    const r = syslog.sysLog({ message: 'original' });
    assert.ok(Object.isFrozen(r), 'o registo deveria estar congelado');
    assert.throws(() => { 'use strict'; r.message = 'adulterado'; }, TypeError);
    assert.equal(syslog.getRecent()[0].message, 'original');
  });

  it('o registo que o persister recebe é o mesmo que fica em memória', () => {
    let recebido = null;
    syslog.setPersister((rec) => { recebido = rec; });
    const r = syslog.sysLog({ source: 'esp', message: 'ida e volta' });
    assert.equal(recebido, r, 'deveria ser o mesmo objecto, não uma cópia divergente');
  });

  it('nunca lança sem argumentos', () => {
    assert.doesNotThrow(() => syslog.sysLog());
    assert.equal(syslog.getRecent()[0].message, '');
  });

  it('persister recebe o registo e falha silenciosa não propaga', () => {
    const recebidos = [];
    syslog.setPersister((rec) => { recebidos.push(rec); });
    syslog.sysLog({ message: 'guardado' });
    assert.equal(recebidos.length, 1);

    syslog.setPersister(() => { throw new Error('mongo em baixo'); });
    assert.doesNotThrow(() => syslog.sysLog({ message: 'perdido mas em memória' }));
    assert.equal(syslog.getRecent().length, 2, 'mesmo com falha, o registo fica em memória');
  });

  it('persister assíncrono que rejeita não gera unhandled rejection', () => {
    syslog.setPersister(() => Promise.reject(new Error('timeout')));
    assert.doesNotThrow(() => syslog.sysLog({ message: 'async' }));
  });

  it('data é serializada e dados não serializáveis não rebentam', () => {
    assert.equal(syslog.sysLog({ message: 'a', data: { duty: 40 } }).data, '{"duty":40}');
    const ciclo = {}; ciclo.eu = ciclo;
    assert.equal(syslog.sysLog({ message: 'b', data: ciclo }).data, '{"unserializable":true}');
  });

  it('filtra por source, level e termo de busca', () => {
    syslog.sysLog({ source: 'esp', level: 'info', tag: 'SENSORES', message: 'DHT22 offline' });
    syslog.sysLog({ source: 'server', level: 'error', tag: 'API', message: 'Falha ThingSpeak' });
    assert.equal(syslog.getRecent({ source: 'esp' }).length, 1);
    assert.equal(syslog.getRecent({ level: 'error' }).length, 1);
    assert.equal(syslog.getRecent({ q: 'dht' }).length, 1);
    assert.equal(syslog.getRecent({ q: 'nao-existe' }).length, 0);
  });

  it('ring buffer é limitado (não cresce sem limite)', () => {
    for (let i = 0; i < syslog.MAX_RING + 40; i += 1) syslog.sysLog({ message: `m${i}` });
    assert.equal(syslog.getRingSize(), syslog.MAX_RING);
    assert.equal(syslog.getRecent()[0].message, `m${syslog.MAX_RING + 39}`, 'mais recente primeiro');
  });

  it('guarda e recupera o estado do ESP', () => {
    assert.equal(syslog.getEspStatus(), null);
    syslog.setEspStatus({ sistema: { uptime_s: 120 } });
    assert.equal(syslog.getEspStatus().sistema.uptime_s, 120);
    assert.ok(syslog.getEspStatus().received_at);
    syslog.setEspStatus(null);
    assert.equal(syslog.getEspStatus(), null);
  });

  it('o estado do ESP também é imutável (mesma garantia dos registos)', () => {
    syslog.setEspStatus({ sistema: { uptime_s: 120 } });
    const st = syslog.getEspStatus();
    assert.ok(Object.isFrozen(st), 'o estado do ESP deveria estar congelado');
    assert.throws(() => { 'use strict'; st.sistema.uptime_s = 999; }, TypeError);
    assert.equal(syslog.getEspStatus().sistema.uptime_s, 120, 'estado interno não deve ser corrompido');
  });

  it('setEspStatus copia o payload — mutar a origem não afecta o estado', () => {
    const origem = { sistema: { uptime_s: 50 } };
    syslog.setEspStatus(origem);
    origem.sistema.uptime_s = 9999;
    assert.equal(syslog.getEspStatus().sistema.uptime_s, 50);
  });

  it('mensagem gigante é truncada', () => {
    const r = syslog.sysLog({ message: 'x'.repeat(5000) });
    assert.ok(r.message.length < 5000, 'deveria truncar');
  });
});

describe('SystemLog: o schema preserva a hora do EVENTO', () => {
  // Hoisted: `require('mongoose')` custa ~1,6 s na primeira vez. Pagar isso dentro
  // de um `it()` faz um teste rápido parecer lento — e a culpa não é do teste.
  const SystemLog = require('../models/SystemLog');

  it('created_at do registo sobrevive (o Mongoose não o descarta)', () => {
    const quandoAconteceu = '2020-01-02T03:04:05.678Z';
    const rec = syslog.sysLog({ source: 'esp', level: 'warn', message: 'evento atrasado' });
    const doc = new SystemLog({ ...rec, created_at: quandoAconteceu });
    const o = doc.toObject();
    assert.ok('created_at' in o, 'created_at nao deveria ser descartado');
    assert.equal(o.created_at.toISOString(), quandoAconteceu);
  });

  it('inserted_at (hora de escrita) fica declarado para o Mongoose preencher', () => {
    // `toObject()` de um doc não gravado NÃO inclui timestamps — só os aplica no
    // `save()`. O que se verifica aqui é a declaração, que é o que nos compete.
    assert.ok('inserted_at' in SystemLog.schema.paths, 'o schema deveria declarar inserted_at');
    assert.deepEqual(SystemLog.schema.options.timestamps, { createdAt: 'inserted_at', updatedAt: false });
  });

  it('os enums do schema vêm de lib/syslog (fonte única, sem duplicação)', () => {
    assert.deepEqual(SystemLog.schema.path('source').enumValues, syslog.SOURCES);
    assert.deepEqual(SystemLog.schema.path('level').enumValues, syslog.LEVELS);
  });

  it('o schema rejeita um source fora do conjunto canónico', async () => {
    const doc = new SystemLog({ source: 'invasado', message: 'x' });
    await assert.rejects(() => doc.validate(), /not a valid enum value/);
  });

  it('TTL de 30 dias está declarado sobre created_at', () => {
    const ttl = SystemLog.schema.indexes().find(([, o]) => o && o.expireAfterSeconds);
    assert.ok(ttl, 'deveria existir um índice TTL');
    assert.deepEqual(ttl[0], { created_at: 1 });
    assert.equal(ttl[1].expireAfterSeconds, 30 * 24 * 60 * 60);
  });
});

describe('ponte logger → SystemLog (Small, sem I/O)', () => {
  // `_resetBridge()` é obrigatório: a guarda de módulo sobrevive a `detachSinks`,
  // e sem reset o teste de duplicação passaria por acidente em vez de por mérito.
  beforeEach(() => { syslog._reset(); detachSinks(); _resetBridge(); });
  after(() => { syslog._reset(); detachSinks(); _resetBridge(); });

  it('toSystemRecord mapeia level/event para source/level/tag', () => {
    const r = toSystemRecord('error', 'request_error', { code: 'INTERNAL', requestId: 'abc' });
    assert.equal(r.source, 'server');
    assert.equal(r.level, 'error');
    assert.equal(r.tag, 'request_error');
    assert.match(r.message, /request_error/);
    assert.match(r.message, /code=INTERNAL/);
  });

  it('toSystemRecord preserva o requestId (correlação de suporte, §16.3)', () => {
    const r = toSystemRecord('error', 'request_error', { requestId: 'abc-123' });
    assert.equal(r.data.requestId, 'abc-123');
  });

  it('toSystemRecord sem campos deixa data a null (não grava "{}")', () => {
    assert.equal(toSystemRecord('info', 'db_conectado', {}).data, null);
  });

  it('toSystemRecord não propaga prototype perigoso do payload (pollution)', () => {
    // O `fields` vem de código interno, mas um `JSON.parse` de payload externo
    // pode trazer `__proto__`. Se o `data` o espalhasse, a gravação e a leitura
    // de volta poderiam poluir o protótipo (§9.2).
    const fields = JSON.parse('{"__proto__":{"polluted":true},"a":1}');
    const r = toSystemRecord('info', 'x', fields);
    assert.equal(r.data.a, 1);
    assert.equal({}.polluted, undefined, 'o protótipo global não deve estar poluído');
  });

  it('attachSystemLog NÃO duplica registos quando chamado várias vezes', () => {
    // Cenário real: em Vercel, `api/index.js` monta `authApp` e `adminApp`, e
    // ambos instalam a ponte. O teste anterior exercitava `attachSink` com uma
    // referência estável — a camada errada. Este chama o ponto de entrada real,
    // com `create` DIFERENTES, que é como acontece em produção.
    const a = [], b = [];
    const orig = console.log;
    console.log = () => {};
    try {
      attachSystemLog({ create: (r) => { a.push(r); return r; } });
      attachSystemLog({ create: (r) => { b.push(r); return r; } });
      logger.info('evento_unico', {});
    } finally {
      console.log = orig;
    }
    // Conta-se só o evento de interesse: cada `attachSystemLog` emite também
    // `system_log_ligado`, o que contaminaria a contagem bruta.
    const n = [...a, ...b].filter((r) => r.tag === 'evento_unico').length;
    assert.equal(n, 1, `o evento devia ser persistido 1x, foi ${n}x`);
  });

  it('o sink NUNCA impede o stdout (garantia principal, Twelve-Factor §17)', () => {
    const origLog = console.log;
    let stdout = '';
    console.log = (m) => { stdout += m; };
    try {
      // sink que rebenta
      require('../lib/logger').attachSink(() => { throw new Error('mongo em baixo'); });
      assert.doesNotThrow(() => logger.info('request_error', { code: 'INTERNAL' }));
      assert.match(stdout, /request_error/, 'o stdout deve continuar a receber o evento');
    } finally {
      console.log = origLog;
    }
  });

  it('um sink que rebenta não impede os restantes', () => {
    const orig = console.log;
    console.log = () => {};
    const ok = [];
    try {
      require('../lib/logger').attachSink(() => { throw new Error('sink mau'); });
      require('../lib/logger').attachSink((lvl, ev) => ok.push(ev));
      logger.warn('evento_sob_teste', {});
    } finally {
      console.log = orig;
    }
    assert.deepEqual(ok, ['evento_sob_teste']);
  });

  it('attachSystemLog persiste através do SystemLog.create fornecido', () => {
    const orig = console.log;
    console.log = () => {};
    const criados = [];
    try {
      attachSystemLog({ create: (rec) => { criados.push(rec); return Promise.resolve(rec); } });
      logger.error('request_error', { code: 'INTERNAL', requestId: 'r1' });
    } finally {
      console.log = orig;
    }
    const alvo = criados.find((c) => c.tag === 'request_error');
    assert.ok(alvo, 'o evento devia chegar ao create');
    assert.equal(alvo.source, 'server');
    assert.equal(alvo.level, 'error');
  });

  it('MONGODB_LOG_ENABLED=false desliga a persistência (kill-switch)', () => {
    const orig = console.log, origWarn = console.warn;
    console.log = () => {}; console.warn = () => {};
    const antes = process.env.MONGODB_LOG_ENABLED;
    process.env.MONGODB_LOG_ENABLED = 'false';
    let resultado;
    try {
      resultado = attachSystemLog({ create: () => {} });
    } finally {
      if (antes === undefined) delete process.env.MONGODB_LOG_ENABLED;
      else process.env.MONGODB_LOG_ENABLED = antes;
      console.log = orig; console.warn = origWarn;
    }
    assert.equal(resultado, false, 'deveria indicar que a ponte não ficou activa');
  });
});
