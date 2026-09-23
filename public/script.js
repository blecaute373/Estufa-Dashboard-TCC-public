/* ══════════════════════════════════════════
   CONFIGURAÇÃO
   INTERVALO_S / URL_LAST / URL_FEEDS / TH vivem em /js/sensor.js,
   carregado ANTES deste ficheiro (ver <script> no dashboard.html).
   Também de lá vêm (escopo global partilhado):
     buscarUltimo(), processarUltimo(),
     estadoTemp/Solo/Lux/Ar(), atualizarSensor(),
     setDelta(), setStateDot(), atualizarAtuador(),
     setStatus(), setText().
   Este ficheiro acrescenta apenas o que é exclusivo do dashboard:
   gráfico Chart.js, alertas, countdown, exportação CSV e auth.
══════════════════════════════════════════ */

let qtdPontos = 60;
let mainChart = null;
let countdownTimer = null;
let segundosRestantes = INTERVALO_S;
let alertasCount = 0;
let ultimoHistorico = [];

/* buscarUltimo() e processarUltimo() vivem em /js/sensor.js */

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

/* CIRC, estadoTemp/Solo/Lux/Ar(), atualizarSensor(), setDelta(),
   setStateDot(), atualizarAtuador(), setStatus() e setText()
   vivem em /js/sensor.js (escopo global partilhado). */

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
   CONTROLO DE ATUADORES → /js/control.js
   Por segurança, o dashboard é SÓ-LEITURA: enviarComando() e os
   listeners de .ctrl-btn / #sliderLight vivem em /js/control.js,
   carregado apenas pelo painel de admin (autenticado).
   Endpoint: POST /api/control (proxy MQTT local, BLUEPRINT §11.1.1).
══════════════════════════════════════════ */

/* Os listeners de .ctrl-btn[data-atuador] e #sliderLight são
   registados por /js/control.js no painel de admin. */

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
