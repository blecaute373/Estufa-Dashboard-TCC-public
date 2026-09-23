/* ══════════════════════════════════════════
   CONFIGURAÇÃO
══════════════════════════════════════════ */
const INTERVALO_S = 16;

// URLs do proxy ThingSpeak (via backend, sem CORS)
const URL_LAST  = '/api/thingspeak/last';
const URL_FEEDS = (n) => `/api/thingspeak/history?results=${n}`;

/* thresholds do master (sketch_apr13a.ino) */
const TH = {
  tempSup: 30, tempInf: 26,
  soloInf: 40, soloSup: 70,
  luxMin: 100, luxMax: 600,
  umidArCrit: 30,
};

let qtdPontos = 60;
let mainChart = null;
let countdownTimer = null;
let segundosRestantes = INTERVALO_S;
let alertasCount = 0;
let ultimoCache = { temp: NaN, solo: NaN, lux: NaN, ar: NaN };
let ultimoHistorico = [];

/* ══════════════════════════════════════════
   FETCH — ÚLTIMO DADO
══════════════════════════════════════════ */
async function buscarUltimo() {
  try {
    const res  = await fetch(URL_LAST);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    processarUltimo(data);
    setStatus('online', 'Online');
  } catch(e) {
    setStatus('offline', 'Sem conexão');
    console.error('[TS] Erro:', e);
  }
}

