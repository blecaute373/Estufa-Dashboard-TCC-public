/**
 * Estufa 01 — Helpers de UI das páginas de autenticação
 *
 * PORQUÊ UM FICHEIRO SEPARADO: estes helpers estavam copiados dentro do
 * `<script>` de `index.html`, `login-dashboard.html` e `login-admin.html` —
 * três cópias de `showMsg`/`setLoading`/`clearMsgs`/`peekPass`/`switchTab`,
 * que é o mesmo código a divergir devagar. Vivem agora aqui, carregados ANTES
 * do script de cada página, e os handlers continuam globais porque o
 * `onclick="doLogin()"` do HTML depende disso (scripts clássicos, não módulos).
 *
 * O que NÃO vem para aqui: a lógica de cada página (login/registo da consola
 * do dashboard, login da consola admin). Partilha-se o que é igual; o que é
 * diferente fica visível no ficheiro da página.
 */
'use strict';

/* Tab activa na página de login+registo (lida pelo handler de Enter). */
let currentTab = 'login';

/**
 * Partículas decorativas do fundo. A quantidade era 18 em `index.html` e em
 * `login-dashboard.html`, 14 em `login-admin.html` — passa agora por parâmetro
 * em vez de ser uma constante copiada.
 */
function initParticles(elementId, quantidade) {
  const box = document.getElementById(elementId);
  if (!box) return;
  for (let i = 0; i < quantidade; i++) {
    const p = document.createElement('span');
    p.className = 'particle';
    p.style.left = Math.random() * 100 + '%';
    p.style.bottom = '-10px';
    p.style.animationDelay = (Math.random() * 12) + 's';
    p.style.animationDuration = (10 + Math.random() * 12) + 's';
    box.appendChild(p);
  }
}

/* ── TABS (Entrar / Registrar) ── */
function switchTab(tab) {
  currentTab = tab;
  const isLogin = tab === 'login';
  document.getElementById('tabLogin').classList.toggle('active', isLogin);
  document.getElementById('tabRegister').classList.toggle('active', !isLogin);
  document.getElementById('loginForm').style.display = isLogin ? '' : 'none';
  document.getElementById('registerForm').style.display = isLogin ? 'none' : '';
  clearMsgs();
}

/** Mostrar/esconder a senha sem sair do campo. */
function peekPass(id, btn) {
  const el = document.getElementById(id);
  el.type = el.type === 'password' ? 'text' : 'password';
  btn.textContent = el.type === 'password' ? '👁' : '🙈';
}

/* ── FORÇA DA SENHA ─ */
function updateStrength(val) {
  const wrap = document.getElementById('strengthWrap');
  const fill = document.getElementById('strengthFill');
  const label = document.getElementById('strengthLabel');

  if (!val) { wrap.classList.remove('show'); return; }
  wrap.classList.add('show');

  let score = 0;
  if (val.length >= 8) score++;
  if (val.length >= 12) score++;
  if (/[A-Z]/.test(val)) score++;
  if (/[0-9]/.test(val)) score++;
  if (/[^A-Za-z0-9]/.test(val)) score++;

  const levels = [
    { pct: 20, color: '#f87171', txt: 'Muito fraca' },
    { pct: 40, color: '#f87171', txt: 'Fraca' },
    { pct: 60, color: '#fbbf24', txt: 'Razoável' },
    { pct: 80, color: '#a3e635', txt: 'Boa' },
    { pct: 100, color: '#4ade80', txt: 'Excelente' },
  ];
  const lv = levels[Math.min(score, 4)];
  fill.style.width = lv.pct + '%';
  fill.style.background = lv.color;
  label.style.color = lv.color;
  label.textContent = lv.txt;
}

/* ── UTILS ─ */
function setLoading(btn, on) {
  btn.disabled = on;
  btn.classList.toggle('loading', on);
}

function showMsg(el, type, text) {
  el.className = `msg ${type} show`;
  el.textContent = text;
}

function clearMsgs() {
  document.querySelectorAll('.msg').forEach(el => el.classList.remove('show'));
}

/** Mensagem de erro do backend (RFC 9457 `detail`/`title`) com fallbacks antigos. */
function apiErrorMessage(payload, fallback) {
  if (!payload) return fallback;
  return payload.detail || payload.title || payload.error || fallback;
}
