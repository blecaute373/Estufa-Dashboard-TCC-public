import { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'com.estufa.admin',
  appName: 'Estufa Admin',
  webDir: 'public',
  bundledWebRuntime: false,
  server: {
    url: 'https://dashboardestufaiot.vercel.app/login-admin.html',
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
