/**
 * Registra Service Worker para PWA
 */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(reg => {
      console.log('[PWA] Service Worker registrado:', reg.scope);
    }, err => {
      console.error('[PWA] Erro ao registrar SW:', err);
    });
  });

  // Detecta se já está rodando como app instalado
  if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) {
    document.documentElement.classList.add('pwa-mode');
    console.log('[PWA] Rodando como app instalado');
  }
}

// Botão de instalação (opcional)
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const btn = document.getElementById('installBtn');
  if (btn) btn.style.display = 'inline-flex';
});

function installApp() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  deferredPrompt.userChoice.then(() => { deferredPrompt = null; });
}