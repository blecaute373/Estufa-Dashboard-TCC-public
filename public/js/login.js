/**
 * Estufa 01 — Página de entrada do dashboard (login + registo)
 *
 * Serve `index.html` e `login-dashboard.html`: as duas páginas têm o MESMO
 * formulário e os mesmos ids (`loginUser`, `regPass2`, `strengthFill`, …), o
 * que fazia com que este código existisse duas vezes, copiado. Fica num
 * ficheiro só; as diferenças que havia entre as cópias eram só de texto de
 * uma mensagem de sucesso.
 *
 * Os handlers continuam globais (`doLogin`, `doRegister`, `switchTab`) porque
 * o HTML chama-os por `onclick`. Os helpers de UI vêm de `js/auth-comum.js`,
 * carregado antes deste ficheiro.
 */
'use strict';

/* ── STATUS INICIAL ──
   Sem utilizadores registados, a base está por inicializar: abre já o
   registo e explica porquê, em vez de mostrar um login que não funciona. */
async function checkStatus() {
  try {
    const r = await fetch('/api/auth/status');
    const d = await r.json();
    if (d.users === 0) {
      document.getElementById('firstUserNotice').classList.add('show');
      switchTab('register');
    }
    const uc = document.getElementById('userCount');
    if (uc) uc.textContent = d.users ?? '—';
  } catch { /* offline: mantém login */ }
}

/* ── LOGIN ── */
async function doLogin() {
  const btn = document.getElementById('btnLogin');
  const msg = document.getElementById('loginMsg');
  const user = document.getElementById('loginUser').value.trim();
  const pass = document.getElementById('loginPass').value;

  if (!user || !pass) return showMsg(msg, 'error', 'Preencha todos os campos.');

  setLoading(btn, true);
  clearMsgs();

  try {
    const r = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: user, password: pass }),
    });
    const d = await r.json();

    if (r.ok) {
      // O cookie httpOnly é a sessão a sério; o token em localStorage serve
      // para as apps Electron/Capacitor, que não partilham cookies do browser.
      if (d.token) localStorage.setItem('estufa_token', d.token);
      showMsg(msg, 'success', `✓ Bem-vindo, ${d.username}! Entrando…`);
      setTimeout(() => { window.location.href = '/dashboard.html'; }, 900);
    } else {
      showMsg(msg, 'error', apiErrorMessage(d, 'Erro ao entrar.'));
      document.getElementById('loginPass').classList.add('error');
      setTimeout(() => document.getElementById('loginPass').classList.remove('error'), 2000);
    }
  } catch {
    showMsg(msg, 'error', 'Sem conexão com o servidor.');
  } finally {
    setLoading(btn, false);
  }
}

/* ── REGISTO ── */
async function doRegister() {
  const btn = document.getElementById('btnRegister');
  const msg = document.getElementById('registerMsg');
  const user = document.getElementById('regUser').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const pass = document.getElementById('regPass').value;
  const pass2 = document.getElementById('regPass2').value;

  if (!user || !email || !pass || !pass2)
    return showMsg(msg, 'error', 'Preencha todos os campos.');

  if (pass !== pass2)
    return showMsg(msg, 'error', 'As senhas não coincidem.');

  // O backend valida outra vez (validateRegister): isto aqui é só feedback
  // imediato, não é a regra.
  if (pass.length < 8)
    return showMsg(msg, 'error', 'Senha mínima: 8 caracteres.');

  setLoading(btn, true);
  clearMsgs();

  try {
    const r = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: user, email, password: pass }),
    });
    const d = await r.json();

    if (r.ok) {
      if (d.token) localStorage.setItem('estufa_token', d.token);
      document.getElementById('welcomeText').textContent =
        `🌿 Bem-vindo, ${d.username}! Conta criada. Redirecionando…`;
      document.getElementById('welcomeBadge').classList.add('show');
      document.getElementById('registerForm').style.display = 'none';
      document.getElementById('tabsEl').style.display = 'none';
      setTimeout(() => { window.location.href = '/dashboard.html'; }, 1500);
    } else {
      showMsg(msg, 'error', apiErrorMessage(d, 'Erro ao registrar.'));
    }
  } catch {
    showMsg(msg, 'error', 'Sem conexão com o servidor.');
  } finally {
    setLoading(btn, false);
  }
}

/* Enter submete o formulário da tab activa. */
document.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    if (currentTab === 'login') doLogin();
    else doRegister();
  }
});

/* ── INIT ── */
initParticles('particles', 18);
checkStatus();
