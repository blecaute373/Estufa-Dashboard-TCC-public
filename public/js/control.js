/* ══════════════════════════════════════════
   ESTUFA 01 · control.js — controlo manual de atuadores (admin)
   Fala com a rota já existente no server.js: POST /api/control
     body: { actuator: 'vent'|'valve'|'light', action: 'on'|'off'|'auto'|<0-100> }
   O browser nunca toca no broker MQTT — só o backend (getMqttClient em
   server.js), que publica nos tópicos fazenda/estufa01/atuador/<id>/comando.
   Também mantém a monitorização ao vivo do admin: cicloMonitorizar() faz
   polling do feed via buscarUltimo() (/js/sensor.js) a cada INTERVALO_S.
═══════════════════════════════════════════ */

const URL_CONTROL = '/api/control';
let statusTimer = null;

/* ══════════════════════════════════════════
   ENVIO DE COMANDO
═══════════════════════════════════════════ */
async function enviarComando(actuator, action) {
  setBotoesDisabled(actuator, true);
  try {
    const res = await fetch(URL_CONTROL, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actuator, action }),
    });

    if (res.status === 401) { window.location.href = '/index.html'; return; }

    const payload = await res.json().catch(() => null);

    if (res.status === 503) {
      mostrarStatus('Broker MQTT local indisponível — comando não entregue.', 'warn');
      return;
    }
    if (!res.ok) {
      mostrarStatus(apiErrorMessage(payload, 'Falha ao enviar comando.'), 'warn');
      return;
    }

    mostrarStatus(`Comando enviado: ${actuator} → ${action}`, 'ok');
  } catch (e) {
    mostrarStatus('Erro de rede ao enviar comando.', 'warn');
    console.error('[control] Erro:', e);
  } finally {
    setBotoesDisabled(actuator, false);
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
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', iniciarControlo);
} else {
  iniciarControlo();
}