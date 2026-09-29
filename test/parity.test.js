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

describe('montagem partilhada das duas entradas (Medium)', () => {
  // Este é o teste que impede a RE-DUPLICAÇÃO. A app era montada à mão em
  // `server.js` e em `api/index.js`, cada uma com a sua cópia dos mesmos dez
  // blocos — e foi assim que `/api/control` divergiu. Agora a montagem vive em
  // `lib/app.js`; se alguém voltar a copiar middlewares para uma das entradas,
  // isto falha antes de a divergência chegar a produção.
  const fs = require('fs');
  const path = require('path');
  const ler = (ficheiro) => fs.readFileSync(path.join(__dirname, '..', ficheiro), 'utf8');

  it('as duas entradas usam a montagem comum de lib/app.js', () => {
    for (const ficheiro of ['server.js', 'api/index.js']) {
      const src = ler(ficheiro);
      for (const fn of ['montarBase', 'rotasDePaginas', 'rotaHealth', 'fecharApp']) {
        assert.match(
          src,
          new RegExp(`${fn}\\(app`),
          `${ficheiro} devia chamar ${fn}(app) de lib/app.js`
        );
      }
    }
  });

  it('nenhuma entrada remonta base, estáticos ou error handler à mão', () => {
    for (const ficheiro of ['server.js', 'api/index.js']) {
      // Ignora linhas de comentário: os comentários citam exatamente estes
      // padrões ao explicar porque é que a montagem é partilhada.
      const src = ler(ficheiro).replace(/^\s*\/\/.*$/gm, '');
      assert.doesNotMatch(src, /app\.set\(\s*'trust proxy'/, `${ficheiro} monta trust proxy fora de lib/app.js`);
      assert.doesNotMatch(src, /app\.use\(express\.json\(/, `${ficheiro} monta express.json fora de lib/app.js`);
      assert.doesNotMatch(src, /app\.use\(express\.static\(/, `${ficheiro} monta estáticos fora de lib/app.js`);
      assert.doesNotMatch(src, /requireAuthPage\(/, `${ficheiro} recria middlewares de página fora de lib/app.js`);
    }
  });
});

describe('vercel.json espelha os headers do Express (Medium)', () => {
  // Na Vercel, quem serve o estático e o `/api/*` é o Edge — o Express só corre
  // dentro da função serverless. Se o bloco `headers` do vercel.json divergir do
  // `securityHeaders()` do Express, o MESMO browser recebe headers diferentes
  // conforme o caminho (página estática vs API). O middleware já dizia "espelham
  // o bloco do vercel.json"; este teste é o que garante que é verdade.
  const fs = require('fs');
  const path = require('path');

  function headersDoExpress() {
    const { securityHeaders } = require('../lib/middleware');
    const capturados = new Map();
    const resFalso = { setHeader: (chave, valor) => capturados.set(chave.toLowerCase(), valor) };
    securityHeaders()({}, resFalso, () => {});
    return capturados;
  }

  function headersDoVercel() {
    const vercel = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'vercel.json'), 'utf8'));
    const bloco = (vercel.headers || []).find((h) => h.source === '/(.*)');
    assert.ok(bloco, 'vercel.json tem de ter um bloco headers para /(.*)');
    return new Map(bloco.headers.map((h) => [h.key.toLowerCase(), h.value]));
  }

  it('cada header de securityHeaders() está no vercel.json com o mesmo valor', () => {
    const noExpress = headersDoExpress();
    const noVercel = headersDoVercel();

    assert.ok(noExpress.size >= 4, 'o middleware devia registar os headers base');
    for (const [chave, valor] of noExpress) {
      assert.equal(
        noVercel.get(chave),
        valor,
        `header ${chave} divergiu: Express="${valor}" vs vercel.json="${noVercel.get(chave)}"`
      );
    }
  });

  it('HSTS só existe no vercel.json (produção) — em dev o Express não o regista', () => {
    // Divergência INTENCIONAL e documentada em lib/middleware.js: em
    // http://localhost o HSTS é ignorado pelo browser, e registá-lo à mesma
    // seria testar nada. O vercel.json só corre sobre HTTPS.
    assert.equal(
      headersDoExpress().has('strict-transport-security'),
      false,
      'o Express não deve emitir HSTS fora de produção'
    );
    assert.match(
      headersDoVercel().get('strict-transport-security') || '',
      /max-age=\d+/
    );
  });
});
