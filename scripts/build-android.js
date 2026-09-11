/**
 * Script para gerar projetos Android nativos para Dashboard e Admin
 * 
 * Uso: node scripts/build-android.js
 * 
 * Requer: Node.js, Java 17+, Android Studio
 * 
 * Cria APKs em:
 *   mobile/dashboard/android/app/build/outputs/apk/debug/app-debug.apk
 *   mobile/admin/android/app/build/outputs/apk/debug/app-debug.apk
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.APP_URL || 'https://dashboardestufaiot.vercel.app';

const APPS = {
  dashboard: {
    appId: 'com.estufa.dashboard',
    appName: 'Estufa Dashboard',
    entryUrl: `${BASE_URL}/login-dashboard.html`,
    dir: path.join(__dirname, '..', 'mobile', 'dashboard'),
  },
  admin: {
    appId: 'com.estufa.admin',
    appName: 'Estufa Admin',
    entryUrl: `${BASE_URL}/login-admin.html`,
    dir: path.join(__dirname, '..', 'mobile', 'admin'),
  }
};

async function generateAndroidApp(app) {
  console.log(`\n📱 Gerando app nativo Android: ${app.appName}`);
  console.log(`   Package: ${app.appId}`);
  console.log(`   Pasta: ${app.dir}`);
  console.log('');

  // Criar pasta
  fs.mkdirSync(app.dir, { recursive: true });

  // Criar package.json para o app
  const pkg = {
    name: app.appId.replace(/\./g, '-'),
    version: '1.0.0',
    private: true,
    scripts: {
      build: 'npx cap sync android',
      open: 'npx cap open android',
    },
    dependencies: {
      '@capacitor/android': '^7.0.0',
      '@capacitor/core': '^7.0.0',
      '@capacitor/app': '^7.0.0',
    },
  };
  fs.writeFileSync(path.join(app.dir, 'package.json'), JSON.stringify(pkg, null, 2));

  // Criar capacitor.config.ts
  const capConfig = `import { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: '${app.appId}',
  appName: '${app.appName}',
  webDir: 'public',
  bundledWebRuntime: false,
  server: {
    url: '${app.entryUrl}',
    cleartext: false,
    allowNavigation: ['dashboardestufaiot.vercel.app'],
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
};
export default config;
`;
  fs.writeFileSync(path.join(app.dir, 'capacitor.config.ts'), capConfig);

  // Instalar deps e init capacitor
  try {
    console.log('→ Instalando dependências...');
    execSync('npm install', { cwd: app.dir, stdio: 'inherit', timeout: 120000 });
    
    console.log('→ Inicializando Capacitor...');
    execSync('npx cap init', { cwd: app.dir, stdio: 'inherit', timeout: 30000 });

    console.log('→ Adicionando Android...');
    execSync('npx cap add android', { cwd: app.dir, stdio: 'inherit', timeout: 60000 });

    console.log('→ Sincronizando...');
    execSync('npx cap sync android', { cwd: app.dir, stdio: 'inherit', timeout: 60000 });

    console.log(`\n✅ App ${app.appName} gerado com sucesso!`);
    console.log(`   Para abrir no Android Studio: cd ${app.dir} && npx cap open android`);
    console.log(`   Para gerar APK: Android Studio → Build → Build APK(s)`);
    
  } catch (err) {
    console.log(`\n⚠️  Erro ao gerar projeto automaticamente: ${err.message}`);
    console.log(`   Mas os arquivos de configuração foram criados.`);
    console.log(`   Para continuar manualmente:`);
    console.log(`   1. cd ${app.dir}`);
    console.log(`   2. npm install`);
    console.log(`   3. npx cap add android`);
    console.log(`   4. npx cap sync android`);
    console.log(`   5. npx cap open android`);
    console.log(`   6. No Android Studio: Build → Build APK(s)`);
  }
}

async function main() {
  console.log('📱 Estufa 01 — Gerar Apps Android Nativos\n');
  console.log('='.repeat(50));
  
  await generateAndroidApp(APPS.dashboard);
  await generateAndroidApp(APPS.admin);
  
  console.log('\n' + '='.repeat(50));
  console.log('\n✅ Todos os apps gerados!');
  console.log('\n📋 Package names (diferentes = apps separados no Android):');
  console.log('   Dashboard: com.estufa.dashboard');
  console.log('   Admin:     com.estufa.admin');
  console.log('\n📱 No Android Studio:');
  console.log('   Build → Build Bundle(s) / APK(s) → Build APK(s)');
  console.log('\n🔧 Os APKs ficam em:');
  console.log('   mobile/dashboard/android/app/build/outputs/apk/debug/');
  console.log('   mobile/admin/android/app/build/outputs/apk/debug/');
}

main();