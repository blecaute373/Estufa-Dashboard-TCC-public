/**
 * Script para gerar APKs via PWABuilder API
 *
 * Uso: node scripts/build-mobile.js <dashboard|admin>
 *
 * Requer: Java 11+ e Android SDK
 * Alternativa: abrir https://pwabuilder.com no navegador e colar a URL
 *
 * Gera APK em: mobile/<app>/app-release-signed.apk
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const APPS = {
  dashboard: {
    url: 'https://dashboardestufaiot.vercel.app/login-dashboard.html',
    manifest: 'https://dashboardestufaiot.vercel.app/manifest-dashboard.json',
    name: 'Estufa Dashboard',
    packageName: 'com.estufa.dashboard',
    output: path.join(__dirname, '..', 'mobile', 'dashboard'),
  },
  admin: {
    url: 'https://dashboardestufaiot.vercel.app/login-admin.html',
    manifest: 'https://dashboardestufaiot.vercel.app/manifest-admin.json',
    name: 'Estufa Admin',
    packageName: 'com.estufa.admin',
    output: path.join(__dirname, '..', 'mobile', 'admin'),
  }
};

async function generateAPK(app) {
  console.log(`\n📱 Gerando APK para ${app.name}...`);

  // Tenta via Bubblewrap (requer Java)
  try {
    console.log('→ Tentando Bubblewrap...');
    execSync(`npx -y @pwabuilder/bubblewrap build --appVersionName "1.0.0" --appVersionCode 1 --manifestUrl "${app.manifest}" --appUrls "${app.url}" --output "${app.output}"`, {
      stdio: 'inherit',
      timeout: 120000,
    });
    console.log(`✅ APK gerado em: ${app.output}/app-release-signed.apk`);
    return true;
  } catch (e) {
    console.log('⚠️  Bubblewrap não disponível. Alternativa:');
    console.log(`   1. Acesse https://pwabuilder.com`);
    console.log(`   2. Cole a URL: ${app.url}`);
    console.log(`   3. Clique em "Package for Android"`);
    console.log(`   4. Baixe o APK gerado\n`);
    return false;
  }
}

// Main
const appName = process.argv[2];
if (!appName || !APPS[appName]) {
  console.log('Uso: node scripts/build-mobile.js <dashboard|admin>');
  console.log('Ou:  node scripts/build-mobile.js both (para os dois)');
  process.exit(1);
}

if (appName === 'both') {
  generateAPK(APPS.dashboard);
  generateAPK(APPS.admin);
} else {
  generateAPK(APPS[appName]);
}