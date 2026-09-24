/* ══════════════════════════════════════════
   ESTUFA 01 · sensor.js — monitorização partilhada
   Carregado pelo dashboard (read-only) e pelo painel de admin.
   Totalmente guardado: IDs de DOM ausentes são no-ops.
   Sem import/export (compatível Electron/Capacitor/node --check).

   Mapeamento dos feeds do ThingSpeak (firmware estufa_unificado.ino):
     field1 — Temperatura (°C)
     field2 — Humidade do Solo (%)
     field3 — Luminosidade (Lux)
     field4 — Humidade do Ar (%)
     field5 — Estado do Ventilador       (0 / 1)   — Relé GPIO 26
     field6 — Estado da Válvula Solenoide (0 / 1)  — Relé GPIO 27
     field7 — Brilho/Duty Cycle da Iluminação (0–100 %) — LED WS2811
     field8 — Sinal Wi-Fi (RSSI, dBm)
═══════════════════════════════════════════ */

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

let ultimoCache = { temp: NaN, solo: NaN, lux: NaN, ar: NaN };

/* ══════════════════════════════════════════
   FETCH — ÚLTIMO DADO
═══════════════════════════════════════════ */
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
  const temp   = parseFloat(d.field1); // Temperatura (°C)
  const solo   = parseFloat(d.field2); // Humidade do Solo (%)
  const lux    = parseFloat(d.field3); // Luminosidade (Lux)
  const umidAr = parseFloat(d.field4); // Humidade do Ar (%)
  const vent   = parseInt(d.field5, 10); // Ventilador — Relé GPIO 26 (0/1)
  const valv   = parseInt(d.field6, 10); // Válvula Solenoide — Relé GPIO 27 (0/1)
  const duty   = parseInt(d.field7, 10); // Iluminação LED WS2811 — duty cycle (0-100%)
  const rssi   = parseInt(d.field8, 10); // Sinal Wi-Fi (RSSI)

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
    rssiEl.className = 'sys-value ' + (rssi < -70 ? 'warn' : 'ok');
  }

  /* Alertas automáticos por threshold (só existe no dashboard) */
  if (typeof verificarAlertas === 'function') verificarAlertas(temp, solo, lux, umidAr);
}

/* ══════════════════════════════════════════
   ATUALIZAÇÃO DE UI
═══════════════════════════════════════════ */
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