function processarUltimo(d) {
  const temp   = parseFloat(d.field1);
  const solo   = parseFloat(d.field2);
  const lux    = parseFloat(d.field3);
  const umidAr = parseFloat(d.field4);
  const vent   = parseInt(d.field5, 10);
  const valv   = parseInt(d.field6, 10);
  const duty   = parseInt(d.field7, 10);
  const rssi   = parseInt(d.field8, 10);

  /* Sensores — valor + delta vs leitura anterior + estado */
  atualizarSensor('valTemp', 'barTemp', 'ringTemp', 'deltaTemp', 'stateTemp', temp,   40,  1, ultimoCache.temp, estadoTemp(temp));
  atualizarSensor('valSolo', 'barSolo', 'ringSolo', 'deltaSolo', 'stateSolo', solo,   100, 0, ultimoCache.solo, estadoSolo(solo));
  atualizarSensor('valLux',  'barLux',  'ringLux',  'deltaLux',  'stateLux',  lux,    800, 0, ultimoCache.lux,  estadoLux(lux));
  atualizarSensor('valAr',   'barAr',   'ringAr',   'deltaAr',   'stateAr',   umidAr, 100, 1, ultimoCache.ar,   estadoAr(umidAr));
  ultimoCache = { temp, solo, lux, ar: umidAr };

  const stamp = d.created_at ? new Date(d.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—';
  setText('kpiUpdated', 'atualizado ' + stamp);

  /* Atuadores */
  atualizarAtuador('cardVent',  'chipVent',  'lblVent',  vent === 1, 'Ligado',  'Desligado');
  atualizarAtuador('cardValve', 'chipValve', 'lblValve', valv === 1, 'Aberta',  'Fechada');
  atualizarAtuador('cardLight', 'chipLight', 'lblLight', duty > 0,  'Ligada',  'Apagada');

  const dutyEl = document.getElementById('dutyPct');
  const dutyBar = document.getElementById('dutyBar');
  const dutyCtrl = document.getElementById('dutyPctCtrl');
  const slider = document.getElementById('sliderLight');
  const dutyVal = isNaN(duty) ? 0 : duty;
  if(dutyEl) dutyEl.textContent = dutyVal;
  if(dutyBar) dutyBar.style.width = dutyVal + '%';
  if(dutyCtrl) dutyCtrl.textContent = dutyVal + ' %';
  // Sincroniza o slider com o estado real vindo do ThingSpeak,
  // sem disparar o envio de comando (atualização só de leitura)
  if(slider && document.activeElement !== slider) slider.value = dutyVal;

  /* Sistema */
  const hora = d.created_at ? new Date(d.created_at).toLocaleString('pt-BR') : '--';
  setText('sysUltima', hora);
  const rssiEl = document.getElementById('sysRssi');
  if(rssiEl) {
    rssiEl.textContent = isNaN(rssi) ? '--' : rssi + ' dBm';
    rssiEl.className = 'sys-value ' + (rssi > -70 ? 'ok' : rssi > -85 ? 'warn' : 'danger');
  }

  /* Alertas automáticos por threshold */
  verificarAlertas(temp, solo, lux, umidAr);
}

/* ══════════════════════════════════════════
   FETCH — HISTÓRICO PARA GRÁFICO
══════════════════════════════════════════ */
async function buscarHistorico() {
  if (typeof Chart === 'undefined') {
    mostrarErroGrafico('Biblioteca de gráficos indisponível (CDN). Verifique a ligação e tente de novo.');
    return;
  }
  try {
    const res  = await fetch(URL_FEEDS(qtdPontos));
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const feeds = data.feeds || [];
    ultimoHistorico = feeds;

    setText('sysEntradas', feeds.length + ' pts');
    setText('chartSub', feeds.length + ' pontos · clique na legenda para ocultar');

    const pts = {
      temp:    [], solo:    [], lux:     [], ar: []
    };

    feeds.forEach(f => {
      const t = new Date(f.created_at).getTime();
      const v1 = parseFloat(f.field1);
      const v2 = parseFloat(f.field2);
      const v3 = parseFloat(f.field3);
      const v4 = parseFloat(f.field4);
      if(!isNaN(v1)) pts.temp.push({ x: t, y: v1 });
      if(!isNaN(v2)) pts.solo.push({ x: t, y: v2 });
      if(!isNaN(v3)) pts.lux.push({  x: t, y: v3 / 10 });
      if(!isNaN(v4)) pts.ar.push({   x: t, y: v4 });
    });

    if(!mainChart) initChart();
    if(mainChart) {
      esconderErroGrafico();
      mainChart.data.datasets[0].data = pts.temp;
      mainChart.data.datasets[1].data = pts.solo;
      mainChart.data.datasets[2].data = pts.lux;
      mainChart.data.datasets[3].data = pts.ar;
      mainChart.update('none');
    }
  } catch(e) {
    console.error('[TS] Histórico erro:', e);
    mostrarErroGrafico('Falha ao carregar o histórico do ThingSpeak. Tente de novo.');
  }
}

function exportarCSV() {
  try {
    const rows = [['timestamp', 'temperatura_c', 'umidade_solo_pct', 'luminosidade_lux', 'umidade_ar_pct']];
    (ultimoHistorico || []).forEach(f => {
      rows.push([f.created_at || '', f.field1 ?? '', f.field2 ?? '', f.field3 ?? '', f.field4 ?? '']);
    });
    if (rows.length <= 1) {
      registrarAlerta('warn', '⬇ Nenhum dado para exportar ainda. Aguarde a próxima atualização.');
      return;
    }
    const csv = rows.map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'estufa01-historico-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
  } catch (e) {
    console.error('[CSV] Erro:', e);
  }
}

/* ══════════════════════════════════════════
   ALERTAS POR THRESHOLD
══════════════════════════════════════════ */
const alertasJaDisparados = new Set();

function verificarAlertas(temp, solo, lux, umidAr) {
  const checks = [
    { key:'temp-alta',  cond: temp > TH.tempSup,        tipo:'danger', msg:`🌡️ Temperatura alta: ${temp?.toFixed(1)}°C (limite ${TH.tempSup}°C)` },
    { key:'temp-baixa', cond: temp < TH.tempInf && temp > 0, tipo:'warn', msg:`🌡️ Temperatura baixa: ${temp?.toFixed(1)}°C (mínimo ${TH.tempInf}°C)` },
    { key:'solo-baixo', cond: solo < TH.soloInf,        tipo:'warn',   msg:`🌱 Solo seco: ${solo?.toFixed(0)}% — válvula deve estar aberta` },
    { key:'solo-alto',  cond: solo > TH.soloSup,        tipo:'info',   msg:`🌱 Solo saturado: ${solo?.toFixed(0)}% — válvula deve estar fechada` },
    { key:'umid-crit',  cond: umidAr < TH.umidArCrit && umidAr > 0, tipo:'danger', msg:`💧 Umidade do ar crítica: ${umidAr?.toFixed(1)}%` },
  ];

  checks.forEach(c => {
    if(c.cond && !alertasJaDisparados.has(c.key)) {
      alertasJaDisparados.add(c.key);
      registrarAlerta(c.tipo, c.msg);
    } else if(!c.cond) {
      alertasJaDisparados.delete(c.key);
    }
  });
}

function registrarAlerta(tipo, msg) {
  const log = document.getElementById('alertsLog');
  const noAl = document.getElementById('noAlerts');
  if(noAl) noAl.remove();

  const hora = new Date().toLocaleTimeString('pt-BR');
  const item = document.createElement('div');
  item.className = `log-item ${tipo}`;
  item.innerHTML = `<span class="log-time">${hora}</span><span class="log-msg">${msg}</span>`;
  log.prepend(item);

  alertasCount++;
  const badge = document.getElementById('badgeCount');
  if(badge) { badge.textContent = alertasCount; badge.classList.remove('hidden'); }
}

function limparAlertas() {
  const log = document.getElementById('alertsLog');
  log.innerHTML = '<div class="no-alerts" id="noAlerts">Nenhum alerta — sistema saudável 🌿</div>';
  alertasCount = 0;
  const badge = document.getElementById('badgeCount');
  if(badge) { badge.textContent = '0'; badge.classList.add('hidden'); }
  alertasJaDisparados.clear();
}

/* ══════════════════════════════════════════
   ATUALIZAÇÃO DE UI
══════════════════════════════════════════ */
const CIRC = 2 * Math.PI * 17; // = 106.8

function estadoTemp(v) {
  if (isNaN(v)) return ['idle', '—'];
  if (v > TH.tempSup) return ['danger', 'acima do ideal'];
  if (v < TH.tempInf && v > 0) return ['warn', 'abaixo do ideal'];
  return ['ok', 'ideal'];
}
function estadoSolo(v) {
  if (isNaN(v)) return ['idle', '—'];
  if (v < TH.soloInf) return ['warn', 'seco'];
  if (v > TH.soloSup) return ['warn', 'saturado'];
  return ['ok', 'ideal'];
}
function estadoLux(v) {
  if (isNaN(v)) return ['idle', '—'];
  if (v < TH.luxMin) return ['warn', 'baixa luz'];
  if (v > TH.luxMax) return ['warn', 'luz alta'];
  return ['ok', 'ideal'];
}
function estadoAr(v) {
  if (isNaN(v)) return ['idle', '—'];
  if (v > 0 && v < TH.umidArCrit) return ['danger', 'crítico'];
  return ['ok', 'estável'];
}

function atualizarSensor(idVal, idBar, idRing, idDelta, idState, valor, max, casas, anterior, estado) {
  const elVal  = document.getElementById(idVal);
  const elBar  = document.getElementById(idBar);
  const elRing = document.getElementById(idRing);
  if(!elVal) return;

  elVal.classList.remove('shimmer');
  elVal.classList.remove('skel');

  if(isNaN(valor)) {
    const unit0 = elVal.querySelector('.sensor-unit');
    elVal.textContent = '--';
    if(unit0) elVal.appendChild(unit0);
    setDelta(idDelta, NaN, NaN);
    setStateDot(idState, 'idle', '—');
    return;
  }

  const disp = valor.toFixed(casas);
  const unit = elVal.querySelector('.sensor-unit');
  elVal.textContent = disp;
  if(unit) elVal.appendChild(unit);

  const pct  = Math.max(0, Math.min(valor / max, 1));
  if(elBar)  elBar.style.width = (pct * 100) + '%';
  if(elRing) elRing.style.strokeDashoffset = CIRC * (1 - pct);
  setDelta(idDelta, valor, anterior);
  if (estado) setStateDot(idState, estado[0], estado[1]);
}

function setDelta(id, atual, anterior) {
  const el = document.getElementById(id);
  if (!el) return;
  if (isNaN(atual) || isNaN(anterior)) { el.textContent = '— primeira leitura'; el.className = 'delta flat'; return; }
  const diff = atual - anterior;
  if (Math.abs(diff) < 1e-9) { el.textContent = '→ estável'; el.className = 'delta flat'; return; }
  const arrow = diff > 0 ? '▲' : '▼';
  el.textContent = arrow + ' ' + Math.abs(diff).toFixed(1) + ' vs anterior';
  el.className = 'delta ' + (diff > 0 ? 'up' : 'down');
}

function setStateDot(id, cls, txt) {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = 'state-dot state-' + cls;
  el.textContent = txt;
}

function atualizarAtuador(cardId, chipId, lblId, ligado, txtOn, txtOff) {
  const card = document.getElementById(cardId);
  const chip = document.getElementById(chipId);
  const lbl  = document.getElementById(lblId);
  if(!card) return;

  card.classList.toggle('is-on', ligado);
  if(chip) chip.className = 'act-chip ' + (ligado ? 'chip-on' : 'chip-off');
  if(lbl)  lbl.textContent = ligado ? txtOn : txtOff;
}

function setStatus(cls, txt) {
  const pill = document.getElementById('statusPill');
  const text = document.getElementById('statusText');
  if(pill) pill.className = 'status-pill ' + cls;
  if(text) text.textContent = txt;
}

function setText(id, v) {
  const el = document.getElementById(id);
  if(el) el.textContent = v ?? '--';
}

/* ══════════════════════════════════════════
   COUNTDOWN
══════════════════════════════════════════ */
function iniciarContagem() {
  clearInterval(countdownTimer);
  segundosRestantes = INTERVALO_S;

  countdownTimer = setInterval(() => {
    segundosRestantes--;
    const pct = (segundosRestantes / INTERVALO_S) * 100;
    const bar = document.getElementById('countdownBar');
    const prox = document.getElementById('sysProxima');
    if(bar) bar.style.width = pct + '%';
    if(prox) prox.textContent = `em ${segundosRestantes}s`;

    if(segundosRestantes <= 0) {
      clearInterval(countdownTimer);
      cicloAtualizar();
    }
  }, 1000);
}

/* ══════════════════════════════════════════
   GRÁFICO
══════════════════════════════════════════ */
function initChart() {
  // Se Chart.js não carregou (CDN falhou), mostra erro pro com retry
  if (typeof Chart === 'undefined') {
    mostrarErroGrafico('Biblioteca de gráficos indisponível (CDN). Verifique a ligação e tente de novo.');
    return;
  }

  const canvas = document.getElementById('mainChart');
  const ctx = canvas?.getContext('2d');
  if (!ctx) return;
  esconderErroGrafico();

  const dark = (document.documentElement.getAttribute('data-theme') || 'dark') !== 'light';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const grad = (hex, a) => {
    try {
      const g = ctx.createLinearGradient(0, 0, 0, 260);
      g.addColorStop(0, hex + a);
      g.addColorStop(1, hex + '00');
      return g;
    } catch (e) { return hex + '14'; }
  };

  mainChart = new Chart(ctx, {
    type: 'line',
    data: {
      datasets: [
        { label:'Temp °C',     borderColor:'#fca5a5', backgroundColor:grad('#fca5a5','38'), borderWidth:2, pointRadius:0, pointHoverRadius:4, tension:0.4, fill:true, data:[] },
        { label:'Umid Solo %', borderColor:'#fbbf24', backgroundColor:grad('#fbbf24','30'), borderWidth:2, pointRadius:0, pointHoverRadius:4, tension:0.4, fill:true, data:[] },
        { label:'Lux ÷10',     borderColor:'#fde047', backgroundColor:grad('#fde047','26'), borderWidth:1.5, pointRadius:0, pointHoverRadius:4, tension:0.4, fill:true, data:[] },
        { label:'Umid Ar %',   borderColor:'#67e8f9', backgroundColor:grad('#67e8f9','30'), borderWidth:2, pointRadius:0, pointHoverRadius:4, tension:0.4, fill:true, data:[] },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: reduceMotion ? false : { duration: 350 },
      interaction: { mode:'index', intersect:false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: dark ? 'rgba(6,14,8,.96)' : 'rgba(255,255,255,.98)',
          titleColor: dark ? '#ecf7ee' : '#0c1f13',
          bodyColor: dark ? '#9df0b6' : '#14532d',
          padding:12, borderColor:'rgba(74,222,128,.25)', borderWidth:1,
          titleFont: { family: "'JetBrains Mono', monospace", size: 11 },
          callbacks: {
            title: items => items[0]?.parsed ? new Date(items[0].parsed.x).toLocaleString('pt-BR') : '',
          }
        }
      },
      scales: {
        x: {
          type:'time',
          time: { displayFormats: { minute:'HH:mm', hour:'dd/MM HH:mm' } },
          grid: { color: dark ? 'rgba(236,247,238,.055)' : 'rgba(12,31,19,.07)' },
          ticks: { color: dark ? '#7ea88a' : '#4d6f58', maxTicksLimit:7, font: { size: 10 } }
        },
        y: {
          min:0, max:110,
          grid: { color: dark ? 'rgba(236,247,238,.055)' : 'rgba(12,31,19,.07)' },
          ticks: { color: dark ? '#7ea88a' : '#4d6f58', font: { size: 10 } }
        }
      }
    }
  });
  syncLegend();
}

function mostrarErroGrafico(msg) {
  const box = document.getElementById('chartError');
  const canvas = document.getElementById('mainChart');
  if (box) box.classList.add('show');
  if (canvas) canvas.style.display = 'none';
  setText('chartErrorMsg', msg || 'Não foi possível carregar o histórico.');
  setText('chartSub', 'erro — tente de novo');
}

function esconderErroGrafico() {
  const box = document.getElementById('chartError');
  const canvas = document.getElementById('mainChart');
  if (box) box.classList.remove('show');
  if (canvas) canvas.style.display = '';
}

function syncLegend() {
  document.querySelectorAll('.legend-item[data-series]').forEach(btn => {
    const i = parseInt(btn.dataset.series, 10);
    const hidden = mainChart ? !mainChart.isDatasetVisible(i) : false;
    btn.classList.toggle('off', hidden);
    btn.setAttribute('aria-pressed', hidden ? 'false' : 'true');
  });
}

/* period + legend buttons */
document.querySelectorAll('.period-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.period-btn').forEach(b => { b.classList.remove('active'); b.removeAttribute('aria-pressed'); });
    btn.classList.add('active');
    btn.setAttribute('aria-pressed', 'true');
    qtdPontos = parseInt(btn.dataset.n, 10);
    buscarHistorico();
  });
});

