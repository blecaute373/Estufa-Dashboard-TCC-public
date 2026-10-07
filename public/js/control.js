/* ══════════════════════════════════════════
   ESTUFA 01 · control.js — controlo manual de atuadores (admin)
   POST /api/control   body: { actuator, action }
     actuator: 'vent' | 'valve' | 'light'
     action:   'on' | 'off' | 'auto' | <0-100 (duty, só para light)

   O comando NÃO vai direto para a estufa: a Vercel é serverless e não
   alcança a rede local, então o backend enfileira o comando na fila do Upstash
   Redis (ADR-0007/0008) e o ESP32 recolhe-o no próximo poll — aplicação em até
   ~10 s. Por isso o 202 é sucesso e o painel mostra "enfileirado", nunca
   "entregue".
   Também mantém a monitorização ao vivo do admin: cicloMonitorizar() faz
   polling do feed via buscarUltimo() (/js/sensor.js) a cada INTERVALO_S.
   ══════════════════════════════════════════ */

const URL_CONTROL = '/api/control';
const TIMEOUT_COMANDO_MS = 8000;   // aborta se o servidor não responder (§11)
let statusTimer = null;

/* ══════════════════════════════════════════
   ENVIO DE COMANDO
═══════════════════════════════════════════ */
/* ══════════════════════════════════════════
   ENVIO DE COMANDO — dois caminhos, um contrato
   1) BROKER LOCAL (LAN): se o painel estiver aberto na rede da estufa e a
      ligação ao broker estiver de pé, publica direto (mqtt-gateway.js) —
      resposta imediata, sem fila nem Vercel.
   2) FILA (Vercel + Upstash): funciona de qualquer rede (site publicado);
      aplicação em até ~10 s.
   O caminho 1 falha → cai no 2 automaticamente (falha graciosamente, §1.3).
═══════════════════════════════════════════ */
async function enviarComando(actuator, action) {
  setBotoesDisabled(actuator, true);
  try {
    if (typeof brokerLigado === 'function' && brokerLigado()) {
      const r = await brokerPublicar(actuator, action);
      if (r.ok) {
        mostrarStatus(`Enviado ao broker local: ${actuator} → ${action}`, 'ok');
        aplicarEstadoOtimista(actuator, action);
        return;
      }
      // Publicação falhou: não aborta — tenta a fila antes de reportar erro.
      mostrarStatus(`Broker local falhou (${r.erro}) — a usar a fila…`, 'warn');
    }
    await enviarComandoPelaFila(actuator, action);
  } finally {
    setBotoesDisabled(actuator, false);
  }
}

/* Caminho da fila (comportamento anterior, inalterado). */
async function enviarComandoPelaFila(actuator, action) {
  // Aborta a requisição se o servidor demorar (timeout em toda chamada
  // externa — ENGENHARIA §11.1) e limpa o timer no finally.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_COMANDO_MS);
  try {
    const res = await fetch(URL_CONTROL, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actuator, action }),
      signal: ctrl.signal,
    });

    // Sessão expirada: volta ao login (o token e httpOnly; é o backend quem diz).
    if (res.status === 401) { window.location.href = '/index.html'; return; }

    const payload = await res.json().catch(() => null);

    if (!res.ok) {
      mostrarStatus(apiErrorMessage(payload, 'Falha ao enviar comando.'), 'warn');
      return;
    }

    // 202 = enfileirado (ainda não aplicado no relé). O estado real chega pelo
    // ThingSpeak no ciclo seguinte; aqui mostramos o otimismo já para o clique
    // não "travar" e o ThingSpeak confirmar/corrigir.
    mostrarStatus(`Comando enfileirado: ${actuator} → ${action} (o ESP32 aplica em até 10 s)`, 'ok');
    aplicarEstadoOtimista(actuator, action);
  } catch (e) {
    const msg = (e && e.name === 'AbortError')
      ? 'Servidor demorou a responder — comando não confirmado.'
      : 'Erro de rede ao enviar comando.';
    mostrarStatus(msg, 'warn');
    console.error('[control] Erro:', e);
  } finally {
    clearTimeout(timer);
  }
}

/* Feedback imediato nos cards quando o comando e aceite (badge/chip verde ou
   vermelho) — o ThingSpeak confirma ou corrige o estado real no ciclo seguinte. */
function aplicarEstadoOtimista(actuator, action) {
  if (typeof atualizarAtuador !== 'function') return;         // guard: sensor.js ausente

  if (actuator === 'vent' && (action === 'on' || action === 'off')) {
    atualizarAtuador('cardVent', 'chipVent', 'lblVent', action === 'on', 'Ligado', 'Desligado');
  } else if (actuator === 'valve' && (action === 'on' || action === 'off')) {
    atualizarAtuador('cardValve', 'chipValve', 'lblValve', action === 'on', 'Aberta', 'Fechada');
  } else if (actuator === 'light') {
    const duty = Number(action);                              // 'auto' -> NaN: sem estimativa
    if (Number.isNaN(duty)) return;
    atualizarAtuador('cardLight', 'chipLight', 'lblLight', duty > 0, 'Ligada', 'Apagada');
    const dutyEl   = document.getElementById('dutyPct');
    const dutyBar  = document.getElementById('dutyBar');
    const dutyCtrl = document.getElementById('dutyPctCtrl');
    if (dutyEl)   dutyEl.textContent = duty;
    if (dutyBar)  dutyBar.style.width = duty + '%';
    if (dutyCtrl) dutyCtrl.textContent = duty + ' %';
  }
}

