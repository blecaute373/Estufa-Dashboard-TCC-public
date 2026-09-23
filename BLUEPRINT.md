# 🌲 Estufa 01 — Blueprint Mestre do Projeto

> **Versão:** 1.3.1 · **Data:** 22/09/2026 · **Repositório:** https://github.com/matheusbritogarbin-byte/Estufa-Dashboard-TCC.git
>
> **Este documento é o prompt operacional do projeto** — qualquer IA, em qualquer fase ou sessão, deve segui-lo como instrução, não apenas consultá-lo como referência de fundo.

---

## Registro de Revisoes

Historico completo de todos os commits do projeto, organizados por versao.

### v1.3.1 (22/09/2026) - Controlo Movido para o Painel de Admin + Monitorizacao ao Vivo

`
refactor(security): controlo de atuadores movido do dashboard publico para o
     painel de admin (autenticado) — o dashboard passa a ser SO-LEITURA
refactor: logica de sensores/UI extraida de script.js para public/js/sensor.js
     (fetch + render partilhados, carregados por dashboard.html e admin.html)
feat: public/js/control.js — enviarComando(), mostrarMsgControlo() e listeners
     .ctrl-btn / #sliderLight (carregado apenas pelo admin)
feat: admin.html com faixa de monitorizacao ao vivo (4 sensores, status pill,
     ultima leitura, RSSI) + grid de controlo (ON/OFF vent/valv, slider PWM)
feat: public/css/control.css — estilos de comando isolados do dashboard
fix: sw.js cache estufa-v4 (pre-cache de control.css, sensor.js, control.js)
fix: control.js faz polling do feed (cicloMonitorizar) com guard para
     sensor.js ausente e DOMContentLoaded-safe
docs: BLUEPRINT 1.3.1 — 1.4, 2.5, 5.2, 6.1-6.3, 7.1-7.2, 11.1.1, 18.5
test: 38/38 node:test a passar; pages.test.js valida refs novas (200)
`

### v1.3.0 (22/09/2026) - Controlo Ativo de Atuadores no Dashboard

`
feat: botoes ON/OFF (ventilador, valvula) + slider PWM (iluminacao) no dashboard
feat: server.js POST /api/control (proxy MQTT, requireAuthApi + auditoria AccessLog)
feat: firmware ESP32 subscreve topicos */comando e trata JSON {command} / {duty}
fix: handlers do ESP32 nao re-publicam no proprio topic (evita loop MQTT)
fix: correcao da tabela ThingSpeak 5.2 (field2=solo, field3=lux, field4=umid.ar,
     field5-8=atuadores/RSSI) — antes desatualizada
docs: BLUEPRINT 1.3.0 — 1.4 Nao-Objetivos reescrito (controlo local-only),
      nova 11.1.1, env LOCAL_MQTT_BROKER, bug #11, FAQ controlo
test: 38/38 node:test a passar; mqtt 5.16 adicionado a package.json
`

### v1.2.0 (15/09/2026) - Conformidade ENGENHARIA.md (P0+P1+P2+P3)

`lib/` partilhada dev/prod (config fail-fast, auth, validators, errors RFC 9457,
middleware requestId+rate-limit, logger estruturado, thingspeak timeout+retry);
corrige bypass de admin em dev (`requireAdminApi` + `is_admin` no JWT),
`ReferenceError crypto` em `server.js`, JWT volátil em serverless,
vazamento `details: err.message` (A10), `promote-first` GET→POST+rate-limit;
`/api/health`, paginação real em `/admin/logs`, testes `node:test` (15),
CI + Dependabot, ADRs 0001–0005, `docs/openapi.yaml`, README 15min.
Erros herdados: `npm audit fix` aplicado; restam 3 moderate transitivos.

### v1.1.0 (11/09/2026) - Seguranca e Limpeza de Segredos

`
bc3e5c3 | 11/09/2026 | chore: add safe .env.example template
476d6d6 | 11/09/2026 | security: remove leaked secrets and harden configuration
742c923 | 11/09/2026 | fix: restore production URL dashboardestufaiot.vercel.app
`

### v1.0.0 (25/05/2026) - Service Worker v2 e Finalizacao

`
0903d1d | 25/05/2026 | fix: service worker v2 cache limpo + network-first
d92a49c | 25/05/2026 | fix: manifest start_url
`

### v0.6.0 (22-24/05/2026) - Mobile Android + Fixes

`
1394ec4 | 24/05/2026 | fix: auth com localStorage para funcionar em PWA mobile
06fb00a | 23/05/2026 | fix: icones PNG reais para PWABuilder
e6c0a5d | 22/05/2026 | fix: icones SVG reais (nao data URI) para PWABuilder
ace2040 | 22/05/2026 | fix: script mobile usa PWABuilder (Bubblewrap indisponivel)
9b7ec10 | 22/05/2026 | feat: estrutura mobile APK + scripts build
e977f8e | 21/05/2026 | fix: admin sem link dashboard, initChart seguro
`

### v0.5.0 (20-21/05/2026) - PWA + Electron

`
41dc083 | 21/05/2026 | feat: apps electron + admin + PWA + fix bugs
9037447 | 20/05/2026 | app
`

### v0.4.0 (19-20/05/2026) - Admin Panel

`
ae9dd82 | 19/05/2026 | Admin
164bc92 | 19/05/2026 | Admin
`

### v0.3.0 (18-19/05/2026) - Dashboard + MongoDB

`
cecda95 | 19/05/2026 | MongoDB Correcao
000693a | 19/05/2026 | MongoDB
5514e57 | 19/05/2026 | MongoDB
aaeffeb | 19/05/2026 | MongoDB
18df37f | 19/05/2026 | MongoDB
35f87db | 19/05/2026 | correcao de erros
`

### v0.2.0 (09-15/05/2026) - Sistema de Login

`
5d17121 | 18/05/2026 | login
d73d84c | 15/05/2026 | Sistema login
4f54f09 | 15/05/2026 | Sistema login
c7fe677 | 15/05/2026 | Sistema login
337d035 | 15/05/2026 | Sistema login
df54269 | 15/05/2026 | Sistema login
8b83476 | 09/05/2026 | Sistema de login
a7ec05f | 09/05/2026 | Sistema de login
`

### v0.1.0 (09/05/2026) - Estrutura Inicial

