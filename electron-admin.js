/**
 * Electron App — Estufa Admin (Desktop EXE)
 * Inicia uma janela que aponta para o login de admin
 */
const { app, BrowserWindow } = require('electron');

const SERVER_URL = (process.env.APP_URL || 'https://dashboardestufaiot.vercel.app').replace(/\/+$/, '');

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 400,
    minHeight: 500,
    title: 'Estufa 01 — Admin',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    backgroundColor: '#08120a',
    autoHideMenuBar: true,
  });

  win.setMenuBarVisibility(false);
  win.loadURL(SERVER_URL + '/login-admin.html');

  if (SERVER_URL.includes('localhost')) {
    win.webContents.openDevTools();
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});