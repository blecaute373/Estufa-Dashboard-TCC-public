#!/usr/bin/env node
/**
 * Estufa 01 — Diagnóstico da ligação ao MongoDB Atlas
 *
 * PORQUÊ ISTO EXISTE: o bug #13 do BLUEPRINT mostrou que a ausência de
 * `MONGODB_URI` em produção não dá um erro óbvio — o `api/db.js` lança, o
 * `POST /api/auth/login` devolve 500 e o sintoma que chega ao utilizador é
 * "o painel de administração não abre", indistinguível de um JWT errado ou de
 * um Redis em baixo. Verificar isto à mão, em produção, custa horas.
 *
 * Verifica, por ordem, os elos que falham em sítios diferentes:
 *
 *   1. MONGODB_URI presente e com esquema válido (fail-fast do `lib/config.js`)
 *   2. DNS SRV + handshake + autenticação SCRAM (o `mongodb+srv://`)
 *   3. Permissão de LEITURA nas coleções reais (`users`, `accesslogs`)
 *   4. Permissão de ESCRITA (insert+delete numa coleção descartável)
 *
 * Uso:  npm run check:mongo
 *
 * Credenciais: lê `MONGODB_URI` do ambiente ou do `.env`. A password NUNCA é
 * impressa — o URL mostrado passa por `mascararUri()`.
 *
 * NÃO entra no `npm run check`: precisa de rede e credenciais reais, enquanto o
 * `check`/`test` são herméticos por desenho (ENGENHARIA §5.2).
 */
'use strict';

try {
  // `.env` é a convenção do projeto (copiado de `.env.example`); `.env.local` é
  // onde o CLI da Vercel escreve credenciais. O dotenv NÃO sobrepõe variáveis já
  // presentes no ambiente, portanto os testes continuam herméticos (definem
  // `MONGODB_URI` para `localhost` antes de carregar os módulos).
  require('dotenv').config({ path: ['.env', '.env.local'], quiet: true });
} catch {
  /* dotenv opcional — as variáveis podem vir do ambiente */
}

/** Nome da coleção descartável usada para provar permissão de escrita. */
const COLECAO_SONDAGEM = '_probe_estufa01';

/* ── Funções PURAS (testáveis sem tocar na rede — ENGENHARIA §5) ─────────────── */

/**
 * Substitui as credenciais de uma URI por `***`.
 *
 * Um diagnóstico que imprime a URI inteira num log é ele próprio o incidente:
 * o `MONGODB_URI` dá acesso total à base. A função é usada em TODAS as
 * impressões de URI deste script.
 *
 * @param {string} uri string de conexão (pode ser inválida)
 * @returns {string} a mesma string com as credenciais escondidas
 */
function mascararUri(uri) {
  const texto = String(uri || '');
  // `mongodb+srv://user:pass@host` e `mongodb+srv://user@host` (sem password).
  return texto.replace(/^([a-z+]+:\/\/)([^@/]+@)/i, '$1***@');
}

/**
 * Valida o FORMATO da URI sem tentar ligar (o que dá para checar offline).
 *
 * Reproduz a exigência do Atlas: `mongodb+srv://` com host e, idealmente, o
 * nome da base no caminho — sem ele os dados vão para `test`, um erro silencioso
 * clássico.
 *
 * @param {string} uri
 * @returns {{ ok: boolean, erros: string[], avisos: string[], base: string|null, host: string|null }}
 */
