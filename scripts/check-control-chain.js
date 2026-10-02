#!/usr/bin/env node
/**
 * Estufa 01 — Diagnóstico da cadeia de controlo manual (ADR-0007/0008)
 *
 * PORQUÊ ISTO EXISTE: o acionamento manual pelo dashboard tem QUATRO elos, em
 * sítios diferentes, e nenhum deles falha de forma óbvia quando está mal:
 *
 *   1. REDIS_URL (Vercel)      — sem ela o POST /api/control nem enfileira
 *   2. DEVICE_TOKEN (Vercel)   — sem ela o GET /pending responde 401
 *   3. token no firmware       — tem de ser IGUAL ao DEVICE_TOKEN
 *   4. broker local (opcional) — só para o caminho LAN (server.js)
 *
 * O sintoma dos três primeiros é o MESMO ("o relé não reage ao clique"), e é
 * por isso que os verificar por eliminação custa horas: este script verifica-os
 * de uma vez, em segundos. Serve para o mesmo tipo de falha que a v1.7.1/v1.7.2
 * do ADR-0008 documentam (token ausente, e token do Upstash colado no sítio
 * errado).
 *
 * Uso:  npm run check:control
 *
 * NÃO entra no `npm run check`: precisa de rede e credenciais reais, enquanto o
 * `check`/`test` são herméticos por desenho (ENGENHARIA §5.2).
 */
'use strict';

try {
  require('dotenv').config();
} catch {
  /* dotenv opcional — as variáveis podem vir do ambiente */
}

const fs = require('fs');
const path = require('path');

const { parseRedisUrl } = require('../lib/config');

/** Caminho do projeto PlatformIO do firmware (relativo à raiz do repositório). */
const DIR_FIRMWARE_PADRAO = '260929-212817-esp32doit-devkit-v1';

/* ── Funções PURAS (testáveis sem tocar no disco nem na rede — ENGENHARIA §5) ── */

/**
 * Extrai o token do conteúdo de um ficheiro do firmware.
 *
 * @param {string} texto conteúdo do ficheiro
 * @param {'secrets'|'main'} tipo `secrets` procura o `#define`, `main` procura
 *   o literal `const char* API_VERCEL_TOKEN = "..."`.
 * @returns {string|null} o valor, ou `null` se não houver definição activa.
 */
function extrairToken(texto, tipo) {
  if (typeof texto !== 'string') return null;
  const padrao = tipo === 'secrets'
    ? /#define\s+API_VERCEL_TOKEN\s+"([^"]*)"/
    : /const\s+char\s*\*\s*API_VERCEL_TOKEN\s*=\s*"([^"]*)"/;

  // Linha a linha (e não sobre o ficheiro inteiro): uma definição COMENTADA não
  // conta — é isso que distingue "já configurado" de "ainda é o exemplo".
  for (const linha of texto.split(/\r?\n/)) {
    const limpa = linha.trim();
    if (limpa.startsWith('//') || limpa.startsWith('*') || limpa.startsWith('/*')) continue;
    const m = limpa.match(padrao);
    if (m) return m[1];
  }
  return null;
}

/**
 * Decide qual token o firmware realmente usa.
 *
 * `secrets.h` tem PRIORIDADE: `main.cpp` lê-o por `#if __has_include` e a
 * definição só cai para o literal quando a macro não existe (guarda `#ifndef`).
 * Reproduzir essa ordem aqui é o que torna o diagnóstico fiel ao binário.
 *
 * @returns {{ valor: string|null, origem: 'secrets.h'|'main.cpp'|null }}
 */
function resolverTokenFirmware({ secretsTexto, mainTexto }) {
  const deSecrets = extrairToken(secretsTexto, 'secrets');
  if (deSecrets !== null) return { valor: deSecrets, origem: 'secrets.h' };
  const deMain = extrairToken(mainTexto, 'main');
  if (deMain !== null) return { valor: deMain, origem: 'main.cpp' };
  return { valor: null, origem: null };
}

/**
 * Heurística (a MESMA que o firmware usa em `tokenPareceUpstash()`): o token do
 * dispositivo recomendado é hex de 64 caracteres; os tokens REST da Upstash são
 * ~36 caracteres `[a-z0-9]`. Confirmar a troca aqui evita ir depurar o código
 * quando o problema é um valor colado no campo errado.
 */
function pareceTokenUpstash(valor) {
  if (typeof valor !== 'string') return false;
  return valor.length >= 30 && valor.length <= 40 && /^[a-z0-9]+$/.test(valor);
}

/** Formato esperado, para reutilizar nas mensagens (DRY: 3 ocorrências reais). */
const FORMATO_REDIS = 'https://SEU-ENDPOINT.upstash.io/?_token=SEU_TOKEN';

/* ── I/O e verificação (precisam de disco/rede — fora do teste hermético) ───── */

/** Lê os ficheiros relevantes do firmware. Ausência é normal, não é erro. */
function lerFirmware(dirFirmware) {
  const base = path.join(__dirname, '..', dirFirmware);
  const ler = (rel) => {
    try {
      return fs.readFileSync(path.join(base, rel), 'utf8');
    } catch {
      return null;
    }
  };
  const mainTexto = ler(path.join('src', 'main.cpp'));
  return {
    base,
    existe: mainTexto !== null,
    secretsTexto: ler(path.join('include', 'secrets.h')),
    mainTexto,
  };
}

