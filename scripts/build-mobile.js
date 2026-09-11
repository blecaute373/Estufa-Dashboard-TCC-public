/**
 * Script para gerar APKs de aplicativos PWA
 *
 * Uso: node scripts/build-mobile.js <dashboard|admin>
 *
 * Gera links diretos para baixar os APKs do PWABuilder
 * ou abre o site no navegador para gerar manualmente.
 */
const { execSync } = require('child_process');
const path = require('path');

const BASE_URL = process.env.APP_URL || 'https://seu-dominio-aqui.vercel.app';

const APPS = {
  dashboard: {
    url: `${BASE_URL}/login-dashboard.html`,
    manifest: `${BASE_URL}/manifest-dashboard.json`,
    name: 'Estufa Dashboard',
    pwabuilderUrl: `https://pwabuilder.com?url=${BASE_URL}/login-dashboard.html`,
  },
  admin: {
    url: `${BASE_URL}/login-admin.html`,
    manifest: `${BASE_URL}/manifest-admin.json`,
    name: 'Estufa Admin',
    pwabuilderUrl: `https://pwabuilder.com?url=${BASE_URL}/login-admin.html`,
  }
};

function generateAPK(app) {
  console.log(`\n📱 ${app.name}`);
  console.log('─'.repeat(40));
  console.log('');
  console.log('🔗 Link para gerar APK:');
  console.log(`   ${app.pwabuilderUrl}`);
  console.log('');
  console.log('📋 Passos:');
  console.log('  1. O link acima abre o PWABuilder');
  console.log('  2. Clique em "Package for Android"');
  console.log('  3. Aguarde e baixe o APK');
  console.log('  4. Transfira pro celular e instale');
  console.log('');
  console.log('💡 Dica: No celular, use a câmera para escanear:');
  console.log(`   https://qr-code-generator.com/?text=${encodeURIComponent(app.pwabuilderUrl)}`);
  console.log('');
}

const appName = process.argv[2];
if (!appName || !APPS[appName]) {
  console.log('📱 Estufa 01 — Gerar APKs');
  console.log('─'.repeat(40));
  console.log('');
  console.log('Uso: node scripts/build-mobile.js <dashboard|admin>');
  console.log('');
  console.log('Opções:');
  Object.keys(APPS).forEach(key => {
    console.log(`  ${key.padEnd(10)} → ${APPS[key].name}`);
  });
  console.log('  both        → Gera os dois');
  console.log('');
  process.exit(1);
}

if (appName === 'both') {
  Object.values(APPS).forEach(generateAPK);
} else {
  generateAPK(APPS[appName]);
}

console.log('📱 Gerando APK para Estufa Dashboard...');
console.log('');
console.log('Use o PWABuilder diretamente:');
console.log('  https://pwabuilder.com');
console.log('');
console.log('Cole a URL:');
console.log(`  ${BASE_URL}/login-dashboard.html`);
console.log('');

// Tenta abrir o navegador automaticamente
try {
  const target = appName === 'both' ? APPS.dashboard : APPS[appName];
  if (process.platform === 'win32') {
    execSync(`start "" "${target.pwabuilderUrl}"`, { timeout: 3000 });
  }
  console.log('✅ Navegador aberto com o PWABuilder!');
} catch {
  console.log('ℹ️  Abra o link manualmente no navegador.');
}