document.querySelectorAll('.legend-item[data-series]').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!mainChart) return;
    const i = parseInt(btn.dataset.series, 10);
    const visible = mainChart.isDatasetVisible(i);
    if (visible) mainChart.hide(i); else mainChart.show(i);
    syncLegend();
  });
});

/* ══════════════════════════════════════════
   CONTROLO ATIVO DE ATUADORES
   Envia comandos via POST /api/control (proxy MQTT local)
   ══════════════════════════════════════════ */

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
    } else {
      const on = acao === 'on';
      const labelLigado = atuador === 'vent' ? 'Ligado' : 'Aberta';
      const labelDeslig = atuador === 'vent' ? 'Desligado' : 'Fechada';
      const cardId = atuador === 'vent' ? 'cardVent' : 'cardValve';
      const chipId = atuador === 'vent' ? 'chipVent' : 'chipValve';
      const lblId = atuador === 'vent' ? 'lblVent' : 'lblValve';
      atualizarAtuador(cardId, chipId, lblId, on, labelLigado, labelDeslig);
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

/* ── Event listener para o slider de iluminação ─────────────────────── */
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
   CICLO PRINCIPAL
   ══════════════════════════════════════════ */
async function cicloAtualizar() {
  const info = document.getElementById('refreshInfo');
  if(info) info.textContent = 'Atualizando…';
  await buscarUltimo();
  await buscarHistorico();
  const hora = new Date().toLocaleTimeString('pt-BR');
  if(info) info.textContent = `Atualizado às ${hora}`;
  iniciarContagem();
}

/* ══════════════════════════════════════════
   AUTH
══════════════════════════════════════════ */
async function verificarAuth() {
  try {
    const headers = { credentials: 'same-origin' };
    // Fallback para PWA: enviar token salvo no localStorage como Authorization header
    const savedToken = localStorage.getItem('estufa_token');
    if (savedToken) {
      headers.headers = { 'Authorization': 'Bearer ' + savedToken };
    }
    const r = await fetch('/api/auth/me', headers);
    if (r.status === 401) {
      localStorage.removeItem('estufa_token');
      window.location.href = '/login-dashboard.html';
      return;
    }
    const u = await r.json();
    const el = document.getElementById('authUser');
    if (el) el.textContent = '🌿 ' + u.username;
  } catch { window.location.href = '/login-dashboard.html'; }
}

async function doLogout() {
  const savedToken = localStorage.getItem('estufa_token');
  const opts = { method: 'POST', credentials: 'same-origin' };
  if (savedToken) {
    opts.headers = { 'Authorization': 'Bearer ' + savedToken };
  }
  await fetch('/api/auth/logout', opts);
  localStorage.removeItem('estufa_token');
  window.location.href = '/login-dashboard.html';
}

/* ══════════════════════════════════════════
   INIT
══════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {
  await verificarAuth();
  try { initChart(); } catch(e) { mostrarErroGrafico('Não foi possível iniciar o gráfico.'); }
  cicloAtualizar();
});

window.addEventListener('theme:changed', () => {
  if (!mainChart) return;
  try {
    const dark = (document.documentElement.getAttribute('data-theme') || 'dark') !== 'light';
    const grid = dark ? 'rgba(236,247,238,.055)' : 'rgba(12,31,19,.07)';
    const tick = dark ? '#7ea88a' : '#4d6f58';
    mainChart.options.scales.x.grid.color = grid;
    mainChart.options.scales.y.grid.color = grid;
    mainChart.options.scales.x.ticks.color = tick;
    mainChart.options.scales.y.ticks.color = tick;
    mainChart.options.plugins.tooltip.backgroundColor = dark ? 'rgba(6,14,8,.96)' : 'rgba(255,255,255,.98)';
    mainChart.update('none');
  } catch (e) {}
});
