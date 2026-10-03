import { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'com.estufa.dashboard',
  appName: 'Estufa Dashboard',
  webDir: 'public',
  bundledWebRuntime: false,
  server: {
    url: 'https://dashboardestufaiot-omega.vercel.app/login-dashboard.html',
    cleartext: false,
    allowNavigation: ['dashboardestufaiot-omega.vercel.app'],
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
};
export default config;