// RFC 9457 { title, detail } (padrão do lib/errors do servidor); legado { error }
function apiErrorMessage(payload, fallback) {
  if (!payload) return fallback;
  return payload.detail || payload.title || payload.error || fallback;
}

function setBotoesDisabled(actuator, disabled) {
  document.querySelectorAll(`[data-atuador="${actuator}"]`).forEach(el => {
    el.disabled = disabled;
  });
}

function mostrarStatus(msg, tipo) {
  const el = document.getElementById('ctrlStatusMsg');
  if (!el) return;
  el.textContent = msg;
  el.classList.toggle('warn', tipo === 'warn');
  el.classList.add('show');
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => el.classList.remove('show'), 3500);
}

const MODE_LABEL_ID = { vent: 'modeVent', valve: 'modeValve', light: 'modeLight' };

function marcarModo(actuator, modo) {
  const el = document.getElementById(MODE_LABEL_ID[actuator]);
  if (el) el.textContent = modo === 'auto' ? 'Auto' : 'Manual';
}

/* ══════════════════════════════════════════
   LIGADO / DESLIGADO / AUTO — Ventilador e Válvula
═══════════════════════════════════════════ */
document.querySelectorAll('.ctrl-btn.ctrl-on, .ctrl-btn.ctrl-off, .ctrl-btn.ctrl-auto')
  .forEach(btn => {
    const atuador = btn.dataset.atuador;
    if (atuador !== 'vent' && atuador !== 'valve') return; // luz tem fluxo próprio, abaixo
    btn.addEventListener('click', () => {
      const acao = btn.dataset.acao; // 'on' | 'off' | 'auto'
      marcarModo(atuador, acao === 'auto' ? 'auto' : 'manual');
      enviarComando(atuador, acao);
    });
  });

/* ══════════════════════════════════════════
   ILUMINAÇÃO — slider PWM (0-100) + seletor AUTO / MANUAL
═══════════════════════════════════════════ */
const btnLightAuto   = document.getElementById('btnLightAuto');
const btnLightManual = document.getElementById('btnLightManual');
const sliderLight     = document.getElementById('sliderLight');

function setLightMode(modo) {
  if (btnLightAuto)   btnLightAuto.classList.toggle('is-active', modo === 'auto');
  if (btnLightManual) btnLightManual.classList.toggle('is-active', modo === 'manual');
  if (sliderLight)    sliderLight.disabled = modo === 'auto';
  marcarModo('light', modo);
}

if (btnLightAuto) {
  btnLightAuto.addEventListener('click', () => {
    setLightMode('auto');
    enviarComando('light', 'auto');
  });
}
if (btnLightManual) {
  btnLightManual.addEventListener('click', () => {
    setLightMode('manual');
    // Retoma o manual já no duty atual do slider, sem esperar o próximo arraste
    if (sliderLight) enviarComando('light', Number(sliderLight.value));
  });
}

if (sliderLight) {
  sliderLight.addEventListener('input', () => {
    const dutyCtrl = document.getElementById('dutyPctCtrl');
    if (dutyCtrl) dutyCtrl.textContent = sliderLight.value + ' %';
  });
  // Só publica quando o utilizador solta o slider (evita inundar o MQTT a cada pixel arrastado)
  sliderLight.addEventListener('change', () => {
    enviarComando('light', Number(sliderLight.value));
  });
}

// Estado inicial: manual, slider habilitado
setLightMode('manual');

/* ══════════════════════════════════════════
   MONITORIZAÇÃO AO VIVO (admin)
   Polling do feed (funções partilhadas de /js/sensor.js) para a faixa
   de sensores + estado dos atuadores; guard se o sensor.js não carregou.
═══════════════════════════════════════════ */
async function cicloMonitorizar() {
  if (typeof buscarUltimo !== 'function') {
    console.error('[control] /js/sensor.js não carregou — monitorização inativa.');
    return;
  }
  await buscarUltimo();
}

function iniciarControlo() {
  cicloMonitorizar();
  setInterval(cicloMonitorizar, (typeof INTERVALO_S === 'number' ? INTERVALO_S : 16) * 1000);

}

/* Carregado no fim do <body>: normalmente o DOM já está pronto.
   O fallback cobre o caso de ser carregado no <head> com defer/async. */
/* ══════════════════════════════════════════
   BROKER LOCAL (LAN) — configuração + estado da ligação
   O IP/porta são do utilizador porque a estufa muda de rede; ficam guardados
   por navegador (localStorage, via mqtt-gateway.js). O estado é pintado num
   pill separado do pill do ThingSpeak — são coisas diferentes.
═══════════════════════════════════════════ */
const BROKER_ESTADO_UI = {
  off:        ['off',     'Desligado'],
  connecting: ['loading', 'A ligar…'],
  on:         ['online',  'Ligado'],
  error:      ['offline', 'Erro'],
};