`
498a1f9 | 09/05/2026 | Tira o numero thinkspeak
668915b | 09/05/2026 | Tira o numero thinkspeak
0fdb866 | 09/05/2026 | remove vercel.json
a74c1af | 09/05/2026 | corrige vercel.json
b454b22 | 09/05/2026 | remove arquivos com acento
178df7e | 09/05/2026 | simplifica vercel.json
fd1f71c | 09/05/2026 | corrige nomes dos arquivos da api
951702e | 09/05/2026 | renomeia para index.html
594bbef | 09/05/2026 | adiciona vercel.json
e5865ba | 09/05/2026 | Merge branch main
861c531 | 09/05/2026 | primeiro commit
a874402 | 09/05/2026 | Initial commit
`

---

## Estado Atual do Projeto

> Unica secao deste documento pensada para mudar com frequencia. Deve ser atualizada ao fim de toda sessao de trabalho relevante.

- **Versao atual (v1.3.1):** Dashboard web com autenticacao, graficos ThingSpeak,
  **controlo ativo de atuadores (local, apenas no painel de admin)**, PWA,
  apps mobile (Android) e desktop (Electron/Windows).
- **Stack:** Node.js + Express + MongoDB + HTML/CSS/JS vanilla + Chart.js + Service Worker + Capacitor + Electron + mqtt (broker local).
- **Deploy:** Vercel (serverless functions) com dominio customizado (dashboardestufaiot.vercel.app);
  **controlo de atuadores exige `server.js` local** (Vercel devolve 503 em `/api/control`).
- **Total de commits:** 47 commits (09/05/2026 - 22/09/2026).
- **Funcionalidades implementadas:**
  - Sistema de autenticacao JWT com cookies httpOnly + localStorage fallback
  - Dashboard com graficos em tempo real (ThingSpeak API) — **somente leitura**
  - **Controlo ativo de atuadores** (ventilador ON/OFF, valvula abrir/fechar,
    iluminacao duty PWM 0-100%) via `/api/control` + MQTT local — **disponivel
    apenas no painel de admin** e apenas na rede da estufa (Ver Secao 11.1.1)
  - **Monitorizacao ao vivo no admin** (4 sensores + estado dos atuadores +
    status/RSSI), reutilizando `/js/sensor.js`
  - Painel admin com logs de acesso e gerenciamento de usuarios
  - PWA com Service Worker v4 (cache limpo + network-first)
  - Apps mobile Android via Capacitor + PWABuilder
  - Apps desktop Windows via Electron
  - Sistema de alertas por threshold (temperatura, umidade, etc.)
  - Graficos interativos (linha, gauge, barras) com Chart.js
  - Rate limiting para protecao contra brute-force (express-rate-limit)

- **Validacao:** Projeto funcional em producao, todas as funcionalidades principais implementadas.

- **Seguranca (v1.1.0):**
  - Segredos removidos do historico de commits (MongoDB, JWT, API keys)
  - .gitignore atualizado com regras completas de exclusao
  - Fallback inseguro de JWT_SECRET removido (agora gerado dinamicamente)
  - Channel ID hardcoded removido do codigo (usa variavel de ambiente)
  - .env.example transformado em template seguro
  - Rate limiting implementado (20 req/15 min por IP)
  - Cookie parser para gerenciamento seguro de cookies
  - Dotenv para gerenciamento de variaveis de ambiente

- **Pendencias conhecidas:**
  - Rate limiting no Vercel (serverless timeout de 10s no plano Hobby)
  - initChart silencioso sem erro visivel ao usuario
  - Service worker sem teste automatizado
  - PWABuilder requer hospedagem HTTPS
  - Chart.js dependente de CDN (sem fallback local)
  - `/api/control` sem rate-limit proprio (protegido por auth + rede local)
  - Firmware `.ino` fora do versionamento (gitignored) — sem CI de compilacao
  - Botao "verificar broker" inexistente — indisponibilidade do broker so aparece
    apos clique (503)

- _Ultima atualizacao: 22/09/2026_

---

## Bugs Conhecidos em Aberto

1. **Rate limiting no Vercel.** Funcoes serverless tem timeout de 10s (Hobby). Consultas ao MongoDB + ThingSpeak podem estourar esse limite, resultando em erro 504.
2. **initChart silencioso.** Falha na inicializacao do grafico nao mostra erro visivel ao usuario; o canvas fica vazio sem feedback.
3. **Service worker sem teste.** sw.js v4 nao tem teste automatizado; mudancas no cache podem quebrar o PWA silenciosamente.
4. **localStorage fallback.** Em modo PWA mobile, se httpOnly cookie falhar, fallback para localStorage e usado (menos seguro, vulneravel a XSS).
5. **Chart.js CDN.** Dependencia externa sem fallback local; se CDN cair, graficos param de funcionar.
6. **ThingSpeak rate limit.** API gratuita limitada a 3 requisicoes/segundo; polling frequente pode bloquear temporariamente.
7. **Electron sem assinatura.** Apps desktop nao tem codigo assinado (SmartScreen do Windows mostra aviso de seguranca).
8. **Capacitor sync manual.** npx cap sync necessario apos mudancas no frontend; nao ha automatizacao.
9. **Admin sem link para dashboard.** Pagina admin nao tem link para dashboard (decisao intencional de seguranca).
10. **Build Android requer Android Studio.** Build nativo requer Android Studio + SDK configurado localmente.
11. **Controlo de atuadores so local.** `/api/control` devolve 503 no deploy Vercel
    (serverless nao alcanca o broker MQTT da rede da estufa); o controlo ativo so
    funciona com `server.js` a correr na mesma rede do ESP32.

---

## 0. Protocolo de Sessao (Leia Isto Primeiro)

Este documento e a **fonte unica da verdade** do Estufa 01 e o **prompt operacional** que qualquer IA deve seguir como instrucao.

**Ao iniciar uma sessao:**

1. Leia o bloco **Estado Atual do Projeto** - ele diz em que fase o projeto esta.
2. Leia por completo as secoes relevantes a tarefa antes de escrever codigo.
3. Consulte o **Registro de Revisoes** para entender o historico de mudancas.

**Enquanto trabalha:**

- Toda decisao de arquitetura, nomenclatura ou padrao ja registrada aqui e **vinculante**.
- Se um PR ou feature conflitar com este documento, o documento vence.
- Nunca pule os checklists de seguranca (Secao 14).

**Ao encerrar a sessao:**

1. Atualize o bloco **Estado Atual do Projeto**.
2. Se alguma decisao de arquitetura mudou, atualize a secao correspondente.
3. Adicione linha ao **Registro de Revisoes** se relevante.

---

## Sumario

