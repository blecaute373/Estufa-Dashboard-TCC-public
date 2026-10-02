/* ══════════════════════════════════════════
   ESTUFA 01 · mqtt-gateway.js — MQTT DIRETO DO NAVEGADOR (LAN)

   Publica comandos de atuador diretamente no broker MQTT da estufa, por
   WebSocket (mqtt.js, vendorizado em /js/mqtt.min.js — sem CDN).

   PORQUÊ: o caminho publicado (Vercel → fila Upstash → ESP32) aplica o comando
   em até ~10 s e depende de configuração na nuvem. Quando o painel de admin é
   aberto NA MESMA REDE da estufa, o browser consegue falar com o broker e o
   comando chega ao ESP32 de imediato — o mesmo broker que o server.js usa.

   LIMITES DESTE CAMINHO (importantes, não são bugs):
     1. Só funciona com o admin aberto na LAN da estufa. O site publicado
        (Vercel) não alcança 192.168.x.x — nesse caso cai-se no caminho da fila.
     2. Página servida por HTTPS só pode abrir `wss://` (conteúdo misto): o
        browser bloqueia `ws://`. Para `wss://` o broker precisa de TLS com um
        certificado que o browser aceite.
     3. O broker tem de ter o listener de WebSocket ativado (Mosquitto:
        `listener 9001` + `protocol websockets`).

   Este ficheiro NÃO envia comandos sozinho: quem decide entre broker local e
   fila é o control.js. Aqui fica só o transporte + estado da ligação.
   ═══════════════════════════════════════════ */
'use strict';

const BROKER_STORAGE_KEY = 'estufa_broker';

/* Tópicos: mesma estrutura do firmware/lib (fonte única é lib/control.js; aqui
   é o espelho mínimo, derivado do prefixo para não divergir). */
const BROKER_TOPIC_PREFIX = 'fazenda/estufa01/atuador';
const BROKER_TOPICO_ID = { vent: 'vent_001', valve: 'valv_001', light: 'ilum_001', global: 'global_001' };

/* Defaults: porta 9001 é a convenção do listener websockets do Mosquitto e
   '/mqtt' é o path default do mqtt.js. */
const BROKER_DEFAULTS = { host: '', port: 9001, path: '/mqtt', tls: false };

let brokerClient = null;
let brokerEstado = 'off';            // 'off' | 'connecting' | 'on' | 'error'
let brokerUltimoErro = '';
const brokerListeners = [];

/* ── CONFIG (localStorage, por navegador) ───────────────────────────────── */
function brokerConfig() {
  let salvo = {};
  try {
    salvo = JSON.parse(localStorage.getItem(BROKER_STORAGE_KEY) || '{}') || {};
  } catch { salvo = {}; }
  const cfg = Object.assign({}, BROKER_DEFAULTS, salvo);
  cfg.port = Number.parseInt(cfg.port, 10) || BROKER_DEFAULTS.port;
  cfg.tls = Boolean(cfg.tls);
  if (!cfg.path || cfg.path[0] !== '/') cfg.path = '/' + (cfg.path || 'mqtt');
  return cfg;
}

function brokerSalvarConfig(cfg) {
  const limpo = {
    host: String(cfg.host || '').trim(),
    port: Number.parseInt(cfg.port, 10) || BROKER_DEFAULTS.port,
    path: String(cfg.path || BROKER_DEFAULTS.path),
    tls: Boolean(cfg.tls),
  };
  localStorage.setItem(BROKER_STORAGE_KEY, JSON.stringify(limpo));
  return limpo;
}

function brokerUrl(cfg) {
  return `${cfg.tls ? 'wss' : 'ws'}://${cfg.host}:${cfg.port}${cfg.path}`;
}

/* ── ESTADO (para a UI) ─────────────────────────────────────────────────── */
function brokerEstadoAtual() { return brokerEstado; }
function brokerLigado() { return brokerEstado === 'on' && brokerClient && brokerClient.connected; }

function brokerOnStatus(cb) {
  if (typeof cb === 'function') brokerListeners.push(cb);
}

function brokerNotificar() {
  for (const cb of brokerListeners) {
    try { cb(brokerEstado, brokerUltimoErro); } catch (e) { console.error('[broker] listener:', e); }
  }
}

function brokerDefinirEstado(estado, erro) {
  brokerEstado = estado;
  brokerUltimoErro = erro || '';
  brokerNotificar();
}

/* ── CONEXÃO ────────────────────────────────────────────────────────────── */
/**
 * Abre a ligação ao broker. Resolve `{ ok:true }` quando conecta, ou
 * `{ ok:false, erro }` em falha/timeout — nunca lança, para o chamador poder
 * simplesmente cair no caminho da fila.
 */
