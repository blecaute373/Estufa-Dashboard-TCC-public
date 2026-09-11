# 📱 Estufa 01 — Aplicativos Mobile e Desktop

Documentação para build e distribuição dos aplicativos mobile (Android) e desktop (Windows) do Estufa 01.

## 📱 APK Android (Mobile)

### Método 1 — Via PWABuilder (recomendado, mais fácil)

1. Acesse https://pwabuilder.com
2. Cole a URL do app:
   - **Dashboard:** `https://dashboardestufaiot.vercel.app/login-dashboard.html`
   - **Admin:** `https://dashboardestufaiot.vercel.app/login-admin.html`
3. Clique em **"Package for Android"**
4. Baixe o APK gerado e instale no celular

### Método 2 — Via script local (requer Java + Android SDK)

```bash
# Dashboard APK
node scripts/build-mobile.js dashboard

# Admin APK
node scripts/build-mobile.js admin

# Os dois
node scripts/build-mobile.js both
```

---

## 🖥️ Desktop Windows (EXE)

### Dashboard

```bash
npm run build-dashboard-win
```
Gera: `release/dashboard/Estufa-Dashboard-Setup.exe`

### Admin

```bash
npm run build-admin-win
```
Gera: `release/admin/Estufa-Admin-Setup.exe`

---

## 🔧 Requisitos para buildar os APKs localmente

1. **Java 17+** (https://adoptium.net)
2. **Android SDK** (Android Studio → SDK Manager)
3. Variável de ambiente `ANDROID_HOME` configurada

---

## 🌐 URLs dos apps

| App | URL |
|-----|-----|
| Dashboard (login + registro) | `https://dashboardestufaiot.vercel.app/login-dashboard.html` |
| Admin (só login) | `https://dashboardestufaiot.vercel.app/login-admin.html` |
| Site principal | `https://dashboardestufaiot.vercel.app` |

---

## 📦 Estrutura de Build

```
mobile/
├── dashboard/          # App dashboard (Capacitor)
│   ├── capacitor.config.json
│   ├── capacitor.config.ts
│   ├── package.json
│   └── android/        # Projeto Android gerado
└── admin/              # App admin (Capacitor)
    ├── capacitor.config.json
    ├── capacitor.config.ts
    ├── package.json
    └── android/        # Projeto Android gerado
```

---

## 🚀 Build Android Nativo (Capacitor)

Para gerar projetos Android completos via linha de comando:

```bash
# Inicializar e buildar dashboard
npm run mobile-dashboard

# Inicializar e buildar admin
npm run mobile-admin

# Abrir no Android Studio
npm run mobile-open-dashboard
npm run mobile-open-admin
```

**Nota:** Após alterações no frontend, execute `npx cap sync` para sincronizar as mudanças com o projeto Android.