/**
 * Estufa 01 — Consola administrativa (logs e utilizadores)
 *
 * Estava inline em `admin.html`, em dois blocos que se completavam: o segundo
 * envolvia (wrap) funções do primeiro. Isso obrigava a que a ordem de dois
 * `<script>` separados fosse respeitada sem nada que o garantisse; agora é um
 * ficheiro só, lido de cima para baixo.
 *
 * Os handlers são globais porque o HTML os chama por `onclick`:
 * `loadAll`, `loadLogs`, `loadUsers`, `filterLogs`, `searchLogs`, `doLogout`.
 */
'use strict';

/* ── ESTADO ── */
let allLogs = [];
const evLabels = { login: 'Login', register: 'Registro', logout: 'Logout', failed_login: 'Falha' };

function fmt(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('pt-BR');
}

function shortUA(ua) {
  if (!ua || ua === 'unknown') return '—';
  const m = ua.match(/(Chrome|Firefox|Safari|Edge|OPR|Opera|Brave)\/[\d.]+/i);
  return m ? m[0] : ua.substring(0, 30) + '…';
}

function unwrapList(payload) {
  // Backend responde { data, pagination } (v1.2+); mantém compat com array puro legado.
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.data)) return payload.data;
  return [];
}

async function loadLogs() {
  try {
    const r = await fetch('/api/admin/logs?limit=200', { credentials: 'same-origin' });
    if (r.status === 401) { window.location.href = '/index.html'; return; }
    const payload = await r.json();
    if (!r.ok) {
      logsTbody.innerHTML = `<tr><td colspan="6" class="no-data">${apiErrorMessage(payload, 'Erro ao carregar')}</td></tr>`;
      return;
    }
    allLogs = unwrapList(payload);
    renderLogs(allLogs);
    computeStats(allLogs);
  } catch {
    logsTbody.innerHTML = '<tr><td colspan="6" class="no-data">Erro ao carregar</td></tr>';
  }
}

async function loadUsers() {
  try {
    const r = await fetch('/api/admin/users', { credentials: 'same-origin' });
    if (r.status === 401) { window.location.href = '/index.html'; return; }
    const payload = await r.json();
    const users = unwrapList(payload);
    document.getElementById('statUsers').textContent = users.length;
    const tb = document.getElementById('usersTbody');
    if (!users.length) { tb.innerHTML = '<tr><td colspan="6" class="no-data">Nenhum usuário</td></tr>'; return; }
    tb.innerHTML = users.map(u => `
      <tr>
        <td>${u.id}</td>
        <td>${u.username}</td>
        <td>${u.email}</td>
        <td class="${u.is_active ? 'u-active' : 'u-inactive'}">${u.is_active ? '● Ativo' : '○ Inativo'}</td>
        <td>${fmt(u.created_at)}</td>
        <td>${fmt(u.last_login)}</td>
      </tr>
    `).join('');
  } catch {
    document.getElementById('usersTbody').innerHTML = '<tr><td colspan="6" class="no-data">Erro ao carregar</td></tr>';
  }
}

function renderLogs(logs) {
  const tb = document.getElementById('logsTbody');
  if (!logs.length) { tb.innerHTML = '<tr><td colspan="6" class="no-data">Nenhum registro</td></tr>'; return; }
  tb.innerHTML = logs.map(l => {
    const evClass = `ev-${l.event}`;
    const evTxt = evLabels[l.event] || l.event;
    const details = l.details ? JSON.parse(l.details) : null;
    const detTxt = details?.reason ? `(${details.reason})` : '—';
    return `
      <tr>
        <td>${fmt(l.created_at)}</td>
        <td>${l.username || '—'}</td>
        <td><span class="ev-badge ${evClass}">${evTxt}</span></td>
        <td>${l.ip_address || '—'}</td>
        <td>${detTxt}</td>
        <td title="${l.user_agent || ''}">${shortUA(l.user_agent)}</td>
      </tr>
    `;
  }).join('');

function computeStats(logs) {
  const logins = logs.filter(l => l.event === 'login').length;
  const failed = logs.filter(l => l.event === 'failed_login').length;
  const lastLogin = logs.find(l => l.event === 'login');
  document.getElementById('statLogins').textContent = logins;
  document.getElementById('statFailed').textContent = failed;
  document.getElementById('statLast').textContent = lastLogin ? fmt(lastLogin.created_at) : '—';
}

function filterLogs(filter, btn) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderLogs(filter === 'all' ? allLogs : allLogs.filter(l => l.event === filter));
}

async function doLogout() {
  const savedToken = localStorage.getItem('estufa_token');
  const opts = { method: 'POST', credentials: 'same-origin' };
  if (savedToken) opts.headers = { 'Authorization': 'Bearer ' + savedToken };
  await fetch('/api/auth/logout', opts);
  localStorage.removeItem('estufa_token');
  window.location.href = '/login-admin.html';
}

function loadAll() { loadLogs(); loadUsers(); }
loadAll();
setInterval(loadAll, 30000);

/* ── Extras de UI da consola ──
   Envolve a busca ao trocar de filtro e mantém os contadores do rodapé em
   sincronia com o DOM, sem alterar a lógica original (que preenche as tabelas
   por vários caminhos). */
(function () {
  const _filterLogs = window.filterLogs;

  const rows = sel => Array.from(document.querySelectorAll(sel))
    .filter(r => !r.querySelector('.no-data') && !r.classList.contains('loading-row')).length;

  function paintLogs() {
    const el = document.getElementById('logsPagerInfo');
    if (el) el.textContent = rows('#logsTbody tr') + ' evento(s) exibido(s)';
  }
  function paintUsers() {
    const el = document.getElementById('usersPagerInfo');
    if (el) el.textContent = rows('#usersTbody tr') + ' usuário(s)';
  }

  window.filterLogs = function (filter, btn) {
    _filterLogs(filter, btn);
    searchLogs(document.getElementById('logSearch').value);
  };

  /* As tabelas são preenchidas pela carga inicial, pelo botão Recarregar e
     pelo intervalo de 30s: observar o DOM cobre todos os caminhos. */
  const observe = (id, paint) => {
    const tb = document.getElementById(id);
    if (tb && 'MutationObserver' in window) {
      new MutationObserver(paint).observe(tb, { childList: true, subtree: true });
    }
  };
  observe('logsTbody', paintLogs);
  observe('usersTbody', paintUsers);

  paintLogs();
  paintUsers();
})();

function activeFilter() {
  const b = document.querySelector('.filter-btn.active');
  return b ? b.dataset.filter : 'all';
}

function searchLogs(term) {
  const q = (term || '').trim().toLowerCase();
  const f = activeFilter();
  let list = f === 'all' ? allLogs.slice() : allLogs.filter(l => l.event === f);
  if (q) {
    list = list.filter(l =>
      String(l.username || '').toLowerCase().includes(q) ||
      String(l.ip_address || '').toLowerCase().includes(q) ||
      String(l.event || '').toLowerCase().includes(q)
    );
  }
  renderLogs(list);
}

}
