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
/* Em Node (testes Small), `localStorage` não existe — usa memória local. */
const __memBrokerCfg = {};
function __lerMem(chave) { return __memBrokerCfg[chave]; }
function __gravarMem(chave, valor) { __memBrokerCfg[chave] = valor; }

function brokerConfig() {
  let salvo = {};
  try {
    const bruto = (typeof localStorage !== 'undefined')
      ? localStorage.getItem(BROKER_STORAGE_KEY)
      : __lerMem(BROKER_STORAGE_KEY);
    salvo = JSON.parse(bruto || '{}') || {};
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
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(BROKER_STORAGE_KEY, JSON.stringify(limpo));
    } else {
      __gravarMem(BROKER_STORAGE_KEY, JSON.stringify(limpo));
    }
  } catch { /* armazenamento indisponível: segue com defaults em memória */ }
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
  if (typeof location !== 'undefined' && location.protocol === 'https:' && !conf.tls) {
    return Promise.resolve({
      ok: false,
      erro: 'Página HTTPS só pode usar wss:// (marque "TLS/WSS" e use um certificado aceite pelo browser). Sem TLS no broker, use a fila da nuvem (~10 s).',
    });
  }

  // Erro de configuração mais comum: 1883 é MQTT sobre TCP (server.js/ESP32).
  // O navegador só fala WebSocket — o Mosquitto precisa de `listener 9001` +
  // `protocol websockets`. Avisar antes de tentar evita o loop "A ligar…".
  // (Bloqueio incondicional: 1883 nunca fala WebSocket, não é questão de retry.)
  if (Number(conf.port) === 1883) {
    return Promise.resolve({
      ok: false,
      erro: 'Porta 1883 é MQTT/TCP (para server.js/ESP32). O navegador precisa da porta WebSocket (ex.: 9001 com `protocol websockets` no Mosquitto).',
    });
  }

  if (typeof mqtt === 'undefined') {
    return Promise.resolve({ ok: false, erro: '/js/mqtt.min.js não carregou (verifique rede/cache do PWA).' });
  }

  brokerDesconectar();                       // sem clientes duplicados
  brokerDefinirEstado('connecting');

  const url = brokerUrl(conf);
  return new Promise((resolve) => {
    let resolvido = false;
    let timer = null;
    const limparTimer = () => { if (timer) { clearTimeout(timer); timer = null; } };
    // Encerra a tentativa sem notificar: usado no timeout/erro para que o
    // `close` subsequente não apague o estado final 'error'.
    const encerrarTentativa = () => {
      limparTimer();
      const cli = brokerClient;
      brokerClient = null;
      if (cli) { try { cli.removeAllListeners(); cli.end(true); } catch { /* já fechado */ } }
    };
    const finalizar = (r) => {
      if (resolvido) return;
      resolvido = true;
      limparTimer();
      if (!r.ok) encerrarTentativa();
      resolve(r);
    };

    brokerClient = mqtt.connect(url, {
      clientId: 'estufa_web_' + Math.random().toString(16).slice(2, 10),
      clean: true,
      connectTimeout: 6000,
      // Sem auto-reconnect DURANTE a discagem inicial: o retry infinito era o
      // que prendia a UI em "A ligar…". Depois do primeiro `connect`, o
      // auto-reconnect é religado (sessão estabelecida que cai = reconecta).
      reconnectPeriod: 0,
      protocolVersion: 4,        // MQTT 3.1.1: máxima compatibilidade (Mosquitto)
    });

    brokerClient.on('connect', () => {
      limparTimer();
      // Sessão estabelecida: agora sim faz sentido reconectar sozinho se cair.
      try { brokerClient.options.reconnectPeriod = 4000; } catch { /* versão sem options mutável */ }
      brokerDefinirEstado('on');
      console.log('[broker] Ligado a', url);
      finalizar({ ok: true });
    });
    // `reconnect` só dispara após sessão estabelecida (reconnectPeriod=0 na
    // discagem), então aqui "A ligar…" significa "reconectando", não travamento.
    brokerClient.on('reconnect', () => { if (!resolvido) brokerDefinirEstado('connecting'); });
    brokerClient.on('close', () => {
      if (resolvido) return;               // erro/timeout já pintou 'error'
      if (brokerEstado === 'connecting') brokerDefinirEstado('off');
    });
    brokerClient.on('error', (err) => {
      const msg = diagnosticarErroBroker(err, conf, url);
      brokerDefinirEstado('error', msg);
      finalizar({ ok: false, erro: msg });
    });

    // Rede lenta: não deixa a UI pendurada — e ENCERRA o cliente, senão o
    // retry em segundo plano repintava "connecting" para sempre.
    timer = setTimeout(() => {
      const msg = 'Tempo esgotado ao ligar ao broker (sem resposta em ~6 s). Confirme IP/porta WebSocket (9001 + `protocol websockets`) e que está na mesma rede da estufa.';
      brokerDefinirEstado('error', msg);
      finalizar({ ok: false, erro: msg });
    }, 6500);
  });
}

/**
 * Traduz o erro bruto do mqtt.js em diagnóstico acionável (o `err.message`
 * sozinho — "connection refused", "timeout" — não diz o que configurar).
 */
function diagnosticarErroBroker(err, conf, url) {
  const bruto = (err && err.message ? err.message : String(err || 'Falha ao ligar')).trim();
  const detalhe = bruto ? ' (' + bruto + ')' : '';
  if (Number(conf.port) === 1883) {
    return 'Porta 1883 é MQTT/TCP, não WebSocket. Use a porta WebSocket do Mosquitto (ex.: 9001 com `protocol websockets`)' + detalhe + '.';
  }
  if (/refused|ECONNREFUSED/i.test(bruto)) {
    return 'Broker recusou a ligação em ' + url + ': sem listener WebSocket nessa porta (Mosquitto: `listener 9001` + `protocol websockets`)' + detalhe + '.';
  }
  if (/timeout|timed out|ETIMEDOUT/i.test(bruto)) {
    return 'Broker sem resposta em ' + url + ': IP errado, fora da LAN da estufa, ou firewall' + detalhe + '. Os comandos seguem pela fila da nuvem.';
  }
  if (conf.tls) {
    return 'Falha WSS em ' + url + ': o broker precisa de TLS com certificado aceite pelo browser (self-signed é rejeitado sem importar)' + detalhe + '.';
  }
  return 'Não foi possível ligar ao broker em ' + url + detalhe + '. Os comandos seguem pela fila da nuvem.';
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

/* Exporta as funções PURAS para testes Small em Node — sem tocar no
   comportamento no browser (lá `module` não existe e o bloco é ignorado).
   `brokerConectar` vai junto para testar as recusas ANTES da rede (sem host,
   porta 1883, https sem TLS) — com stubs de `location`/`mqtt` quando ausentes. */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    BROKER_DEFAULTS,
    brokerConfig,
    brokerSalvarConfig,
    brokerUrl,
    brokerConectar,
    brokerMontarPayload,
    brokerTopico,
    diagnosticarErroBroker,
  };
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