/**
 * Verifica o REDIS_URL com um round-trip REAL ao Upstash.
 *
 * Porquê escrever e apagar uma chave em vez de só validar o formato: um token
 * truncado, uma base apagada ou um endpoint de outra conta passam a validação
 * sintáctica e só falham na primeira escrita — que em produção é o clique do
 * utilizador. Um SET/GET/DEL de uma chave de diagnóstico custa 3 comandos (o
 * plano grátis tem 500K/mês) e responde à pergunta de verdade.
 */
async function verificarRedis(raw) {
  if (!raw) return { ok: false, motivo: 'REDIS_URL não definida no ambiente.' };

  let cfg;
  try {
    cfg = parseRedisUrl(raw);        // a MESMA função do runtime: nenhuma regra duplicada
  } catch (err) {
    return { ok: false, motivo: err.message };
  }

  try {
    const { Redis } = require('@upstash/redis');
    const redis = new Redis({ url: cfg.url, token: cfg.token });
    const chave = 'estufa:diagnostico:check-control-chain';
    await redis.set(chave, String(Date.now()), { ex: 60 });
    const eco = await redis.get(chave);
    await redis.del(chave);
    if (!eco) return { ok: false, motivo: 'o Upstash aceitou a escrita mas não devolveu o valor.' };
    return { ok: true, host: cfg.url };
  } catch (err) {
    return { ok: false, motivo: err?.message || String(err) };
  }
}

/* ── CLI ───────────────────────────────────────────────────────────────────── */

const LINHA = '─'.repeat(66);
const veredicto = (ok) => (ok ? 'OK' : 'FALHA');

async function main() {
  const dirFirmware = process.env.DIR_FIRMWARE || DIR_FIRMWARE_PADRAO;
  const deviceToken = (process.env.DEVICE_TOKEN || '').trim();
  const redisUrl = (process.env.REDIS_URL || '').trim();

  console.log(LINHA);
  console.log('Estufa 01 — cadeia do controlo manual (ADR-0007/0008)');
  console.log(LINHA);

  /* 1 — REDIS_URL (fila de comandos) */
  const redis = await verificarRedis(redisUrl);
  console.log('\n[1] REDIS_URL (fila de comandos)');
  console.log(`    estado  : ${veredicto(redis.ok)}`);
  if (redis.ok) {
    console.log(`    host    : ${redis.host}`);
  } else {
    console.log(`    motivo  : ${redis.motivo}`);
    console.log(`    formato : ${FORMATO_REDIS}`);
    console.log('    nota    : o endpoint sozinho não serve — o token tem de vir');
    console.log('              na própria string, depois de "?_token=".');
  }

  /* 2 — DEVICE_TOKEN (Vercel) */
  const temToken = deviceToken.length >= 16;
  console.log('\n[2] DEVICE_TOKEN (Vercel)');
  console.log(
    `    estado  : ${veredicto(temToken)}` +
      (temToken ? ` (${deviceToken.length} caracteres)` : ' (ausente ou < 16 caracteres)')
  );
  if (temToken && pareceTokenUpstash(deviceToken)) {
    // No lado da Vercel o valor é livre, portanto aqui é só um alerta — mas se
    // vier do Upstash ninguém o vai notar de outra forma.
    console.log('    aviso   : o valor PARECE um token do Upstash. Confirme que copiou');
    console.log('              o DEVICE_TOKEN, e não o token do Redis.');
  }

  /* 3 — Token no firmware */
  console.log(`\n[3] Token no firmware (${dirFirmware})`);
  const fw = lerFirmware(dirFirmware);
  if (!fw.existe) {
    console.log('    estado  : IGNORADO (src/main.cpp não encontrado)');
  } else {
    const { valor, origem } = resolverTokenFirmware(fw);
    if (!valor) {
      console.log('    estado  : FALHA (nenhuma definição activa)');
    } else if (valor.length < 16) {
      console.log(`    estado  : FALHA (${origem} tem o token vazio)`);
    } else if (temToken && valor !== deviceToken) {
      console.log(`    estado  : FALHA (${origem} != DEVICE_TOKEN)`);
      console.log('    motivo  : o poll responde 401 (fail-closed) e o relé nunca reage.');
      console.log('              Os dois lados têm de ter o MESMO valor.');
    } else {
      const alerta = pareceTokenUpstash(valor) ? '  ATENÇÃO: parece o token do Upstash!' : '';
      console.log(`    estado  : ${veredicto(true)} (${origem})${alerta}`);
    }
  }

  /* Veredicto */
  console.log('\n' + LINHA);
  if (redis.ok && temToken) {
    console.log('Cadeia verificada. Se o relé ainda não reagir, confirme no monitor');
    console.log('série do ESP32: "[VERCEL] Poll de comandos ativo (fila OK)."');
  } else {
    console.log('Há elos em falha acima — corrija-os antes de testar o dashboard.');
    process.exitCode = 1;
  }
  console.log(LINHA);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[check:control] erro inesperado:', err?.message || err);
    process.exitCode = 1;
  });
}

module.exports = {
  DIR_FIRMWARE_PADRAO,
  FORMATO_REDIS,
  extrairToken,
  resolverTokenFirmware,
  pareceTokenUpstash,
  lerFirmware,
};
