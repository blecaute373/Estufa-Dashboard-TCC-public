# 🌿 Estufa 01 — Sistema de Monitoramento de Estufa

Sistema de monitoramento de estufa agrícola baseado em IoT com dashboard web, PWA, apps mobile e desktop.

## 🚀 Início Rápido (15 minutos)

```bash
# 1. Instalar dependências (build reprodutível via lockfile)
npm ci

# 2. Configurar variáveis de ambiente
cp .env.example .env
# Edite .env com suas credenciais (MongoDB + ThingSpeak + JWT_SECRET)

# 3. Verificar sintaxe + rodar testes
npm run check
npm test

# 4. Iniciar servidor local
npm start
```

Acesse http://localhost:3000 (login em `/index.html`).

> Sem `.env`, o servidor sobe em modo desenvolvimento com segredo JWT
> efémero (aviso no console) e `mongodb://localhost:27017/estufa`.
> Em produção (`NODE_ENV=production`/Vercel) sem `JWT_SECRET` ou
> `MONGODB_URI`, a app falha explícita no arranque (fail-fast).

## 🧪 Testes

```bash
npm test    # Small (validadores/erros/retry, sem I/O) + Medium (HTTP localhost, sem DB real)
```

## 🔍 Diagnóstico (precisa de rede e credenciais reais)

Os dois scripts abaixo ficam **fora** do `npm run check` de propósito: `check` e
`test` são herméticos por desenho, e estes exigem rede, credenciais e um serviço
a responder.

```bash
npm run check:control   # cadeia do acionamento manual (ADR-0007/0008):
                        # REDIS_URL com round-trip real ao Upstash, DEVICE_TOKEN,
                        # token do firmware vs o da Vercel
npm run check:mongo     # ligação ao MongoDB Atlas (bug #13 / ADR-0010):
                        # formato da URI (offline), ping, leitura das coleções
                        # reais e ESCRITA numa coleção descartável
```

Ambos imprimem a URI/token **mascarados** — um diagnóstico que loga o segredo
inteiro é ele próprio o incidente.

## 📁 Estrutura do Projeto

```
estufa-dashboard-tcc/
├── api/                     # Backend (Vercel serverless functions)
├── lib/                     # Código partilhado dev/prod (config, auth, errors, validators, middleware, logger, thingspeak, control, store)
├── test/                    # Testes (node:test nativo, sem deps novas)
├── docs/                    # ADRs + contrato OpenAPI
├── .github/workflows/       # CI (check → test → audit)
├── public/                  # Frontend (HTML/CSS/JS)
├── mobile/                  # Apps mobile (Capacitor)
├── models/                  # Schemas MongoDB (Mongoose): User, AccessLog
├── scripts/                 # Scripts de build
├── electron-dashboard.js    # App desktop Dashboard
├── electron-admin.js        # App desktop Admin
├── server.js                # Servidor local (dev)
└── vercel.json              # Config deploy Vercel
```

## 🔐 Variáveis de Ambiente

Copie `.env.example` para `.env` e configure:

```env
# MongoDB (obrigatório em produção; dev usa localhost se ausente)
# -> User + AccessLog (utilizadores, hashes de senha, logs de acesso)
MONGODB_URI=mongodb+srv://usuario:senha@cluster.mongodb.net/estufa

# Upstash Redis (obrigatório em produção; base grátis)
# -> apenas a fila de comandos que o ESP32 busca (ADR-0008)
# -> UMA variável com endpoint + token: https://host/?_token=SEU_TOKEN
REDIS_URL=https://SEU-ENDPOINT.upstash.io/?_token=SEU_TOKEN

# ThingSpeak (obrigatório para o proxy de dados)
TS_CHANNEL=SEU_CHANNEL_ID
TS_API_KEY=SUA_API_KEY

# Token do dispositivo na Vercel (vai também em main.cpp -> API_VERCEL_TOKEN)
DEVICE_TOKEN=cole-o-mesmo-valor-no-firmware

# JWT (OBRIGATÓRIO em produção — sem fallback; dev gera efémero com aviso)
JWT_SECRET=gere-com-openssl-rand-hex-64

# Servidor
PORT=3000
```

Gere o segredo com: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`

> ⚠️ O `REDIS_URL` **nunca** vai para o firmware nem para o browser. O
> ESP32 conhece apenas `DEVICE_TOKEN`, que é outra coisa.

## 🛡️ Segurança

| Camada | Implementação |
|--------|--------------|
| Senhas | bcryptjs com 12 rounds de salt |
| Sessão | JWT httpOnly cookie (8h, `Secure` em produção) |
| Brute-force | Rate limit: 20 req / 15 min por IP (auth); 5/15min no bootstrap admin |
| Autorização | Checada antes da lógica (`requireAdminApi`); admin.html exige admin |
| Erros | RFC 9457 Problem Details; detalhe interno só no log com `requestId` |
| Segredo JWT | `JWT_SECRET` obrigatório em produção (fail-fast, nunca volátil) |
| Bootstrap admin | `POST /api/admin/promote-first` só sem admin existente (+ rate-limit) |
| Variáveis | `.env` nunca versionado; `.env.example` sem segredos reais |
| Fila de comandos | Fila isolada no Upstash Redis; `DEVICE_TOKEN` comparado em tempo constante; `REDIS_URL` (endpoint + token) só no ambiente da Vercel (nunca no firmware) |

## 🚀 Deploy (Vercel)

1. Conecte o repositório (Framework preset: Other; Output: `public`).
2. Configure as envs: `MONGODB_URI`, `REDIS_URL`, `TS_CHANNEL`, `TS_API_KEY`, `JWT_SECRET`, `DEVICE_TOKEN`.
3. Cada push/PR roda CI (`npm ci` → `check` → `test` → `audit`).
4. Valide pós-deploy: `/api/health`, login/logout, dashboard, admin, PWA.

Ver contrato em [docs/openapi.yaml](docs/openapi.yaml) e decisões em [docs/ADR-README.md](docs/ADR-README.md).

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

## 👥 Autores

Projeto acadêmico de TCC desenvolvido em **co-autoria**:

| Autor | Papel | GitHub |
|-------|-------|--------|
| **Matheus Garbin** | Autor original · arquitetura base, autenticação, deploy | [@matheusbritogarbin-byte](https://github.com/matheusbritogarbin-byte) |
| **Deivisson Lino Campos dos Santos Junior** | Co-autor · fila de comandos (Upstash Redis, ADR-0008), controle remoto do atuador, MongoDB Atlas em produção (ADR-0010), firmware ESP32 com token injetado, app partilhada (ADR-0009), diagnóstico `check:control`/`check:mongo` | [@blecaute373](https://github.com/blecaute373) |

Ver [CONTRIBUTORS.md](CONTRIBUTORS.md) para a repartição detalhada das contribuições.

### Repositórios

| Repositório | Papel |
|-------------|-------|
| [matheusbritogarbin-byte/Estufa-Dashboard-TCC](https://github.com/matheusbritogarbin-byte/Estufa-Dashboard-TCC) | Original (remote `origin`) |
| [blecaute373/Estufa-Dashboard-TCC](https://github.com/blecaute373/Estufa-Dashboard-TCC) | Fork do co-autor (remote `mine`) |

```bash
# Enviar para o fork do co-autor
git push mine main
```

## 📄 Licença

Projeto acadêmico - TCC
