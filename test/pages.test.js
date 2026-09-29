/**
 * SMOKE TEMPORÁRIO — valida páginas e folhas de estilo por HTTP real.
 * Stubs de Mongoose iguais aos de test/http.test.js (sem Mongo).
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

let app, server, baseUrl;

before(async () => {
  mongoose.connect = async () => ({});
  const userStub = { findOne: async () => null, findById: () => ({ select: async () => null }), countDocuments: async () => 0 };
  const logStub = { create: async () => ({}), find: () => ({ populate: () => ({ sort: () => ({ skip: () => ({ limit: () => ({ lean: async () => [] }) }) }) }) }) };

  const origRequire = Module.prototype.require;
  Module.prototype.require = function (id) {
    if (id.endsWith('models/User') || id === './models/User') return userStub;
    if (id.endsWith('models/AccessLog') || id === './models/AccessLog') return logStub;
    return origRequire.apply(this, arguments);
  };
  app = origRequire.call(module, '../server.js');
  Module.prototype.require = origRequire;

  await new Promise((r) => { server = app.listen(0, '127.0.0.1', r); });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => { await new Promise((r) => server.close(r)); });

const PAGES = ['/index.html', '/login-dashboard.html', '/login-admin.html'];

describe('paginas publicas servidas com os novos CSS', () => {
  for (const page of PAGES) {
    it(`${page} → 200 html + refs locais resolvem`, async () => {
      const res = await fetch(baseUrl + page);
      assert.equal(res.status, 200, `${page} deveria ser 200`);
      assert.match(res.headers.get('content-type') || '', /text\/html/);
      const html = await res.text();

      assert.ok(html.includes('<!DOCTYPE html>'), 'deveria comecar com doctype');
      assert.ok(!html.includes('<style>'), 'nao deveria ter <style> inline');
      assert.ok(html.includes('/js/theme.js'), 'deveria carregar theme.js');
      assert.ok(html.includes('/pwa.js'), 'deveria carregar pwa.js');

      // F4: nenhum script de página inline. A única exceção é o bootstrap do
      // tema, que TEM de correr antes do primeiro paint para não haver flash
      // de tema errado — esse fica inline de propósito.
      const blocos = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
        .map((m) => m[1].trim())
        .filter((b) => b.length > 0);
      assert.equal(blocos.length, 1, `${page} deveria ter só o bootstrap de tema inline`);
      assert.match(blocos[0], /estufa_theme/, 'o único script inline devia ser o bootstrap do tema');

      const refs = [...html.matchAll(/(?:href|src)="(\/[^"]+)"/g)].map((m) => m[1]);
      assert.ok(refs.length >= 6, `poucos refs locais em ${page}: ${refs.length}`);
      for (const ref of refs) {
        const r = await fetch(baseUrl + ref);
        assert.equal(r.status, 200, `${page} referencia ${ref} que devolveu ${r.status}`);
        await r.arrayBuffer();
      }
    });
  }

  it('/index.html usa o layout dividido (auth-split)', async () => {
    const html = await (await fetch(baseUrl + '/index.html')).text();
    assert.ok(html.includes('auth-page') && html.includes('auth-split'), 'esperava layout dividido');
    assert.ok(html.includes('id="firstUserNotice"'), 'esperava aviso de primeiro usuario');
    assert.ok(html.includes('id="strengthFill"'), 'esperava medidor de forca');
  });

  it('/login-dashboard.html usa auth-card + aba Registar', async () => {
    const html = await (await fetch(baseUrl + '/login-dashboard.html')).text();
    assert.ok(html.includes('class="auth-card"'), 'esperava auth-card');
    assert.ok(html.includes('id="tabRegister"'), 'esperava aba de registo');
    assert.ok(html.includes('id="userCount"'), 'esperava contador de usuarios');
  });

  it('/login-admin.html usa auth-card admin e aviso de restricao', async () => {
    const html = await (await fetch(baseUrl + '/login-admin.html')).text();
    assert.ok(html.includes('class="auth-card admin"'), 'esperava variante admin');
    assert.ok(html.includes('auth-notice show'), 'esperava aviso visivel');
    assert.ok(html.includes('id="loginUser"') && html.includes('id="loginPass"'), 'esperava campos');
  });
});

describe('folhas de estilo e scripts servidos', () => {
  const CSS = ['tokens', 'base', 'base2', 'auth', 'auth2', 'admin', 'dashboard', 'dashboard2', 'dashboard3'];
  for (const name of CSS) {
    it(`/css/${name}.css → 200 text/css`, async () => {
      const res = await fetch(`${baseUrl}/css/${name}.css`);
      assert.equal(res.status, 200);
      assert.match(res.headers.get('content-type') || '', /text\/css/);
      const css = await res.text();
      assert.ok(css.length > 200, `${name}.css parece vazio`);
    });
  }

  it('tokens.css define as variaveis usadas por auth2.css', async () => {
    const css = await (await fetch(baseUrl + '/css/tokens.css')).text();
    for (const v of ['--amber-3', '--glow-amber', '--lime', '--on-accent', '--display', '--mono']) {
      assert.ok(css.includes(v), `tokens.css deveria definir ${v}`);
    }
  });

  it('/js/theme.js → 200 javascript com EstufaTheme', async () => {
    const res = await fetch(baseUrl + '/js/theme.js');
    assert.equal(res.status, 200);
    const js = await res.text();
    assert.ok(js.includes('EstufaTheme'), 'theme.js deveria expor EstufaTheme');
  });
});

describe('service worker: lista de pre-cache resolve', () => {
  it('sw.js declara apenas assets publicos que respondem 200', async () => {
    const sw = await (await fetch(baseUrl + '/sw.js')).text();
    const m = sw.match(/const ASSETS = \[([\s\S]*?)\];/);
    assert.ok(m, 'sw.js deveria declarar ASSETS');

    const paths = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
    assert.ok(paths.length > 10, `esperava varios assets, veio ${paths.length}`);

    for (const p of paths) {
      const r = await fetch(baseUrl + p, { redirect: 'manual' });
      assert.equal(r.status, 200, `pre-cache ${p} devolveu ${r.status} (cache.addAll falharia)`);
      await r.arrayBuffer();
    }
  });

  it('sw.js usa cache versionado e nao pre-cacheia rotas autenticadas', async () => {
    const sw = await (await fetch(baseUrl + '/sw.js')).text();
    assert.match(sw, /const CACHE = 'estufa-v\d+'/, 'esperava cache versionado');
    for (const protectedPath of ["'/'", "'/dashboard.html'", "'/admin.html'"]) {
      assert.ok(!sw.includes(protectedPath), `nao deveria pre-cachear ${protectedPath}`);
    }
  });

  it('style.css legado ja nao existe (404)', async () => {
    const r = await fetch(baseUrl + '/style.css');
    assert.equal(r.status, 404, 'style.css deveria ter sido removido');
    await r.arrayBuffer();
  });
});

describe('rotas de pagina protegidas respondem sem 500', () => {
  for (const page of ['/dashboard.html', '/admin.html', '/']) {
    it(`${page} sem sessao → redirect/401 (nunca 5xx)`, async () => {
      const res = await fetch(baseUrl + page, { redirect: 'manual' });
      assert.ok(res.status < 500, `${page} devolveu ${res.status}`);
      assert.ok([200, 301, 302, 303, 401].includes(res.status), `${page} devolveu ${res.status}`);
      await res.arrayBuffer();
    });
  }
});