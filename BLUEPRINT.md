# 🌲 Estufa 01 — Blueprint Mestre do Projeto

> **Versão:** 1.2.0 · **Data:** 15/09/2026 · **Repositório:** https://github.com/matheusbritogarbin-byte/Estufa-Dashboard-TCC.git
>
> **Este documento é o prompt operacional do projeto** — qualquer IA, em qualquer fase ou sessão, deve segui-lo como instrução, não apenas consultá-lo como referência de fundo.

---

## Registro de Revisoes

Historico completo de todos os commits do projeto, organizados por versao.

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

- **Versao atual (v1.1.0):** Dashboard web completo com autenticacao, graficos ThingSpeak, PWA, apps mobile (Android) e desktop (Electron/Windows).
- **Stack:** Node.js + Express + MongoDB + HTML/CSS/JS vanilla + Chart.js + Service Worker + Capacitor + Electron.
- **Deploy:** Vercel (serverless functions) com dominio customizado (dashboardestufaiot.vercel.app).
- **Total de commits:** 45 commits (09/05/2026 - 11/09/2026).
- **Funcionalidades implementadas:**
  - Sistema de autenticacao JWT com cookies httpOnly + localStorage fallback
  - Dashboard com graficos em tempo real (ThingSpeak API)
  - Painel admin com logs de acesso e gerenciamento de usuarios
  - PWA com Service Worker v2 (cache limpo + network-first)
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

- _Ultima atualizacao: 11/09/2026_

---

## Bugs Conhecidos em Aberto

1. **Rate limiting no Vercel.** Funcoes serverless tem timeout de 10s (Hobby). Consultas ao MongoDB + ThingSpeak podem estourar esse limite, resultando em erro 504.
2. **initChart silencioso.** Falha na inicializacao do grafico nao mostra erro visivel ao usuario; o canvas fica vazio sem feedback.
3. **Service worker sem teste.** sw.js v2 nao tem teste automatizado; mudancas no cache podem quebrar o PWA silenciosamente.
4. **localStorage fallback.** Em modo PWA mobile, se httpOnly cookie falhar, fallback para localStorage e usado (menos seguro, vulneravel a XSS).
5. **Chart.js CDN.** Dependencia externa sem fallback local; se CDN cair, graficos param de funcionar.
6. **ThingSpeak rate limit.** API gratuita limitada a 3 requisicoes/segundo; polling frequente pode bloquear temporariamente.
7. **Electron sem assinatura.** Apps desktop nao tem codigo assinado (SmartScreen do Windows mostra aviso de seguranca).
8. **Capacitor sync manual.** npx cap sync necessario apos mudancas no frontend; nao ha automatizacao.
9. **Admin sem link para dashboard.** Pagina admin nao tem link para dashboard (decisao intencional de seguranca).
10. **Build Android requer Android Studio.** Build nativo requer Android Studio + SDK configurado localmente.

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

- **Nao e um sistema de controle ativo.** O Estufa 01 apenas monitora; nao aciona atuadores.
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
| **Service Worker** | Cache offline, PWA install | sw.js v2 |
| **Mobile App** | App Android nativo | Capacitor + PWABuilder |
| **Desktop App** | App Windows nativo | Electron |
| **ThingSpeak** | Dados dos sensores IoT | ThingSpeak API |

### 2.3 Fluxo de Dados

1. **Sensores** -> ThingSpeak (dados publicados via MQTT/HTTP)
2. **Frontend** -> Backend (/api/thingspeak/last) -> ThingSpeak API
3. **Backend** responde com JSON -> Frontend atualiza graficos
4. **Alertas** -> Frontend verifica thresholds e exibe alertas visuais
5. **Logs** -> Backend registra acesso no MongoDB via AccessLog

### 2.4 Stack Tecnologica

