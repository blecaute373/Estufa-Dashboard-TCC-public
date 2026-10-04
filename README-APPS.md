# 📱 Estufa 01 — Aplicativos Mobile e Desktop

Documentação para build e distribuição dos aplicativos mobile (Android) e desktop (Windows) do Estufa 01.

## 📱 APK Android (Mobile)

> ⚠️ **URL correta:** o domínio de produção deste repositório é
> **`dashboardestufaiot-omega.vercel.app`**. O `dashboardestufaiot.vercel.app`
> (sem `-omega`) é **outro projeto, noutra conta**: serve outro backend e outra
> fila de comandos, pelo que o relé simplesmente não responde. Ver `README.md`.

### Método 1 — GitHub Actions + Bubblewrap (recomendado, reproduzível)

O APK sai de um workflow versionado (`.github/workflows/android-twa.yml`), que
gera um **TWA (Trusted Web Activity)** a partir de `twa/twa-manifest.json` e o
publica **assinado** numa Release.

1. **Actions** → **Android APK — TWA (Bubblewrap)** → **Run workflow**
2. Aguarde; no fim, descarregue o artefacto **`estufa01-android`** (`estufa01.apk`, `app-release-bundle.aab`)

Para publicar uma Release (o que alimenta o **QR code** da página inicial, via
`public/js/qr-app.js`):

```bash
git tag v1.0.0
git push origin v1.0.0
```

O APK fica em
`https://github.com/blecaute373/Estufa-Dashboard-TCC-public/releases/latest/download/estufa01.apk`
— exatamente o endereço codificado no QR.

**Secrets opcionais** (Settings → Secrets and variables → Actions):

| Secret | Para que serve |
|--------|----------------|
| `ANDROID_KEYSTORE_BASE64` | Keystore de assinatura (base64 do ficheiro). Sem ele, o CI gera um novo keystore e entrega-o no artefacto `keystore-assinatura` — guarde-o para manter o mesmo apk atualizável. |
| `ANDROID_KEYSTORE_PASSWORD` | Senha do keystore/chave. Sem ele usa-se o valor de desenvolvimento `estufa01tcc`. **Tem de ser a mesma senha usada quando o keystore foi gerado** — se mudar a senha depois sem gerar keystore novo, a assinatura falha. |

> **Ordem certa na primeira vez:** 1) corra o workflow sem secrets → 2) descarregue
> `keystore-assinatura` → 3) crie `ANDROID_KEYSTORE_BASE64` (+ `ANDROID_KEYSTORE_PASSWORD`
> se definiu uma própria) → 4) corra de novo para confirmar reutilização → 5) só depois
> crie a tag `v*` para a Release (o QR só serve o APK depois da Release existir).

### Método 2 — Via PWABuilder (manual)

1. Acesse https://pwabuilder.com
2. Cole a URL do app:
   - **Dashboard:** `https://dashboardestufaiot-omega.vercel.app/login-dashboard.html`
   - **Admin:** `https://dashboardestufaiot-omega.vercel.app/login-admin.html`
3. Clique em **"Package for Android"**
4. Baixe o APK gerado e instale no celular

### Método 3 — Via script local (requer Java 17 + Android SDK)

```bash
# Mostra o link do PWABuilder
node scripts/build-mobile.js dashboard

# Gera projeto Capacitor completo
node scripts/build-android.js
```

> O `scripts/build-android.js` e os `capacitor.config.*` de `mobile/` são o
> caminho **Capacitor** (app que carrega o site remoto). É mais pesado que o
> TWA e não gera release automaticamente — o **Método 1** é o caminho suportado.


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

1. **JDK 17** (https://adoptium.net) — o Bubblewrap recusa versões < 17 e as > 17 são incompatíveis com o Android cmdline-tools
2. **Android SDK cmdline-tools** (https://developer.android.com/studio#command-line-tools-only)
3. **Bubblewrap**: `npm i -g @bubblewrap/cli`
4. Na primeira execução, o Bubblewrap pergunta onde estão o JDK e o SDK. Para evitar o prompt, escreva `${USER_HOME}/.bubblewrap/config.json`:

```json
{ "jdkPath": "/caminho/para/o/jdk-17", "androidSdkPath": "/caminho/para/o/android-sdk" }
```

> ⚠️ `androidSdkPath` tem de conter `bin/sdkmanager` (ou `tools/bin/sdkmanager`) **e** ser a raiz onde vivem `build-tools/` e `platforms/`.

Depois, dentro da pasta `twa/`:

```bash
bubblewrap update --manifest twa-manifest.json --directory . --skipVersionUpgrade
BUBBLEWRAP_KEYSTORE_PASSWORD=... BUBBLEWRAP_KEY_PASSWORD=... \
  bubblewrap build --manifest twa-manifest.json --directory .
```

Saída: `twa/app-release-signed.apk` e `twa/app-release-bundle.aab`.

---

## 🌐 URLs dos apps

| App | URL |
|-----|-----|
| Dashboard (login + registro) | `https://dashboardestufaiot-omega.vercel.app/login-dashboard.html` |
| Admin (só login) | `https://dashboardestufaiot-omega.vercel.app/login-admin.html` |
| Site principal | `https://dashboardestufaiot-omega.vercel.app` |
| Manifesto do dashboard (PWA) | `https://dashboardestufaiot-omega.vercel.app/manifest-dashboard.json` |
| APK mais recente | `https://github.com/blecaute373/Estufa-Dashboard-TCC-public/releases/latest/download/estufa01.apk` |

---

## 📦 Estrutura de Build

```
twa/                        # APK via Trusted Web Activity (Bubblewrap) — Método 1
├── twa-manifest.json       # ÚNICA peça versionada: a "receita" do APK
└── (app/, keystore, *.apk) # gerados no CI — NÃO versionados
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