function analisarUri(uri) {
  const erros = [];
  const avisos = [];
  const texto = String(uri || '').trim();

  if (!texto) {
    return { ok: false, erros: ['MONGODB_URI não definida.'], avisos, base: null, host: null };
  }
  if (!/^mongodb(\+srv)?:\/\//.test(texto)) {
    erros.push('A URI não começa por mongodb:// nem mongodb+srv://.');
  }
  if (/<(usuario|senha|username|password)>/i.test(texto)) {
    erros.push('A URI ainda tem os marcadores <usuario>/<senha> do .env.example.');
  }
  const depoisDoEsquema = texto.replace(/^mongodb(\+srv)?:\/\//, '');
  if (!/@/.test(depoisDoEsquema)) {
    erros.push('Faltam as credenciais (user:pass@) antes do host.');
  }
  if (/localhost|127\.0\.0\.1/.test(texto)) {
    avisos.push('A URI aponta para localhost — em serverless isso nunca resolve.');
  }

  let host = null;
  let base = null;
  try {
    const u = new URL(texto.replace(/^mongodb(\+srv)?:\/\//, 'https://'));
    host = u.hostname || null;
    base = (u.pathname || '').replace(/^\//, '') || null;
  } catch {
    erros.push('A URI não é um URL válido (verifique caracteres não escapados na password).');
  }

  if (host && !base) {
    avisos.push('Sem nome de base no caminho — o Mongoose usaria "test".');
  }
  if (depoisDoEsquema.split('@').length > 2) {
    // Um `@` não escapado na password parte o parsing: o host passa a ser o que
    // vem depois do ÚLTIMO `@`. O Atlas gera passwords sem `@`, mas um reset
    // manual pode introduzi-lo.
    avisos.push('Há mais de um "@" — se estiver na password, tem de ser %40.');
  }

  return { ok: erros.length === 0, erros, avisos, base, host };
}

/* ── Elos que precisam de rede ──────────────────────────────────────────────── */

/**
 * Liga, autentica e corre as quatro verificações contra o cluster real.
 *
 * @param {string} uri
 * @returns {Promise<{ ping: boolean, leitura: object|null, escrita: boolean, motivo: string|null }>}
 */
async function sondarCluster(uri) {
  // Carregados AQUI e não no topo: o `api/db.js` lê `process.env.MONGODB_URI` na
  // primeira chamada, e um require no topo faria a tentativa de ligação correr
  // antes do teste de formato.
  const connectDB = require('../api/db');
  const mongoose = require('mongoose');
  const User = require('../models/User');
  const AccessLog = require('../models/AccessLog');

  process.env.MONGODB_URI = uri;

  const resultado = { ping: false, leitura: null, escrita: false, motivo: null };

  try {
    await connectDB();
  } catch (err) {
    resultado.motivo = err?.message || String(err);
    return resultado;
  }

  try {
    await mongoose.connection.db.admin().command({ ping: 1 });
    resultado.ping = true;
  } catch (err) {
    resultado.motivo = `ping falhou: ${err?.message || err}`;
    return resultado;
  }

  try {
    resultado.leitura = {
      users: await User.countDocuments(),
      accesslogs: await AccessLog.countDocuments(),
    };
  } catch (err) {
    resultado.motivo = `leitura falhou: ${err?.message || err}`;
    return resultado;
  }

  // Prova de escrita numa coleção descartável: usar `users` deixaria lixo real
  // na base se o script morresse a meio.
  const sonda = mongoose.connection.db.collection(COLECAO_SONDAGEM);
  try {
    const { insertedId } = await sonda.insertOne({ _probe: true, at: new Date() });
    await sonda.deleteOne({ _id: insertedId });
    await sonda.drop().catch(() => {});
    resultado.escrita = true;
  } catch (err) {
    resultado.motivo = `escrita falhou: ${err?.message || err}`;
  }

  return resultado;
}

/* ── CLI ───────────────────────────────────────────────────────────────────── */

const LINHA = '─'.repeat(66);
const veredicto = (ok) => (ok ? 'OK' : 'FALHA');

async function main() {
  const uri = (process.env.MONGODB_URI || '').trim();

  console.log(LINHA);
  console.log('Estufa 01 — ligação ao MongoDB Atlas (bug #13)');
  console.log(LINHA);

  /* 1 — Formato */
  const analise = analisarUri(uri);
  console.log('\n[1] Formato da MONGODB_URI');
  console.log(`    estado  : ${veredicto(analise.ok)}`);
  console.log(`    valor   : ${uri ? mascararUri(uri) : '(vazia)'}`);
  for (const e of analise.erros) console.log(`    erro    : ${e}`);
  for (const a of analise.avisos) console.log(`    aviso   : ${a}`);

  if (!analise.ok) {
    console.log('\n' + LINHA);
    console.log('Corrija a URI antes de testar (ver .env.example).');
    console.log(LINHA);
    process.exitCode = 1;
    return;
  }

  /* 2-4 — Rede */
  console.log(`\n[2] Ligação (host: ${analise.host}, base: ${analise.base || 'test'})`);
  const sonda = await sondarCluster(uri);
  console.log(`    estado  : ${veredicto(sonda.ping)}`);
  if (!sonda.ping && sonda.motivo) console.log(`    motivo  : ${sonda.motivo}`);

  console.log('\n[3] Leitura nas coleções reais');
  if (sonda.leitura) {
    console.log(`    estado  : ${veredicto(true)}`);
    console.log(`    users      : ${sonda.leitura.users}`);
    console.log(`    accesslogs : ${sonda.leitura.accesslogs}`);
  } else {
    console.log(`    estado  : ${veredicto(false)}`);
    console.log(`    motivo  : ${sonda.motivo}`);
  }

  console.log('\n[4] Escrita (coleção descartável)');
  console.log(`    estado  : ${veredicto(sonda.escrita)}`);
  if (!sonda.escrita && sonda.motivo) console.log(`    motivo  : ${sonda.motivo}`);

  /* Veredicto */
  const tudoOk = sonda.ping && sonda.leitura && sonda.escrita;
  console.log('\n' + LINHA);
  if (tudoOk) {
    console.log('Ligação verificada. POST /api/auth/login deve responder 200.');
  } else {
    console.log('Há elos em falha acima. Causas típicas:');
    console.log('  - IP da Vercel fora da Access List (use 0.0.0.0/0, serverless)');
    console.log('  - password errada ou com caracteres não escapados');
    console.log('  - role sem readWrite na base indicada');
    process.exitCode = 1;
  }
  console.log(LINHA);
}

if (require.main === module) {
  main()
    .catch((err) => {
      console.error('[check:mongo] erro inesperado:', err?.message || err);
      process.exitCode = 1;
    })
    .finally(() => {
      // Sem isto o processo fica pendurado nos sockets do driver.
      require('mongoose')
        .connection.close()
        .catch(() => {});
    });
}

module.exports = { COLECAO_SONDAGEM, mascararUri, analisarUri, sondarCluster };