0. [Protocolo de Sessao](#0-protocolo-de-sessao-leia-isto-primeiro)
1. [Visao e Principios](#1-visao-e-principios)
2. [Arquitetura do Sistema](#2-arquitetura-do-sistema)
3. [Modelo de Dados](#3-modelo-de-dados)
4. [Sistema de Autenticacao](#4-sistema-de-autenticacao)
5. [Integracao com ThingSpeak](#5-integracao-com-thingspeak)
6. [Frontend - Paginas e Componentes](#6-frontend--paginas-e-componentes)
7. [Painel Admin](#7-painel-admin)
8. [PWA e Service Worker](#8-pwa-e-service-worker)
9. [Apps Mobile (Android)](#9-apps-mobile-android)
10. [Apps Desktop (Electron/Windows)](#10-apps-desktop-electronwindows)
11. [Deploy (Vercel)](#11-deploy-vercel)
12. [Scripts e Utilitarios](#12-scripts-e-utilitarios)
13. [Padroes de Codigo e Governanza](#13-padroes-de-codigo-e-governanza)
14. [Seguranca](#14-seguranca)
15. [Roadmap / Futuras Melhorias](#15-roadmap--futuras-melhorias)
16. [Anexo: Decisoes de Arquitetura e FAQ](#16-anexo-decisoes-de-arquitetura-e-faq)
17. [Checklist de Lancamento (Go-Live)](#17-checklist-de-lancamento-go-live)
18. [Entidades e Estrutura de Dados](#18-entidades-e-estrutura-de-dados)

---

## 1. Visao e Principios

### 1.1 O que e o Estufa 01

Estufa 01 e um sistema de monitoramento de estufa agricola baseado em IoT (Internet das Coisas). O projeto coleta dados de sensores (temperatura, umidade, luminosidade, etc.) via ThingSpeak API e os exibe em um dashboard web interativo com graficos em tempo real, alertas por threshold e historico.

O sistema e composto por:
- **Backend:** API REST em Node.js/Express com MongoDB para persistencia de usuarios e logs
- **Frontend:** Dashboard web responsivo com graficos Chart.js
- **PWA:** Progressive Web App instalavel com Service Worker
- **Mobile:** Apps Android via Capacitor
- **Desktop:** Apps Windows via Electron

### 1.2 Filosofia do Projeto

- **Simplicidade por fora, robustez por dentro.** O dashboard deve ser simples de usar, mas o sistema deve ser confiavel.
- **Multi-plataforma.** Web, PWA, mobile e desktop a partir de uma unica codigo-base.
- **Tempo real.** Dados atualizados automaticamente com polling configuravel.
- **Seguranca por padrao.** Autenticacao JWT, cookies httpOnly, validacao de entrada.

### 1.3 Principios Norteadores

| # | Principio | O que significa na pratica |
| --- | --- | --- |
| 1 | **Seguranca por padrao** | Toda entrada e validada, toda rota sensivel tem auth. |
| 2 | **Documentar e parte de terminar** | Uma feature sem documentacao esta incompleta. |
| 3 | **Performance e experiencia** | Graficos devem carregar em < 2s, polling eficiente. |
| 4 | **Falhar graciosamente** | Erros nao devem quebrar o dashboard; mostrar mensagem amigavel. |
| 5 | **Multi-plataforma** | Uma unica base de codigo para web, PWA, mobile e desktop. |

### 1.4 Nao-Objetivos

- **Nao e um sistema de controle ativo em nuvem.** O controlo manual de atuadores
  (ventilador, valvula, iluminacao) funciona **apenas via servidor local** (`server.js`,
  rede da estufa): o deploy Vercel (serverless) devolve **503** em `/api/control`
  (ver `api/index.js`), porque nao alcanca o broker MQTT local. O frontend trata
  esse caso e mostra a mensagem adequada.
- **O controlo nao esta exposto ao dashboard publico.** Por seguranca, o dashboard
  (`dashboard.html`) e **estritamente de leitura**: mostra dados e estado dos
  atuadores, mas nao envia comandos. Os comandos vivem apenas em `admin.html`
  (autenticado) via `public/js/control.js`, e o endpoint exige `requireAuthApi`.
- **Controlo ativo requer broker MQTT local.** O ESP32 subscreve os topicos
  `fazenda/<estufa>/atuador/*/comando` e so recebe comandos publicados nesse broker
  (`LOCAL_MQTT_BROKER`).
- **Nao substitui sistemas SCADA profissionais.** E um projeto academico/monitoramento basico.
- **Nao processa dados em edge.** Todo processamento e serverless (Vercel) ou client-side.


---

## 2. Arquitetura do Sistema

### 2.1 Visao Macro

`
                    +--------------------+
                    |   ThingSpeak API   |
                    |   (Sensores IoT)   |
                    +--------+-----------+
                             | HTTPS
                             v
   +-----------------------------------------------------------+
   |                 BACKEND (Node.js/Express)                  |
   |  - REST API        - Auth (JWT)        - Proxy ThingSpeak   |
   |  - Rate Limiting   - Logs (MongoDB)    - Admin CRUD         |
   +----------------------------+------------------------------+
                            | REST/HTTPS
                            v
   +-----------------------------------------------------------+
   |                  FRONTEND (HTML/CSS/JS)                    |
   |  - Dashboard       - Graficos Chart.js  - Alertas           |
   |  - Auth (login)    - PWA (SW)          - Admin panel       |
   +----------------------------+------------------------------+
                            |
              +-------------+-------------+
              |             |             |
              v             v             v
        +----------+  +----------+  +----------+
        |   PWA    |  |  Mobile  |  | Desktop  |
        |(SW+Manifest)| |(Capacitor)|  |(Electron)|
        +----------+  +----------+  +----------+
`

### 2.2 Componentes Principais

| Componente | Responsabilidade | Tecnologia |
| ---------- | ---------------- | ---------- |
| **Backend API** | REST API, autenticacao, proxy ThingSpeak, logs | Node.js + Express |
| **MongoDB** | Persistencia de usuarios e logs de acesso | MongoDB Atlas |
| **Frontend** | Dashboard interativo, graficos, alertas | HTML + CSS + JS + Chart.js |
| **Service Worker** | Cache offline, PWA install | sw.js v4 |
| **Mobile App** | App Android nativo | Capacitor + PWABuilder |
| **Desktop App** | App Windows nativo | Electron |
| **ThingSpeak** | Dados dos sensores IoT | ThingSpeak API |
| **Broker MQTT local** | Transporte de comandos de atuadores (server.js -> ESP32) | MQTT (mosquitto) |
| **ESP32** | Sensores + atuadores (relés/PWM); subscreve topicos `.../comando` | Firmware Arduino (`estufa_unificado (2).ino`) |

### 2.3 Fluxo de Dados

1. **Sensores** -> ThingSpeak (dados publicados via MQTT/HTTP)
2. **Frontend** -> Backend (/api/thingspeak/last) -> ThingSpeak API
3. **Backend** responde com JSON -> Frontend atualiza graficos
4. **Alertas** -> Frontend verifica thresholds e exibe alertas visuais
5. **Logs** -> Backend registra acesso no MongoDB via AccessLog
6. **Controlo ativo** -> Dashboard (botoes/slider) -> POST /api/control (server.js,
   protegido por auth) -> Broker MQTT local -> ESP32 aciona relé/PWM
   (Em Vercel: stub devolve 503; ver Secao 11.1)

### 2.4 Stack Tecnologica

| Camada | Escolha | Motivo |
| ------ | ------- | ------ |
| Runtime | **Node.js** | Universal, serverless-friendly, grande ecossistema |
| Backend | **Express 4.22** | Leve, rapido, middleware ecosystem |
| Banco | **MongoDB Atlas + Mongoose 9.6** | NoSQL, serverless-friendly, gratuito |
| Frontend | **HTML/CSS/JS vanilla** | Simples, sem build step, PWA-ready |
| Graficos | **Chart.js** | Leve, interativo, canvas rendering (60k+ GitHub stars) |
| Auth | **JWT 9.0 + bcryptjs 3.0** | Stateless, seguro, httpOnly cookie |
| PWA | **Service Worker v4** | Offline, instalavel, network-first |
| Mobile | **Capacitor 8.3** | Cross-platform, WebView-based, facil integracao |
| Desktop | **Electron 42.2** | Cross-platform, Node.js integration |
| Deploy | **Vercel** | Serverless, CI/CD integrado, gratuito |
| Icons | **SVG/PNG** | PWA icons, manifest |
| Security | **express-rate-limit 7.5** | Protecao contra brute-force (20 req/15 min) |
| Config | **dotenv 17.4** | Gerenciamento de variaveis de ambiente |
| Cookies | **cookie-parser 1.4** | Gerenciamento seguro de cookies |
| MQTT client | **mqtt 5.16** | Publica comandos de atuadores no broker local (`server.js`) |

### 2.5 Estrutura de Pastas

`
estufa-dashboard-tcc/
|-- api/                        # Backend (Vercel serverless functions)
|   |-- index.js               # Rotas principais (auth proxy, thingspeak)
|   |-- auth.js                # Login, registro, logout, validacao JWT
|   |-- admin.js               # CRUD admin (logs, usuarios)
|   |-- db.js                  # Conexao MongoDB (Mongoose)
|   |-- thingspeak.js          # Proxy + parsing dados ThingSpeak
|
|-- public/                    # Frontend estatico
|   |-- index.html             # Login unificado (layout dividido + registro)
|   |-- login-dashboard.html   # Login usuario (auth-card + registro)
|   |-- login-admin.html       # Login admin (auth-card variante admin)
|   |-- dashboard.html         # Dashboard principal (graficos) — SOMENTE LEITURA
|   |-- admin.html             # Painel administrativo (controlo + monitorizacao)
|   |-- css/                   # CSS modular (carregado em cascata)
|   |   |-- tokens.css         # Variaveis de design (cores, sombras, fontes)
|   |   |-- base.css           # Reset, tipografia, botoes, topbar
|   |   |-- base2.css          # Cards, badges, estados, utilitarios
|   |   |-- auth.css           # Layout de autenticacao (split + card)
|   |   |-- auth2.css          # Campos, botoes, mensagens, tabs
|   |   |-- dashboard.css      # KPIs, sensores, skeleton
|   |   |-- dashboard2.css     # Graficos, cards de atuadores
|   |   |-- dashboard3.css     # Alertas, sistema, log
|   |   |-- admin.css          # Estatisticas, tabelas, filtros
|   |   |-- control.css        # Botoes/slider de comando + faixa ao vivo (admin)
|   |-- js/                    # JS modular
|   |   |-- theme.js           # Alternancia claro/escuro persistente
|   |   |-- sensor.js          # Fetch ThingSpeak + render (partilhado)
|   |   |-- control.js         # enviarComando() + listeners (apenas admin)
|   |-- script.js              # Logica dashboard (graficos, alertas, CSV)
|   |-- pwa.js                 # Registro Service Worker
|   |-- sw.js                  # Service Worker v4 (cache modular + network-first)
|   |-- manifest-dashboard.json # PWA manifest do dashboard
|   |-- manifest-admin.json     # PWA manifest do admin
|   |-- icons/                  # Icones SVG/PNG para PWA
|
|-- mobile/                    # Apps mobile (Android)
|   |-- dashboard/             # App dashboard (Capacitor)
|   |   |-- capacitor.config.json
|   |   |-- capacitor.config.ts
|   |   |-- package.json
|   |   |-- index.html
|   |   |-- node_modules/      # Dependencias do app mobile
|   |
|   |-- admin/                 # App admin (Capacitor)
|       |-- capacitor.config.json
|       |-- capacitor.config.ts
|       |-- package.json
|       |-- index.html
|       |-- node_modules/      # Dependencias do app mobile
|
|-- scripts/                   # Scripts de build/utilidade
|   |-- make-admin.js          # Criar usuario admin
|   |-- build-mobile.js        # Build mobile via PWABuilder
|   |-- build-android.js       # Build Android via Capacitor
|
|-- models/                    # Modelos Mongoose
|   |-- User.js                # Schema usuario
|   |-- AccessLog.js           # Schema log de acesso
|
|-- electron-dashboard.js      # App desktop Dashboard (Electron)
|-- electron-admin.js          # App desktop Admin (Electron)
|-- estufa_unificado (2).ino    # Firmware ESP32 (gitignored — contem credenciais WiFi)
|-- build-dashboard.json       # Config electron-builder (dashboard)
|-- build-admin.json           # Config electron-builder (admin)
|-- server.js                  # Servidor local (dev)
|-- vercel.json                # Config deploy Vercel
|-- package.json               # Dependencias
|-- package-lock.json          # Lockfile de dependencias
|-- .env                       # Variaveis de ambiente (NAO commitado)
|-- .env.example               # Template de variaveis de ambiente
|-- .gitignore                 # Regras de exclusao do git
|-- cookies.txt                # Cookies para testes (se aplicavel)
|-- BLUEPRINT.md               # Este documento
|-- README.md                  # Documentacao basica
|-- README-APPS.md             # Documentacao de apps mobile/desktop
`

---

## 3. Modelo de Dados

### 3.1 Schema: User

`javascript
{
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true }, // bcrypt hash
  isAdmin: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  lastLogin: { type: Date }
}
`

### 3.2 Schema: AccessLog

`javascript
{
  username: { type: String, required: true },
  ip: { type: String },
  userAgent: { type: String },
  timestamp: { type: Date, default: Date.now },
  action: { type: String }, // login, logout, view_dashboard, view_admin
  status: { type: String } // success, failed
}
`

### 3.3 Indices

- User.username: unique index
- AccessLog.timestamp: TTL index (opcional, 90 dias)
- AccessLog.username: index para busca por usuario

---

## 4. Sistema de Autenticacao

### 4.1 Visao Geral

O sistema de autenticacao utiliza **JWT (JSON Web Tokens)** com a seguinte estrutura:

`
JWT = Header.Payload.Signature

Header:  { alg: HS256, typ: JWT }
Payload: { userId: ..., username: ..., isAdmin: false, iat: 123, exp: 456 }
Signature: HMACSHA256(base64(header) + . + base64(payload), secret)
`

**Caracteristicas:**
- **JWT** com expiracao de 8 horas
- **Cookie httpOnly** (padrao) + **localStorage** fallback (PWA mobile)
- **bcryptjs** para hash de senhas (salt rounds: 12)
- **JWT_SECRET** gerado dinamicamente (64 bytes aleatorios) se nao definido
- **Middleware** authenticateToken protege rotas sensiveis
- **express-rate-limit** para protecao contra brute-force (20 req/15 min por IP)

### 4.2 Fluxo de Registro

1. Usuario preenche formulario (username, password)
2. Frontend valida campos obrigatorios
3. POST /api/auth/register -> verifica duplicidade -> bcrypt hash -> salva User
4. Retorna JWT em cookie httpOnly + localStorage
5. Redirect para dashboard

### 4.3 Fluxo de Login

1. Usuario preenche credenciais
2. POST /api/auth/login -> busca User -> bcrypt.compare
3. Se valido: gera JWT -> set cookie httpOnly -> registra AccessLog
4. Se invalido: retorna 401 + registra AccessLog (failed)

### 4.4 Middleware de Autenticacao

`javascript
function authenticateToken(req, res, next) {
  const token = req.cookies.token || req.headers.authorization?.split(" \)[1];
## 5. Integracao com ThingSpeak

### 5.1 Configuracao

- **API Key:** Variavel de ambiente THINGSPEAK_API_KEY
- **Channel ID:** Variavel de ambiente THINGSPEAK_CHANNEL_ID
- **Base URL:** https://api.thingspeak.com/channels/{channel_id}/feeds.json

### 5.2 Campos do Canal

| Campo | Nome | Unidade | Descricao |
| ----- | ---- | ------- | --------- |
| field1 | Temperatura | C | Temperatura ambiente (DHT22) |
| field2 | Umidade Solo | % | Umidade do solo (sensor analogico) |
| field3 | Luminosidade | lux | Intensidade luminosa (BH1750) |
| field4 | Umidade Ar | % | Umidade relativa do ar (DHT22) |
| field5 | Estado Ventilador | 0/1 | Estado digital do relé (0=Off, 1=On) |
| field6 | Estado Valvula | 0/1 | Estado digital da valvula (0=Fechada, 1=Aberta) |
| field7 | Duty Iluminacao | 0-100 | Percentagem PWM (0=apagado, 100=completo) |
| field8 | RSSI WiFi | dBm | Forca do sinal do ESP32 |

> **Nota (fonte de verdade):** este mapeamento e o que o firmware publica
> (`publicarThingSpeak()` no `.ino`) e o que o frontend le
> (`processarUltimo()` em `public/js/sensor.js`, partilhado por dashboard e admin).
> Tabelas antigas que listavam
> field5=temp. solo, field6=CO2, field7=pH, field8=pressao estavam **desatualizadas**.

### 5.3 Endpoints

| Metodo | Rota | Descricao |
| ------ | ---- | --------- |
| GET | /api/thingspeak/last | Ultimos dados (1 resultado) |
| GET | /api/thingspeak/history?days=7 | Historico (N dias) |

### 5.4 Exemplo de Resposta ThingSpeak

`
channel: { id: 123456, name: Estufa 01, field1: Temperatura, field2: Umidade }
feeds: [{ created_at: 2026-09-10T12:00:00Z, field1: 25.5, field2: 65.0 }]
`

### 5.5 Thresholds de Alerta

| Sensor | Minimo | Maximo | Unidade |
| ------ | ------ | ------ | ------- |
| Temperatura | 18 | 32 | C |
| Umidade | 40 | 80 | % |
| Umidade Solo | 30 | 70 | % |
| Luminosidade | 500 | 2000 | lux |

---

## 6. Frontend - Paginas e Componentes

### 6.1 Paginas HTML

| Pagina | Arquivo | Descricao |
| ------ | ------- | --------- |
| Landing | index.html | Pagina inicial com botao de login |
| Login Dashboard | login-dashboard.html | Formulario login usuario |
| Login Admin | login-admin.html | Formulario login admin |
| Dashboard | dashboard.html | Graficos em tempo real + alertas (somente leitura — sem comandos) |
| Admin | admin.html | Logs + gerenciamento usuarios + monitorizacao ao vivo + controlo de atuadores |

> **Separacao de privilegios:** `dashboard.html` nunca envia comandos (nao carrega
> `js/control.js`); `admin.html` controla atuadores e mostra monitorizacao ao vivo
> (carrega `js/sensor.js` + `js/control.js`).

### 6.2 Componentes CSS

- **Variaveis CSS** (:root): Cores, espacamentos, fontes
- **Layout**: Flexbox/Grid responsivo
- **Cards**: Containeres de dados com sombra
- **Graficos**: Containeres Chart.js (canvas)
- **Alertas**: Badges visuais (verde/amarelo/vermelho)
- **Botoes**: Estilos hover/active
- **Formularios**: Inputs, labels, validacao visual
- **control.css**: `.ctrl-btn`, `.ctrl-slider`, `.ctrl-status-msg`, `.live-strip`
  (comando + faixa de monitorizacao) — carregado **apenas** pelo admin

### 6.3 Funcoes JavaScript

**`public/script.js`** (dashboard — leitura + graficos):

| Funcao | Descricao |
| ------ | --------- |
| initChart() | Inicializa graficos Chart.js |
| buscarHistorico() | Busca historico do ThingSpeak via backend |
| exportarCSV() | Exporta o historico carregado para CSV |
| verificarAlertas() | Verifica thresholds e exibe alertas |
| iniciarContagem() | Countdown ate a proxima atualizacao |
| doLogout() | Limpa sessao e redirect |

**`public/js/sensor.js`** (partilhado dashboard + admin):

| Funcao | Descricao |
| ------ | --------- |
| buscarUltimo() | GET /api/thingspeak/last + atualiza UI |
| processarUltimo() | Mapeia field1-8, atualiza sensores e cards de atuadores |
| atualizarSensor() / setDelta() / setStateDot() | Render de valor, delta e estado |
| atualizarAtuador() | Chip ON/OFF + classe `.is-on` no card |
| setStatus() / setText() | Status pill e utilitario de texto |

**`public/js/control.js`** (apenas admin):

| Funcao | Descricao |
| ------ | --------- |
| enviarComando() | POST /api/control (proxy MQTT) — vent/valv/ilum com lock anti-duplo-clique |
| mostrarMsgControlo() | Mensagem de feedback/erro (503, 401) sob a grid de atuadores |
| cicloMonitorizar() | Polling do feed (INTERVALO_S) para a faixa ao vivo do admin |


### 6.4 Tipos de Graficos

- **Linha**: Temperatura/Umidade ao longo do tempo
- **Gauge**: Valor atual (velocimetro)
- **Barras**: Comparacao entre campos
- **Donut**: Distribuicao percentual

---

## 7. Painel Admin

### 7.1 Componentes

- **Tabela Logs**: IP, usuario, acao, status, timestamp
- **Tabela Usuarios**: username, isAdmin, ultimo login
- **Filtros**: Por usuario, acao, periodo
- **Paginacao**: 25 registros por pagina
- **Monitorizacao ao Vivo**: faixa com 4 sensores (`.live-strip`), status pill,
  ultima leitura, RSSI e estado dos atuadores (via `/js/sensor.js`)
- **Controlo de Atuadores**: cards com botoes ON/OFF (ventilador, valvula) e
  slider PWM 0-100 % (iluminacao), com mensagem de feedback (`.ctrl-status-msg`)

### 7.2 Funcoes JavaScript

**Inline em `admin.html`:**

| Funcao | Descricao |
| ------ | --------- |
| loadLogs() | Busca logs da API |
| loadUsers() | Busca usuarios da API |
| renderLogs() | Renderiza tabela de logs |
| computeStats() | Calcula estatisticas |
| filterLogs() | Filtra logs por criterio |
| doLogout() | Logout admin |

**Em `js/sensor.js` + `js/control.js`** (ver Secao 6.3): `buscarUltimo()`,
`processarUltimo()`, `atualizarAtuador()`, `enviarComando()`, `cicloMonitorizar()`.


---

## 8. PWA e Service Worker

### 8.1 Service Worker v4 (sw.js)

- **Cache:** `estufa-v4` (versionado — `activate` apaga versoes antigas)
- **Pre-cache (ASSETS):** CSS modular (10 folhas, incl. control.css), scripts
  (`/script.js`, `/js/theme.js`, `/js/sensor.js`, `/js/control.js`, `/pwa.js`),
  paginas publicas (`index.html`, logins) e manifests PWA
- **Nao pre-cacheia rotas protegidas** (`/`, `/dashboard.html`, `/admin.html`) —
  ficam a cargo do network-first em runtime, para nao gravar a pagina de login
  sob a chave de outra rota
- **API (`/api/*`):** network-only; offline devolve 503 JSON

## 9. Apps Mobile (Android)

### 9.1 Estrutura

`
mobile/
|-- dashboard/         # App dashboard
|   |-- capacitor.config.ts
|   |-- package.json
|   |-- android/        # Projeto Android gerado
|
|-- admin/             # App admin
|   |-- capacitor.config.ts
|   |-- package.json
|   |-- android/        # Projeto Android gerado
`

### 9.2 Configuracao Capacitor

- appId: com.estufa01.dashboard
- appName: Estufa 01
- webDir: ../../public
- androidScheme: https

### 9.3 Build

1. npx cap sync - Sincroniza web assets para Android
2. npx cap open android - Abre Android Studio
3. Build via Android Studio ou npx cap build android
4. APK gerado em android/app/build/outputs/apk/

### 9.4 PWABuilder (alternativa)

- Usa script build-mobile.js
- Gera APK via Bubblewrap (CLI)
- Requer manifest valido + icons PNG

---

## 10. Apps Desktop (Electron/Windows)

### 10.1 electron-dashboard.js

`javascript
const { app, BrowserWindow } = require('electron');
function createWindow() {
  const win = new BrowserWindow({
    width: 1200, height: 800,
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });
  win.loadFile('public/dashboard.html');
}
app.whenReady().then(createWindow);
`

### 10.2 electron-admin.js

- Estrutura identica ao dashboard
- Carrega admin.html
- Janela separada para painel admin

### 10.3 Configuracao (build-dashboard.json)

- appId: com.estufa01.dashboard
- productName: Estufa 01 Dashboard
- win.target: nsis
- output: release/

### 10.4 Build

1. npm install electron electron-builder
2. npx electron-builder --config build-dashboard.json
3. Instalador gerado em release/

---

## 11. Deploy (Vercel)

### 11.1 vercel.json

- **builds**: API (serverless) + public (static)
- **routes**: Rewrite /api/* para serverless functions
- **headers**: Cache-Control para static assets
- **regions**: gru1 (Sao Paulo) para baixa latencia

### 11.2 Variaveis de Ambiente

| Variavel | Descricao | Obrigatoria |
| -------- | --------- | ----------- |
| MONGODB_URI | URI de conexao MongoDB Atlas | Sim |
| JWT_SECRET | Chave secreta JWT (gerado automaticamente se nao definido) | Nao |
| TS_API_KEY | API key do ThingSpeak (escrita) | Recomendado |
| TS_CHANNEL | ID do canal ThingSpeak | Sim |
| APP_URL | URL base para apps Electron/Mobile | Nao (default: localhost) |
| PORT | Porta do servidor local | Nao (default: 3000) |
| NODE_ENV | production/development | Nao |

**Nota:** As variaveis `TS_API_KEY` e `TS_CHANNEL` sao usadas pelo backend para comunicacao com a API do ThingSpeak. O `JWT_SECRET` e gerado dinamicamente usando `crypto.randomBytes(64)` se nao definido.

| Variavel | Descricao | Obrigatoria |
| -------- | --------- | ----------- |
| LOCAL_MQTT_BROKER | URL do broker MQTT local (controlo de atuadores em `server.js`) | Nao (default: `mqtt://192.168.100.3:1883`) |

### 11.1.1 Controlo de Atuadores (`/api/control`)

- **Cliente autorizado:** apenas `public/js/control.js`, carregado **somente** por
  `admin.html`. O dashboard publico nao tem botoes de comando nem o script.
- **Servidor local (`server.js`):** rota real, protegida por `requireAuthApi`,
  valida `actuator` (`vent|valve|light`) e `action`, publica JSON no broker MQTT
  e regista auditoria (`control_<actuator>`) no AccessLog.
- **Vercel (`api/index.js`):** stub que devolve **503** — o serverless nao alcanca
  o broker da rede da estufa. O frontend trata 503 com mensagem amigavel.
- **Topicos MQTT:** `fazenda/estufa01/atuador/vent_001|valv_001|ilum_001/comando`
  payloads `{"command":"ON"|"OFF"}` (vent/valv) e `{"duty":0-100}` (ilum).
- **Sem ack:** a API confirma apenas a publicacao no broker (`res.json({ok:true})`);
  o estado real regressa depois pelo ThingSpeak (field5-8) e e refletido nos cards.


### 11.3 CI/CD

- Push na main -> Deploy automatico via GitHub integration
- Preview deployments para branches
- Rollback via Vercel Dashboard

---

## 12. Scripts e Utilitarios

### 12.1 make-admin.js

- Promove um usuario existente a administrador
- **Uso:** `node scripts/make-admin.js <username>`
- Verifica se o usuario existe antes de promover
- Conecta ao MongoDB usando as variaveis de ambiente

### 12.2 build-mobile.js

- Gera links para build mobile via PWABuilder
- **Uso:** `node scripts/build-mobile.js <dashboard|admin|both>`
- Suporta variavel de ambiente `APP_URL` para base URL
- Gera links diretos para PWABuilder com URLs configuradas
- Pode abrir o navegador automaticamente

### 12.3 build-android.js

- Gera projetos Android nativos via Capacitor
- **Uso:** `node scripts/build-android.js`
- Cria estrutura completa para Dashboard e Admin
- Configura Capacitor com server URL apontando para producao
- Suporta variavel de ambiente `APP_URL` para base URL
- Dependencias: Java 17+, Android SDK, Android Studio

---

## 13. Padroes de Codigo e Governanza

### 13.1 Convenções de Nomenclatura

| Elemento | Convenção | Exemplo |
| -------- | --------- | ------- |
| Arquivos | kebab-case | dashboard.html, script.js |
| Funções | camelCase | loadData(), initChart() |
| Variáveis | camelCase | userName, isAdmin |
| Constantes | SCREAMING_SNAKE | MAX_RETRIES |

### 13.2 Padrão de Commits

| Prefixo | Uso |
| ------- | --- |
| feat: | Nova funcionalidade |
| fix: | Correção de bug |
| docs: | Documentação |
| refactor: | Refatoração sem mudar comportamento |
| chore: | Manutenção |

### 13.3 Branches

- main sempre deployável
- Features em branches próprias
- Commits diretos na main evitados

---

## 14. Seguranca

### 14.1 Checklist Pre-Deploy

- [x] Nenhum segredo hardcoded em codigo
- [x] .env no .gitignore
- [x] JWT_SECRET forte (32+ caracteres) - gerado dinamicamente se nao definido
- [x] bcrypt hash para senhas
- [x] Cookies httpOnly + Secure
- [ ] Validacao de entrada em todos os forms
- [ ] Rate limiting nas rotas de auth
- [ ] CORS configurado corretamente
- [x] HTTPS em producao
- [ ] Headers de seguranca (HSTS, X-Frame-Options)
- [x] Logs de acesso registrados
- [ ] MongoDB Atlas com IP whitelist
- [x] Service Worker com cache seguro
- [x] Electron com nodeIntegration=false
- [ ] Dependencias auditadas (npm audit)
- [x] `/api/control` protegida por `requireAuthApi` + auditoria no AccessLog
      (sem rate-limit proprio — mitigado por auth + rede local; ver Secao 11.1.1)
- [x] Interface de controlo carregada apenas no painel de admin
      (`js/control.js`); o dashboard publico e somente leitura

### 14.2 Recomendacoes Express.js Security

Baseado no Express.js Security Best Practices:
- [x] Usar **express-rate-limit** para brute-force protection (implementado: 20 req/15 min)
- [x] Usar cookies com flags **httpOnly, sameSite** (implementado)
- [ ] Usar **Helmet** para headers de seguranca (pendente)
- [ ] Validar e sanitizar toda entrada de usuario (pendente)
- [ ] Manter dependencias atualizadas (npm audit) (pendente)
- [x] Usar HTTPS em producao (implementado via Vercel)
- [x] Gerenciamento de variaveis de ambiente com **dotenv** (implementado)
- [x] Cookie parser para gerenciamento seguro (implementado)

### 14.3 Gestao de Segredos

| Segredo | Onde vive | Status |
| ------- | --------- | ------ |
| MONGODB_URI | Vercel env vars | ✅ Seguro |
| JWT_SECRET | Vercel env vars / gerado dinamicamente | ✅ Seguro |
| THINGSPEAK_API_KEY | Vercel env vars | ✅ Seguro |
| TS_CHANNEL | Vercel env vars | ✅ Seguro |

**Regras de Seguranca:**
- Nunca commitar arquivos `.env` ou `.jwt_secret`
- `.env.example` deve conter apenas placeholders, nunca valores reais
- JWT_SECRET e gerado dinamicamente se nao definido (64 bytes aleatorios)
- Channel ID e API Key devem ser definidos via variaveis de ambiente

---

## 15. Roadmap / Futuras Melhorias

### 15.1 Prioritarias

1. **Testes automatizados** - Jest para backend, Cypress para frontend
2. **Notificacoes push** - Alertas via Web Push API
3. **Modo escuro/claro** - Toggle de tema no dashboard

### 15.2 Media Prioridade

4. **Exportacao de dados** - CSV/PDF dos historicos
5. **Multi-idioma** - i18n (pt-BR, en-US)
6. **Graficos avancados** - Heatmap, correlacao entre sensores
7. **Alertas por email** - Notificacao por threshold via SMTP
8. **App iOS** - Build iOS via Capacitor
9. **PWA offline completo** - Funcionamento sem internet

### 15.3 Baixa Prioridade / Futuro

10. **Machine Learning** - Predicao de tendencias
11. **Integracao com atuadores** - Controle de ventilacao/irrigacao
12. **Multi-estufa** - Suporte a multiplas estufas
13. **API publica** - REST API documentada (Swagger)
14. **Docker** - Containerizacao para deploy flexivel
15. **CI/CD completo** - GitHub Actions com testes + deploy

---

## 16. Anexo: Decisoes de Arquitetura e FAQ

### 16.1 Decisoes Principais

| Decisao | Justificativa |
| ------- | ------------- |
| Node.js + Express | Universal, serverless-friendly, grande ecossistema |
| MongoDB Atlas | NoSQL flexivel, gratuito, serverless-friendly |
| HTML/CSS/JS vanilla | Simples, sem build step, PWA-ready |
| Chart.js | Leve, interativo, canvas rendering (60k+ GitHub stars) |
| Vercel | Serverless, CI/CD integrado, dominio customizado gratuito |
| JWT + bcrypt | Stateless, seguro, amplamente adotado |
| Capacitor | Cross-platform, WebView-based, facil integracao |
| Controlo de atuadores so no admin | Menor superficie de ataque: o dashboard publico e somente leitura; os comandos exigem sessao autenticada |
| JS partilhado sem bundler (`sensor.js`) | Reutiliza fetch/render entre dashboard e admin sem introduzir build step (mantem HTML/CSS/JS vanilla) |

### 16.2 FAQ

**Por que nao React/Vue?**
Simplicidade. O projeto nao precisa de SPA; HTML vanilla + Chart.js atende.

**Por que MongoDB e nao PostgreSQL?**
Flexibilidade de schema e facilidade de uso com Node.js.

**Por que Vercel e nao Railway/Heroku?**
Serverless functions + deploy automatico + dominio customizado gratuito.

**O PWA funciona offline?**
Parcialmente. Assets sao cacheados, mas dados requerem rede.

**Como adicionar novos sensores?**
Adicione fields no ThingSpeak e mapeie no frontend (`public/js/sensor.js`, que e
carregado pelo dashboard e pelo admin).

**Qual a estrutura do JWT?**
Header.Payload.Signature - Header define algoritmo, Payload tem claims (userId, exp), Signature garante integridade.

**Como funciona o controlo ativo de atuadores?**
O painel de admin (`admin.html`, autenticado) envia POST `/api/control` via
`public/js/control.js` -> `server.js` publica no broker MQTT local -> o ESP32
subscreve `fazenda/estufa01/atuador/*/comando` e aciona relé/PWM. O dashboard
publico **nao** tem botoes de comando. So funciona na rede local da estufa; no
deploy Vercel o endpoint devolve 503 (consultar Secao 11.1.1 e bug #11).

**Como sei o estado real apos enviar um comando?**
A API nao devolve ack do ESP32: confirma apenas a publicacao no broker. O estado
real chega pelo ThingSpeak (field5-8) no ciclo de monitorizacao seguinte
(`INTERVALO_S`), atualizando os cards de atuadores no dashboard e no admin.


---

## 17. Checklist de Lancamento (Go-Live)

### 17.1 Pre-Deployment

- [ ] README.md com passo a passo completo
- [ ] .env.example com todas as variaveis
- [ ] Testes passando (se aplicavel)
- [ ] Build local funcionando
- [ ] Variaveis de ambiente configuradas no Vercel

### 17.2 Configuracao Vercel

- [ ] Repositorio conectado
- [ ] Framework preset: Other
- [ ] Build command: (none - serverless)
- [ ] Output directory: public
- [ ] Environment variables configuradas

### 17.3 Pos-Deployment

- [ ] HTTPS funcionando
- [ ] Login/Logout funcionando
- [ ] Dashboard carregando dados
- [ ] Admin panel acessivel
- [ ] PWA instalavel
- [ ] Service Worker registrado

### 17.4 Documentacao

- [ ] README.md atualizado
- [ ] Este blueprint atualizado
- [ ] Roadmap.md revisado

---

## 18. Entidades e Estrutura de Dados (Referencia Rapida)

### 18.1 User Collection

`
username: String (unique, required)
password: String (required, bcrypt hash)
isAdmin: Boolean (default: false)
createdAt: Date (default: Date.now)
lastLogin: Date
`

### 18.2 AccessLog Collection

`
username: String (required)
ip: String
userAgent: String
timestamp: Date (default: Date.now)
action: String (login, logout, view_dashboard, view_admin)
status: String (success, failed)
`

### 18.3 JWT Payload

`
userId: String (User._id)
username: String
isAdmin: Boolean
iat: Number (issued at)
exp: Number (expiration)
`

### 18.4 ThingSpeak Response

`
channel: { id, name, description, field1-8 }
feeds: [{ created_at, field1-8, entry_id }]
`

### 18.5 Estrutura de Arquivos Resumo

`
estufa-dashboard-tcc/
|-- api/                     # Backend - 5 arquivos (index, auth, admin, db, thingspeak)
|-- public/                  # Frontend - 14 arquivos HTML/CSS/JS + 3 modulos js/ + manifests + icons
|-- mobile/                  # Apps mobile - 2 apps (dashboard, admin)
|   |-- dashboard/           # App dashboard com Capacitor
|   |-- admin/               # App admin com Capacitor
|-- models/                  # Schemas Mongoose - 2 arquivos (User, AccessLog)
|-- scripts/                 # Build scripts - 3 arquivos
|-- electron-dashboard.js    # App desktop Dashboard
|-- electron-admin.js        # App desktop Admin
|-- build-dashboard.json     # Config electron-builder (dashboard)
|-- build-admin.json         # Config electron-builder (admin)
|-- server.js                # Servidor local (dev)
|-- vercel.json              # Config deploy Vercel
|-- package.json             # Dependencias do projeto
|-- .env                     # Variaveis de ambiente (NAO commitado)
|-- .env.example             # Template seguro de variaveis
|-- .gitignore               # Regras de exclusao do git
|-- BLUEPRINT.md             # Este documento
|-- README.md                # Documentacao basica
|-- README-APPS.md           # Documentacao de apps mobile/desktop
`

---

**Fim do Blueprint Estufa 01 v1.3.1**