| Camada | Escolha | Motivo |
| ------ | ------- | ------ |
| Runtime | **Node.js** | Universal, serverless-friendly, grande ecossistema |
| Backend | **Express 4.22** | Leve, rapido, middleware ecosystem |
| Banco | **MongoDB Atlas + Mongoose 9.6** | NoSQL, serverless-friendly, gratuito |
| Frontend | **HTML/CSS/JS vanilla** | Simples, sem build step, PWA-ready |
| Graficos | **Chart.js** | Leve, interativo, canvas rendering (60k+ GitHub stars) |
| Auth | **JWT 9.0 + bcryptjs 3.0** | Stateless, seguro, httpOnly cookie |
| PWA | **Service Worker v2** | Offline, instalavel, network-first |
| Mobile | **Capacitor 8.3** | Cross-platform, WebView-based, facil integracao |
| Desktop | **Electron 42.2** | Cross-platform, Node.js integration |
| Deploy | **Vercel** | Serverless, CI/CD integrado, gratuito |
| Icons | **SVG/PNG** | PWA icons, manifest |
| Security | **express-rate-limit 7.5** | Protecao contra brute-force (20 req/15 min) |
| Config | **dotenv 17.4** | Gerenciamento de variaveis de ambiente |
| Cookies | **cookie-parser 1.4** | Gerenciamento seguro de cookies |

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
|   |-- dashboard.html         # Dashboard principal (graficos)
|   |-- admin.html             # Painel administrativo
|   |-- css/                   # CSS modular (carregado em cascata)
|   |   |-- tokens.css         # Variaveis de design (cores, sombras, fontes)
|   |   |-- base.css           # Reset, tipografia, botoes, topbar
|   |   |-- base2.css          # Cards, badges, estados, utilitarios
|   |   |-- auth.css           # Layout de autenticacao (split + card)
|   |   |-- auth2.css          # Campos, botoes, mensagens, tabs
|   |   |-- dashboard.css      # KPIs, sensores, skeleton
|   |   |-- dashboard2.css     # Graficos, historico, controles
|   |   |-- dashboard3.css     # Alertas, sistema, log
|   |   |-- admin.css          # Estatisticas, tabelas, filtros
|   |-- js/                    # JS modular
|   |   |-- theme.js           # Alternancia claro/escuro persistente
|   |-- script.js              # Logica dashboard (graficos, alertas, CSV)
|   |-- pwa.js                 # Registro Service Worker
|   |-- sw.js                  # Service Worker v3 (cache modular + network-first)
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
| field1 | Temperatura | C | Temperatura ambiente |
| field2 | Umidade | % | Umidade relativa do ar |
| field3 | Umidade Solo | % | Umidade do solo |
| field4 | Luminosidade | lux | Intensidade luminosa |
| field5 | Temperatura Solo | C | Temperatura do solo |
| field6 | CO2 | ppm | Concentracao de CO2 |
| field7 | pH | pH | Nivel de pH do solo |
| field8 | Pressao | kPa | Pressao atmosferica |

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
| Dashboard | dashboard.html | Graficos em tempo real + alertas |
| Admin | admin.html | Logs + gerenciamento usuarios |

### 6.2 Componentes CSS

- **Variaveis CSS** (:root): Cores, espacamentos, fontes
- **Layout**: Flexbox/Grid responsivo
- **Cards**: Containeres de dados com sombra
- **Graficos**: Containeres Chart.js (canvas)
- **Alertas**: Badges visuais (verde/amarelo/vermelho)
- **Botoes**: Estilos hover/active
- **Formularios**: Inputs, labels, validacao visual

### 6.3 Funcoes JavaScript (script.js)

| Funcao | Descricao |
| ------ | --------- |
| initChart() | Inicializa graficos Chart.js |
| loadData() | Busca dados do ThingSpeak via backend |
| updateCharts() | Atualiza graficos com novos dados |
| checkAlerts() | Verifica thresholds e exibe alertas |
| doLogout() | Limpa sessao e redirect |

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

### 7.2 Funcoes JavaScript (admin.html)

| Funcao | Descricao |
| ------ | --------- |
| loadLogs() | Busca logs da API |
| loadUsers() | Busca usuarios da API |
| renderLogs() | Renderiza tabela de logs |
| computeStats() | Calcula estatisticas |
| filterLogs() | Filtra logs por criterio |
| doLogout() | Logout admin |

---

## 8. PWA e Service Worker

### 8.1 Service Worker v2 (sw.js)

`javascript
const CACHE_NAME = " estufa-cache-v2\;
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
Adicione fields no ThingSpeak e mapeie no frontend (script.js).

**Qual a estrutura do JWT?**
Header.Payload.Signature - Header define algoritmo, Payload tem claims (userId, exp), Signature garante integridade.

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
|-- public/                  # Frontend - 12 arquivos HTML/CSS/JS + manifests + icons
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

**Fim do Blueprint Estufa 01 v1.1.0**
