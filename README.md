# 🌿 Estufa 01 — Sistema de Monitoramento de Estufa

Sistema de monitoramento de estufa agrícola baseado em IoT com dashboard web, PWA, apps mobile e desktop.

## 🚀 Início Rápido

```bash
# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.example .env
# Edite .env com suas credenciais

# Iniciar servidor local
npm start
```

Acesse http://localhost:3000

## 📁 Estrutura do Projeto

```
estufa-dashboard-tcc/
├── api/                     # Backend (Vercel serverless functions)
├── public/                  # Frontend (HTML/CSS/JS)
├── mobile/                  # Apps mobile (Capacitor)
├── models/                  # Schemas MongoDB (Mongoose)
├── scripts/                 # Scripts de build
├── electron-dashboard.js    # App desktop Dashboard
├── electron-admin.js        # App desktop Admin
├── server.js                # Servidor local (dev)
└── vercel.json              # Config deploy Vercel
```

## 🔐 Variáveis de Ambiente

Copie `.env.example` para `.env` e configure:

```env
# MongoDB (obrigatório)
MONGODB_URI=mongodb+srv://usuario:senha@cluster.mongodb.net/estufa

# ThingSpeak (obrigatório)
TS_CHANNEL=SEU_CHANNEL_ID
TS_API_KEY=SUA_API_KEY

# JWT (opcional - gerado automaticamente)
JWT_SECRET=

# Servidor
PORT=3000
```

## 🛡️ Segurança

| Camada | Implementação |
|--------|--------------|
| Senhas | bcryptjs com 12 rounds de salt |
| Sessão | JWT httpOnly cookie (8h) |
| Brute-force | Rate limit: 20 req / 15 min por IP |
| Erros | Mensagem genérica (não revela se usuário existe) |
| Segredo JWT | Gerado dinamicamente (64 bytes aleatórios) |
| Variáveis | Gerenciadas via dotenv |

## 📱 Apps

- **Web:** Dashboard responsivo com gráficos Chart.js
- **PWA:** Instalável com Service Worker v2
- **Mobile:** APK Android via Capacitor
- **Desktop:** Instalador Windows via Electron

Veja [README-APPS.md](README-APPS.md) para detalhes.

## 🌐 URLs de Produção

- **Dashboard:** https://dashboardestufaiot.vercel.app/login-dashboard.html
- **Admin:** https://dashboardestufaiot.vercel.app/login-admin.html
- **Site principal:** https://dashboardestufaiot.vercel.app

## 📄 Licença

Projeto acadêmico - TCC
