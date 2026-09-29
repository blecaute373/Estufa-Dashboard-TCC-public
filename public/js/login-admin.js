/**
 * Estufa 01 — Login da consola de administração
 *
 * Duas diferenças reais em relação ao login do dashboard (`js/login.js`), e é
 * por isso que este ficheiro existe em vez de reutilizar aquele:
 *
 *   1. Não há registo — aqui só entra quem já tem conta.
 *   2. Depois de autenticar, exige `is_admin`: uma conta comum recebe
 *      "Acesso negado" e NÃO é encaminhada para `/admin.html` (o backend
 *      também o recusaria — a página é só a primeira barreira, §9.2).
 *
 * Os helpers de UI (`peekPass`, `showMsg`, `setLoading`, `initParticles`)
 * vêm de `js/auth-comum.js`.
 */
'use strict';

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
      if (!d.is_admin) {
        showMsg(msg, 'error', 'Acesso negado. Esta conta não é administradora.');
        return;
      }
      if (d.token) localStorage.setItem('estufa_token', d.token);
      showMsg(msg, 'success', '✓ Bem-vindo, ' + d.username + '!');
      setTimeout(() => { window.location.href = '/admin.html'; }, 900);
    } else {
      showMsg(msg, 'error', apiErrorMessage(d, 'Erro ao entrar.'));
    }
  } catch {
    showMsg(msg, 'error', 'Sem conexão com o servidor.');
  } finally {
    setLoading(btn, false);
  }
}

document.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });

/* ── INIT ── */
initParticles('particles', 14);
