/* ══════════════════════════════════════════
   ESTUFA 01 · control.js — controlo de atuadores + monitorização ao vivo
   Carregado APENAS pelo painel de admin (admin.html).
   Requer /js/sensor.js carregado antes (funções partilhadas de render).
   Envia comandos via POST /api/control (proxy MQTT local, ver BLUEPRINT §11.1.1).
   Sem import/export (compatível Electron/Capacitor/node --check).
═══════════════════════════════════════════ */

let ctrlLock = false;   // evita duplos-cliques durante envio

/**
 * Lê o token JWT do localStorage (fallback usado em PWA mobile)
 * para enviar junto com pedidos autenticados à API de controlo.
 */
function getAuthToken() {
  return localStorage.getItem('estufa_token');
}

/**
 * Envia um comando para um atuador via /api/control.
 * @param {string} atuador - 'vent' | 'valve' | 'light'
 * @param {string|number} acao - 'on' | 'off' | número (0-100 para luz)
 */
async function enviarComando(atuador, acao) {
  if (ctrlLock) return;
  ctrlLock = true;

  // Desabilita botões durante envio
  const btns = document.querySelectorAll('.ctrl-btn[data-atuador="' + atuador + '"]');
  const slider = document.getElementById('sliderLight');
  btns.forEach(b => b.disabled = true);
  if (slider) slider.disabled = true;

  try {
    const headers = { 'Content-Type': 'application/json' };
    const token = getAuthToken();
    if (token) {
      headers['Authorization'] = 'Bearer ' + token;
    }

    const payload = (atuador === 'light')
      ? { actuator: atuador, action: Number(acao) }
      : { actuator: atuador, action: acao };

    const res = await fetch('/api/control', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      if (res.status === 401) {
        throw new Error('Não autorizado — faça login para controlar.');
      }
      if (res.status === 503) {
        throw new Error('Broker MQTT local indisponível. Este controlo só funciona na rede local da estufa.');
      }
      throw new Error(errBody.detail || 'HTTP ' + res.status);
    }

    // Atualização otimista da UI
    if (atuador === 'light') {
      const pct = Number(acao);
      const dutyCtl = document.getElementById('dutyPctCtrl');
      if (dutyCtl) dutyCtl.textContent = pct + ' %';
      atualizarAtuador('cardLight', 'chipLight', 'lblLight', pct > 0, 'Ligada', 'Apagada');
      mostrarMsgControlo('Iluminação → ' + pct + ' %', 'ok');
    } else {
      const on = acao === 'on';
      const labelLigado = atuador === 'vent' ? 'Ligado' : 'Aberta';
      const labelDeslig = atuador === 'vent' ? 'Desligado' : 'Fechada';
      const cardId = atuador === 'vent' ? 'cardVent' : 'cardValve';
      const chipId = atuador === 'vent' ? 'chipVent' : 'chipValve';
      const lblId = atuador === 'vent' ? 'lblVent' : 'lblValve';
      atualizarAtuador(cardId, chipId, lblId, on, labelLigado, labelDeslig);
      mostrarMsgControlo((atuador === 'vent' ? 'Ventilador' : 'Válvula') + ' → ' + (on ? labelLigado : labelDeslig), 'ok');
    }

    console.log('[CTRL] ' + atuador + ' → ' + acao + ' | OK');
  } catch (e) {
    console.error('[CTRL] Falha:', e.message);
    mostrarMsgControlo(e.message, 'error');
  } finally {
    ctrlLock = false;
    btns.forEach(b => b.disabled = false);
    if (slider) slider.disabled = false;
  }
}

/**
 * Mostra uma mensagem de status de controlo (sucesso/erro) abaixo da grid.
 */
function mostrarMsgControlo(msg, tipo) {
  let el = document.getElementById('ctrlStatusMsg');
  if (!el) {
    el = document.createElement('div');
    el.id = 'ctrlStatusMsg';
    el.className = 'ctrl-status-msg';
    const grid = document.querySelector('.actuator-grid');
    if (grid) grid.parentNode.insertBefore(el, grid.nextSibling);
  }
  el.textContent = (tipo === 'error' ? '⚠ ' : '✓ ') + msg;
  el.classList.remove('show');
  void el.offsetWidth; // force reflow
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 5000);
}

/* ── Event listeners para botões de controlo ─────────────────────────── */
document.querySelectorAll('.ctrl-btn[data-atuador]').forEach(btn => {
  btn.addEventListener('click', function () {
    const atuador = this.getAttribute('data-atuador');
    const acao = this.getAttribute('data-acao');
    enviarComando(atuador, acao);
  });
});

/* ── Event listener para o slider de iluminação ──────────────────────── */
const sliderLight = document.getElementById('sliderLight');
if (sliderLight) {
  sliderLight.addEventListener('input', function (e) {
    const pct = parseInt(e.target.value, 10);
    const lbl = document.getElementById('dutyPctCtrl');
    if (lbl) lbl.textContent = pct + ' %';
  });
  sliderLight.addEventListener('change', function (e) {
    const pct = parseInt(e.target.value, 10);
    enviarComando('light', pct);
  });
}

/* ══════════════════════════════════════════
   MONITORIZAÇÃO AO VIVO (admin)
   Busca o último feed do ThingSpeak e atualiza sensores + atuadores
   a cada INTERVALO_S segundos (funções partilhadas de /js/sensor.js).
═══════════════════════════════════════════ */
async function cicloMonitorizar() {
  if (typeof buscarUltimo !== 'function') {
    console.error('[CTRL] /js/sensor.js não carregou — monitorização inativa.');
    return;
  }
  await buscarUltimo();
}

function iniciarControlo() {
  cicloMonitorizar();
  setInterval(cicloMonitorizar, (typeof INTERVALO_S === 'number' ? INTERVALO_S : 16) * 1000);
}

/* O ficheiro é carregado no fim do <body>: normalmente o DOM já está pronto.
   O fallback cobre o caso de ser carregado no <head> com defer/async. */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', iniciarControlo);
} else {
  iniciarControlo();
}

