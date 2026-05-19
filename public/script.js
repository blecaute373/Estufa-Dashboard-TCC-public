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
  const vent   = parseInt(d.field5);
  const valv   = parseInt(d.field6);
  const duty   = parseInt(d.field7);
  const rssi   = parseInt(d.field8);

  /* Sensores */
  atualizarSensor('valTemp', 'barTemp', 'ringTemp', temp,   40,  1);
  atualizarSensor('valSolo', 'barSolo', 'ringSolo', solo,   100, 0);
  atualizarSensor('valLux',  'barLux',  'ringLux',  lux,    800, 0);
  atualizarSensor('valAr',   'barAr',   'ringAr',   umidAr, 100, 1);

  /* Atuadores */
  atualizarAtuador('cardVent',  'chipVent',  'lblVent',  vent === 1, 'Ligado',  'Desligado');
  atualizarAtuador('cardValve', 'chipValve', 'lblValve', valv === 1, 'Aberta',  'Fechada');
  atualizarAtuador('cardLight', 'chipLight', 'lblLight', duty > 0,  'Ligada',  'Apagada');

  const dutyEl = document.getElementById('dutyPct');
  const dutyBar = document.getElementById('dutyBar');
  if(dutyEl) dutyEl.textContent = isNaN(duty) ? 0 : duty;
  if(dutyBar) dutyBar.style.width = (isNaN(duty) ? 0 : duty) + '%';

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
  try {
    const res  = await fetch(URL_FEEDS(qtdPontos));
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const feeds = data.feeds || [];

    setText('sysEntradas', feeds.length + ' pts');

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

    if(mainChart) {
      mainChart.data.datasets[0].data = pts.temp;
      mainChart.data.datasets[1].data = pts.solo;
      mainChart.data.datasets[2].data = pts.lux;
      mainChart.data.datasets[3].data = pts.ar;
      mainChart.update('none');
    }
  } catch(e) {
    console.error('[TS] Histórico erro:', e);
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

function atualizarSensor(idVal, idBar, idRing, valor, max, casas) {
  const elVal  = document.getElementById(idVal);
  const elBar  = document.getElementById(idBar);
  const elRing = document.getElementById(idRing);
  if(!elVal) return;

  elVal.classList.remove('shimmer');

  if(isNaN(valor)) { elVal.innerHTML = '--'; return; }

  const disp = valor.toFixed(casas);
  const unit = elVal.querySelector('.sensor-unit');
  elVal.innerHTML = disp;
  if(unit) elVal.appendChild(unit);

  const pct  = Math.min(valor / max, 1);
  if(elBar)  elBar.style.width = (pct * 100) + '%';
  if(elRing) elRing.style.strokeDashoffset = CIRC * (1 - pct);
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
  const ctx = document.getElementById('mainChart').getContext('2d');

  mainChart = new Chart(ctx, {
    type: 'line',
    data: {
      datasets: [
        { label:'Temp °C',     borderColor:'#fca5a5', backgroundColor:'rgba(252,165,165,0.05)', borderWidth:2, pointRadius:0, pointHoverRadius:4, tension:0.4, fill:true, data:[] },
        { label:'Umid Solo %', borderColor:'#fbbf24', backgroundColor:'rgba(251,191,36,0.05)',   borderWidth:2, pointRadius:0, pointHoverRadius:4, tension:0.4, fill:true, data:[] },
        { label:'Lux ÷10',     borderColor:'#fde047', backgroundColor:'rgba(253,224,71,0.04)',   borderWidth:1.5, pointRadius:0, pointHoverRadius:4, tension:0.4, fill:true, data:[] },
        { label:'Umid Ar %',   borderColor:'#67e8f9', backgroundColor:'rgba(103,232,249,0.05)', borderWidth:2, pointRadius:0, pointHoverRadius:4, tension:0.4, fill:true, data:[] },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: { duration: 300 },
      interaction: { mode:'index', intersect:false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor:'rgba(8,18,10,0.95)',
          padding:12, borderColor:'rgba(74,222,128,0.15)', borderWidth:1,
          callbacks: {
            title: ctx => ctx[0]?.parsed ? new Date(ctx[0].parsed.x).toLocaleString('pt-BR') : '',
          }
        }
      },
      scales: {
        x: {
          type:'time',
          time: { displayFormats: { minute:'HH:mm', hour:'dd/MM HH:mm' } },
          grid: { color:'rgba(255,255,255,0.03)' },
          ticks: { color:'#4d7355', maxTicksLimit:7 }
        },
        y: {
          min:0, max:110,
          grid: { color:'rgba(255,255,255,0.03)' },
          ticks: { color:'#4d7355' }
        }
      }
    }
  });
}

/* period buttons */
document.querySelectorAll('.period-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    qtdPontos = parseInt(btn.dataset.n);
    buscarHistorico();
  });
});

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
    const r = await fetch('/api/auth/me');
    if (r.status === 401) { window.location.href = '/index.html'; return; }
    const u = await r.json();
    const el = document.getElementById('authUser');
    if (el) el.textContent = '🌿 ' + u.username;
  } catch { window.location.href = '/index.html'; }
}

async function doLogout() {
  await fetch('/api/auth/logout', { method: 'POST' });
  window.location.href = '/index.html';
}

/* ══════════════════════════════════════════
   INIT
══════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {
  await verificarAuth();
  initChart();
  cicloAtualizar();
});