function pintarBrokerEstado(estado, erro) {
  const pill = document.getElementById('brokerPill');
  const txt  = document.getElementById('brokerStatusText');
  const btnC = document.getElementById('btnBrokerConectar');
  const btnD = document.getElementById('btnBrokerDesconectar');
  const info = document.getElementById('brokerErro');

  const par = BROKER_ESTADO_UI[estado] || BROKER_ESTADO_UI.off;
  if (pill) pill.className = 'status-pill ' + par[0];
  if (txt)  txt.textContent = par[1];
  if (btnC) btnC.disabled = (estado === 'connecting' || estado === 'on');
  if (btnD) btnD.disabled = (estado === 'off');
  if (info) {
    info.textContent = erro ? ('⚠ ' + erro) : '';
    info.classList.toggle('show', Boolean(erro));
  }
}

function valorDe(id, fallback) {
  const el = document.getElementById(id);
  return el ? el.value : fallback;
}

function lerBrokerForm() {
  const tls = document.getElementById('brokerTls');
  return {
    host: valorDe('brokerHost', ''),
    port: valorDe('brokerPort', 9001),
    path: valorDe('brokerPath', '/mqtt'),
    tls:  Boolean(tls && tls.checked),
  };
}

function preencherBrokerForm() {
  const cfg = brokerConfig();
  const h = document.getElementById('brokerHost');
  const p = document.getElementById('brokerPort');
  const pa = document.getElementById('brokerPath');
  const t = document.getElementById('brokerTls');
  if (h) h.value = cfg.host;
  if (p) p.value = cfg.port;
  if (pa) pa.value = cfg.path;
  if (t) t.checked = cfg.tls;
}

function iniciarBroker() {
  if (typeof brokerConectar !== 'function') return;   // gateway não carregou

  preencherBrokerForm();
  brokerOnStatus(pintarBrokerEstado);
  pintarBrokerEstado(brokerEstadoAtual(), '');

  const btnC = document.getElementById('btnBrokerConectar');
  const btnD = document.getElementById('btnBrokerDesconectar');
  const btnS = document.getElementById('btnBrokerSalvar');

  if (btnS) {
    btnS.addEventListener('click', () => {
      brokerSalvarConfig(lerBrokerForm());
      mostrarStatus('Configuração do broker guardada neste navegador.', 'ok');
    });
  }
  if (btnC) {
    btnC.addEventListener('click', async () => {
      const r = await brokerConectar(lerBrokerForm());
      mostrarStatus(
        r.ok ? 'Ligado ao broker local — os comandos passam a ser diretos.'
             : 'Não foi possível ligar: ' + r.erro,
        r.ok ? 'ok' : 'warn'
      );
    });
  }
  if (btnD) {
    btnD.addEventListener('click', () => {
      brokerDesconectar();
      mostrarStatus('Broker local desligado — os comandos voltam a usar a fila.', 'warn');
    });
  }

  // Se já houver host guardado, tenta ligar sozinho ao abrir o painel.
  // A falha NÃO é silenciosa: preserva o erro no pill (era `pintar('off','')`,
  // que apagava o diagnóstico e parecia "nunca conecta sem dizer porquê").
  // O comando continua funcionando pela fila — o erro é só informativo.
  if (brokerConfig().host) {
    brokerConectar().then((r) => {
      if (!r.ok) pintarBrokerEstado('error', r.erro);
    });
  }
}

/* ══════════════════════════════════════════
   PAUSA GLOBAL DA AUTOMAÇÃO — Pausar / Retomar
   "Pausar" congela toda a lógica automática no firmware (relés mantêm-se no
   estado atual); "Retomar" (AUTO) devolve o controlo à automação. Vai para o
   tópico global_001, pelo mesmo caminho (broker local ou fila).
═══════════════════════════════════════════ */
function marcarModoGlobal(modo) {
  const el = document.getElementById('modoGlobal');
  if (el) el.textContent = (modo === 'pausado') ? 'Pausado' : 'Automático';
}

const btnPausarGlobal  = document.getElementById('btnPausarGlobal');
const btnRetomarGlobal = document.getElementById('btnRetomarGlobal');

if (btnPausarGlobal) {
  btnPausarGlobal.addEventListener('click', () => {
    marcarModoGlobal('pausado');
    enviarComando('global', 'pause');
  });
}
if (btnRetomarGlobal) {
  btnRetomarGlobal.addEventListener('click', () => {
    marcarModoGlobal('auto');
    enviarComando('global', 'auto');
  });
}

function iniciarAdmin() {
  iniciarControlo();
  iniciarBroker();
}

/* Carregado no fim do <body>: normalmente o DOM já está pronto.
   O fallback cobre o caso de ser carregado no <head> com defer/async. */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', iniciarAdmin);
} else {
  iniciarAdmin();
}