function brokerConectar(cfg) {
  const conf = brokerSalvarConfig(cfg || brokerConfig());

  if (!conf.host) return Promise.resolve({ ok: false, erro: 'Preencha o IP/host do broker.' });

  // Conteúdo misto: página HTTPS não pode abrir ws:// (o browser bloqueia).
  if (location.protocol === 'https:' && !conf.tls) {
    return Promise.resolve({
      ok: false,
      erro: 'Página HTTPS só pode usar wss:// (marque "TLS/WSS" e use um certificado aceite pelo browser).',
    });
  }

  if (typeof mqtt === 'undefined') {
    return Promise.resolve({ ok: false, erro: '/js/mqtt.min.js não carregou.' });
  }

  brokerDesconectar();                       // sem clientes duplicados
  brokerDefinirEstado('connecting');

  const url = brokerUrl(conf);
  return new Promise((resolve) => {
    let resolvido = false;
    const finalizar = (r) => { if (!resolvido) { resolvido = true; resolve(r); } };

    brokerClient = mqtt.connect(url, {
      clientId: 'estufa_web_' + Math.random().toString(16).slice(2, 10),
      clean: true,
      connectTimeout: 6000,
      reconnectPeriod: 4000,
      protocolVersion: 4,        // MQTT 3.1.1: máxima compatibilidade (Mosquitto)
    });

    brokerClient.on('connect', () => {
      brokerDefinirEstado('on');
      console.log('[broker] Ligado a', url);
      finalizar({ ok: true });
    });
    brokerClient.on('reconnect', () => brokerDefinirEstado('connecting'));
    brokerClient.on('close', () => { if (brokerEstado !== 'off') brokerDefinirEstado('off'); });
    brokerClient.on('error', (err) => {
      brokerDefinirEstado('error', err && err.message ? err.message : String(err));
      finalizar({ ok: false, erro: brokerUltimoErro });
    });

    // Rede lenta: não deixa a UI pendurada.
    setTimeout(() => finalizar({ ok: false, erro: 'Tempo esgotado ao ligar ao broker.' }), 6500);
  });
}

function brokerDesconectar() {
  if (brokerClient) {
    try { brokerClient.end(true); } catch { /* já fechado */ }
    brokerClient = null;
  }
  brokerDefinirEstado('off');
}

/* ── PAYLOAD (espelho de lib/control.js — o backend é a fonte de verdade para
      o caminho da fila; este espelho cobre apenas o caminho direto) ──────── */
function brokerMontarPayload(actuator, action) {
  if (!BROKER_TOPICO_ID[actuator]) return { erro: 'Actuator inválido.' };

  if (actuator === 'global') {
    if (action === 'auto') return { payload: { command: 'AUTO' } };
    if (action === 'pause' || action === 'off') return { payload: { command: 'PAUSE' } };
    return { erro: 'action de global deve ser "pause" ou "auto".' };
  }

  if (actuator === 'light') {
    if (action === 'auto') return { payload: { command: 'AUTO' } };
    // Validação estrita (mesma regra do backend): só número finito ou string de
    // dígitos — `Number(true)`/`Number([])` seria falha silenciosa no atuador.
    let duty = null;
    if (typeof action === 'number') duty = Number.isFinite(action) ? action : null;
    else if (typeof action === 'string' && /^\d{1,3}(\.\d+)?$/.test(action)) duty = Number(action);
    if (duty === null) return { erro: 'action de light deve ser um duty 0-100 ou "auto".' };
    return { payload: { duty: Math.max(0, Math.min(100, duty)) } };
  }

  if (action === 'auto') return { payload: { command: 'AUTO' } };
  if (action === 'on') return { payload: { command: 'ON' } };
  if (action === 'off') return { payload: { command: 'OFF' } };
  return { erro: 'action deve ser "on", "off" ou "auto".' };
}

function brokerTopico(actuator) {
  return `${BROKER_TOPIC_PREFIX}/${BROKER_TOPICO_ID[actuator]}/comando`;
}

/**
 * Publica um comando pelo broker local. Resolve `{ ok:true }` só depois de o
 * mqtt.js confirmar a publicação (QoS 1) — não damos sucesso antes de o broker
 * aceitar a mensagem.
 */
function brokerPublicar(actuator, action) {
  if (!brokerLigado()) return Promise.resolve({ ok: false, erro: 'Broker não está ligado.' });

  const montado = brokerMontarPayload(actuator, action);
  if (montado.erro) return Promise.resolve({ ok: false, erro: montado.erro });

  const topico = brokerTopico(actuator);
  return new Promise((resolve) => {
    brokerClient.publish(topico, JSON.stringify(montado.payload), { qos: 1, retain: false }, (err) => {
      if (err) resolve({ ok: false, erro: err.message || 'Falha ao publicar.' });
      else resolve({ ok: true, topico, payload: montado.payload });
    });
  });
}