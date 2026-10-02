# 🌲 Estufa 01 — Blueprint Mestre do Projeto

> **Versão:** 1.6.5 · **Data:** 02/10/2026 · **Repositório:** https://github.com/matheusbritogarbin-byte/Estufa-Dashboard-TCC.git
>
> **Fork do co-autor:** https://github.com/blecaute373/Estufa-Dashboard-TCC (remote `mine`)
>
> **Autores:** **Deivisson Lino Campos dos Santos Junior** ([@blecaute373](https://github.com/blecaute373)) — **autor da camada de hardware e dados** (firmware ESP32 em C++, integração ThingSpeak no firmware, dashboard "as is" calibrado, stack Node-RED/InfluxDB/Grafana) e **co-autor do sistema web** · Matheus Garbin ([@matheusbritogarbin-byte](https://github.com/matheusbritogarbin-byte)) — autor do **sistema web** (reestruturação em camadas, login/JWT, painel admin, apps, deploy). Repartição detalhada em [CONTRIBUTORS.md](CONTRIBUTORS.md); versão original preservada em [legacy/](legacy/README.md).
>
> **Este documento é o prompt operacional do projeto** — qualquer IA, em qualquer fase ou sessão, deve segui-lo como instrução, não apenas consultá-lo como referência de fundo.

---

## Registro de Revisoes

Historico completo de todos os commits do projeto, organizados por versao.

### v1.6.5 (02/10/2026) - Fix: log de eventos preso em "Carregando…"

`fix(admin): public/js/admin.js tinha SyntaxError que impedia o ficheiro
     inteiro de executar — faltava o `}` de fecho de `renderLogs()` (a funcao
     seguinte, `computeStats()`, ficava aninhada dentro dela) e sobrava um `}`
     a mais no fim do ficheiro que fechava o `<script>` como invalido. Com o
     parse a falhar, `loadAll()` nunca corria: nem logs nem usuarios carregavam
     e a tabela ficava eternamente em "Carregando…", mesmo com a API a
     responder 200
     - `parseDetails()` (novo): `l.details` chega como string JSON, mas podia
       chegar como objeto ou texto nao-JSON — o `JSON.parse` direto quebrava a
       renderizacao da linha inteira; agora ha fallback seguro
     - `loadLogs()`/`loadUsers()`: passam a tratar tambem 403 como "sem sessao
       admin" (redirect), mostram o status HTTP real na mensagem de erro em vez
       de "Erro ao carregar" generico, e usam `getElementById` em vez de global
       implicita do id (mais robusto)
     - coluna `#` da tabela de usuarios passa a `u.id ?? u._id` (o backend
       devolve `_id` do Mongoose; antes mostrava `undefined`)
     - sw.js cache estufa-v13 -> v14 (forca o browser a buscar o admin.js novo;
       sem bump, o PWA continuava a servir o ficheiro com SyntaxError do cache)
test: `node --check public/js/admin.js` exit 0 (antes exit 1 com
      `SyntaxError: Unexpected token '}'`), `npm run check` exit 0,
      112/112 node:test a passar, 0 falhas
`

### v1.6.4 (02/10/2026) - URL de producao, rotulo de autoria e publicacao nos dois repositorios

`docs: URL de producao corrigida no README — apontava para a implantacao ERRADA
     - As "URLs de Producao" apontavam para dashboardestufaiot.vercel.app, que e
       um projeto Vercel DIFERENTE, noutra conta (a do repo `origin`). Quem
       seguisse o README chegava a um sistema onde este autor nao tem acesso
       administrativo — ou seja, o painel de admin (onde vive o botao do rele)
       ficava inalcancavel
     - Passa a apontar para dashboardestufaiot-omega.vercel.app (conta
       `deivisson1` / CLI `blecaute373`), com o health check e as 7/7 env vars
       registadas
     - Acrescentado o aviso dos DOIS projetos com o mesmo nome-base: painel e
       firmware tem de apontar para o MESMO projeto, senao o pending busca a
       fila de um lado e os comandos ficam no outro. Sintoma: 202 no painel e
       rele parado (o modo de falha mais enganador do projeto)
     - Mesma correcao no bloco "Estado Atual" deste documento, onde o campo
       Deploy tambem citava o dominio alheio
docs: rotulo de autoria ajustado a pedido do proprio autor
     - Deivisson Lino Campos dos Santos Junior passa a "AUTOR DA CAMADA DE
       HARDWARE E DADOS" (e co-autor do sistema web) no README, no
       CONTRIBUTORS.md e no cabecalho deste documento. Antes dizia "camada de
       origem", que e mais vago e menos fiel ao que efetivamente fez
chore(git): publicacao nos DOIS repositorios, autorizada pelo autor
     - push para `mine` (blecaute373/Estufa-Dashboard-TCC) e para `origin`
       (matheusbritogarbin-byte/Estufa-Dashboard-TCC)
     - o push para `origin` e FAST-FORWARD (`git merge-base --is-ancestor
       origin/main HEAD` -> verdadeiro): nao ha reescrita de historico nem
       force-push, e os commits anteriores do outro autor ficam intactos
     - README ganha a secao de repositorios com os dois `git push` documentados
`

### v1.6.3 (02/10/2026) - Proveniencia da camada de origem e correcao de creditos

`docs: creditos corrigidos — a v1.6.2 creditava mal a ORIGEM do projeto
     - Deivisson Lino Campos dos Santos Junior (@blecaute373) e o autor da
       CAMADA DE ORIGEM: firmware ESP32 em C++ (sketch_apr13a.ino), integracao
       com a API do ThingSpeak DENTRO do firmware, a versao "as is" do dashboard
       (monolitica — CSS, JS, ThingSpeak e as chaves de API num so HTML, porem
       ja calibrada para o hardware) e a stack de dados Node-RED + InfluxDB +
       Grafana
     - A v1.6.2 dizia "Matheus Garbin — autor original ... proxy ThingSpeak":
       o proxy ATUAL (ADR-0005) e dele, mas a integracao ThingSpeak ORIGINAL,
       escrita em C++ no firmware, e do Deivisson. A atribuicao passa a ser por
       CAMADA (hardware/dados vs. sistema web) em vez de por ficheiro
     - Matheus Garbin passa a "autor do sistema web": formatou e reorganizou a
       versao "as is" em camadas, incorporou o login/autenticacao JWT, criou o
       painel de admin e conduziu as correcoes documentadas (v0.1.0 -> v1.6.1)
docs: legacy/ (NOVO) — a versao "as is" fica versionada como registro de
      proveniencia:
     - legacy/dashboard_estufa_original.html: o dashboard original, SANITIZADO
       (a chave de API do ThingSpeak embutida no HTML foi trocada por um
       placeholder — uma credencial commitada e uma credencial comprometida,
       §9.10; a chave antiga nao e a de producao, mas era uma credencial real)
     - legacy/README.md: explica por que existe e registra a PROVA da autoria
       do firmware — a linha 740 do original diz "thresholds do master
       (sketch_apr13a.ino)" e replica os SEIS valores que o §11.1.1 deste
       documento atribui ao firmware (vent >=30/<=26 C, valvula <=40/>=70 %),
       alem do INTERVALO_S = 16 do ciclo de telemetria
     - os limites de calibracao VIAJARAM do firmware para esta documentacao: e o
       rastro que liga a autoria ao artefato
docs: CONTRIBUTORS.md reescrito — reparticao por CAMADA + tabela de
      verificabilidade + nota explicando por que o git log NAO cobre a camada de
      origem: artefato que existia antes de passar pelo Git nao aparece no
      historico (o 1.º commit e literalmente "Tira o numero thinkspeak", o
      proprio ato de sanitizar a versao original para poder publica-la)
`

### v1.6.2 (02/10/2026) - Creditos de co-autoria e importacao do repositorio

`docs: Deivisson Lino Campos dos Santos Junior (@blecaute373) reconhecido como
        CO-AUTOR do projeto
     - README ganha a seccao "Autores" com a reparticao de papeis; os creditos
       do autor original (Matheus Garbin) sao preservados integralmente
     - CONTRIBUTORS.md (NOVO): reparticao detalhada, commit a commit, entre o
       autor original e o co-autor — nenhuma contribuicao e reatribuida
     - package.json: campos "author" e "contributors" (o projeto nao tinha
       metadata de autoria nenhuma)
     - Cabeçalho do BLUEPRINT passa a listar os dois autores
fix: README tinha as seccoes "Apps", "URLs de Producao" e "Licenca" DUPLICADAS
     (coladas duas vezes no mesmo ficheiro) — removida a copia
chore(git): repositorio importado para a conta do co-autor
     - Fork de matheusbritogarbin-byte/Estufa-Dashboard-TCC criado em
       blecaute373/Estufa-Dashboard-TCC (privado, com o vinculo "forked from"
       preservado); remote `mine` configurado no clone local
     - push concluido: 12 commits enviados (9 do autor original que ainda nao
       estavam no GitHub + 3 do co-autor) -> f9e786a..d88a8b0
     - As 3 autorias do co-autor usam
       274110085+blecaute373@users.noreply.github.com, o que faz o GitHub
       liga-las a conta @blecaute373; a lista de contributors do repositorio
       passa a mostrar blecaute373 (antes so aparecia o autor original)
     - O historico pre-existente do autor original NAO foi reescrito: os seus
       67 commits mantem os autores originais intactos

### v1.6.1 (02/10/2026) - MongoDB Atlas em producao: cadeia de controlo completa

`fix(deploy): MONGODB_URI configurada — o bug #13 fechou e a cadeia ficou completa
     - Cria o utilizador de BD estufa_vercel com role readWrite@estufa (nao
       readWriteAnyDatabase: a app so toca em User e AccessLog — least privilege,
       ENGENHARIA §9.2)
     - A credencial antiga NAO era recuperavel: o Atlas nunca devolve passwords
       existentes e o valor real saiu do historico do Git na v1.1.0
     - API/db.js + lib/config.js fazem fail-fast, portanto sem MONGODB_URI o
       POST /api/auth/login devolvia 500 e o painel de admin (onde vive o botao
       do rele) ficava inalcancavel — a fila funcionava, o caminho humano nao
     - scripts/check-mongo.js (NOVO) + npm run check:mongo: separa formato da
       URI (offline), ping autenticado, leitura das colecoes reais e ESCRITA
       numa colecao descartavel; imprime a URI sempre mascarada (um diagnostico
       que loga a URI inteira e ele proprio o incidente)
     - Fora do npm run check, tal como o check:control: precisa de rede e
       credenciais reais; check/test sao hermeticos por desenho (§5.2)
     - script carrega .env e .env.local (o CLI da Vercel escreve o segundo)
docs: ADR-0010 (novo) — cluster, utilizador minimo, trade-off do 0.0.0.0/0 na
      Access List, e o metodo (o Atlas CLI existe, so nao esta no PATH); indice
      ADR; ADR-0008 (tabela de verificacao: login 500 -> 200); BLUEPRINT 1.6.1 —
      Registro, Estado Atual, 11.2, 12, 14.1, 14.3, bug #13 fechado
test: verificacao por pedidos HTTP REAIS no site publicado (nao inspecao de
      codigo): register 200 is_admin:true, login 200, admin/users 200 e 401 sem
      token, admin/logs 200, control 202 -> pending 200 com o MESMO id ->
      2.º poll count:0, thingspeak 200
test: 112/112 node:test a passar, 0 falhas (24 suites); `npm run check` e
      `npm run check:mongo` com exit 0
`

### v1.6.0 (25/09/2026) - Fila de comandos em Upstash Redis (arquitetura hibrida)

`feat(control): a fila de comandos sai do MongoDB para o Upstash Redis
     - ADR-0008: o Redis substitui APENAS o ControlCommand; User e AccessLog
       continuam no MongoDB (populate/countDocuments/paginacao sem equivalente
       barato em Redis — e os logs sao o dado que nao se pode perder)
     - lib/store.js (novo): porta unica para o Redis (LPUSH/LPOP/EXPIRE);
       o contrato JSON do endpoint NAO mudou, o firmware nao se adaptou
     - API: GET /pending passa a ser 1 comando (LPOP chave 10) em vez de 2+
       queries — e atomico, o que elimina a corrida find/updateMany (§12.2)
     - api/control.js: o comando entra na fila ANTES da auditoria e o poll ja
       nao chama connectDB() — uma falha do Atlas nao bloqueia mais o
       controlo da estufa (bolkhead §11.3)
     - lib/config.js: getRedisConfig() com fail-fast e sem fallback
     - models/ControlCommand.js: REMOVIDO
     - firmware estufa45: POLL_COMANDO_MS 5 s -> 10 s
     (8 640 comandos/dia = 259 200/mes, dentro dos 500K/mes do plano gratis;
      a 5 s seriam 518 400/mes e estourariam. A 10 s o controlo continua mais
      responsivo que a telemetria ThingSpeak, que publica a cada ~15 s.)
     - .env.example/README: REDIS_URL (uma unica variavel com endpoint + token)
     - admin.html + js/control.js: textos de "ate ~5 s" corrigidos para "~10 s"
       (o que o utilizador le na tela tinha de bater certo com o firmware)
     - sw.js cache estufa-v11
docs: ADR-0008 (novo), ADR-0007 marcado como superado (fila), indice ADR e
      BLUEPRINT 1.6.0 — Registro, Estado Atual, 8.1, 11.1.1, 11.2, 14.1, 14.3,
      16.2, bug #11/#12
test: 61/61 node:test a passar (+11: entrega atomica sob polls concorrentes,
      expiracao, limite de 10/poll, autoria, e lib/store em Small)
`

### v1.5.0 (24/09/2026) - Controle Remoto so via Vercel (fila de comandos)

`feat(control): controlo de atuadores no site publicado, sem ngrok nem broker externo
     - ADR-0007: o sentido do comando e invertido — a Vercel e serverless e nao
       alcanca a rede local, logo quem busca o comando e o ESP32
       (GET /api/control/pending a cada 5 s, X-Device-Token em tempo constante)
     - lib/control.js: contrato (actuator, action) -> payload como fonte unica
       para os 2 caminhos (local MQTT + fila na nuvem)
     - api/control.js: POST /api/control (admin, 202 queued, auditoria) +
       GET /api/control/pending (device token, entrega atomica, TTL 5 min)
     - models/ControlCommand.js: fila com TTL index (limpeza automatica)
     - firmware estufa45: poll HTTPS (WiFiClientSecure + CA da Vercel), handler
       dos atuadores espelha o callbackLocal; ThingSpeak e MQTT local intactos
     - server.js: cliente MQTT unico (elimina vazamento/corrida), espera de
       ligacao (2 s) e publish aguardado (elimina double-response);
       controlLimiter 30/min + graceful shutdown SIGINT/SIGTERM
     - control.js: timeout de fetch (AbortController) + 202 tratado como
       sucesso; removido o fallback WSS (mqtt.min.js -342 KB, ADR-0006 superado)
     - sw.js cache estufa-v10; admin.html com a nota da fila atualizada
docs: ADR-0007 (novo), ADR-0006 marcado como superado, indice ADR e
      BLUEPRINT 1.5.0 — Registro, Estado Atual, 1.4, 11.1.1, 11.2, bug #11
test: 50/50 node:test a passar (+8: contrato em lib/control + fila/pending)
`

### v1.4.3 (24/09/2026) - QR Aponta para o Download Direto do APK

`
fix(ui): QR code passa a apontar para o download direto do APK
     - index.html: APP_DOWNLOAD_URL -> releases/latest/download/estufa01.apk
       (o GitHub redireciona para o asset da ultima release com esse nome)
     - nota: o link so responde depois de publicar o APK numa release do repo
       (nome exato do ficheiro anexado: estufa01.apk)
     - sw.js cache estufa-v9
docs: BLUEPRINT 1.4.3 — Registro, Estado Atual, 2.2/2.4/2.5, 8.1
test: 38/38 node:test a passar
`

### v1.4.2 (24/09/2026) - Fix: Feedback Imediato nos Cards + QR Maior

`
fix(ui): status dos cards atualiza no clique + QR de download mais legivel
     - control.js: aplicarEstadoOtimista() — badge/chip muda logo apos comando
       aceite (vent/valve on-off; duty/ligada da luz); o ThingSpeak confirma ou
       corrige no ciclo seguinte (continua sem ack)
     - index.html: QR maior (180px, preto puro), zona de silencio maior e link
       clicavel de fallback sob o QR (mesma constante APP_DOWNLOAD_URL)
     - sw.js cache estufa-v8 (control.js + CSS atualizados)
docs: BLUEPRINT 1.4.2 — Registro, Estado Atual, 2.2/2.4/2.5, 8.1
test: 38/38 node:test a passar
`

### v1.4.1 (24/09/2026) - Cards v2: Halo Neon, Barras e Icones SVG

`
refactor(ui): aproxima os cards do mockup de referencia (Dark/Neon)
     - rim light neon no topo do card + halo radial no circulo do icone
     - icones em SVG line-art (currentColor, cor tema): ventilador gira, gota
       pinga, lampada pisca — emojis multicolor removidos dos cards
     - barras "equalizer" decorativas, animadas quando o atuador esta ligado
     - sw.js cache estufa-v7 (pre-cache do CSS atualizado)
docs: BLUEPRINT 1.4.1 — Registro, Estado Atual, 2.2/2.4/2.5, 6.2, 8.1
test: 38/38 node:test a passar
`

### v1.4.0 (24/09/2026) - Cards Dark/Neon + QR Code no Login

`
feat: refatora design dos cards para estilo neon e adiciona qr code no login
     - cards: fundo #1a1c23, borda tematica (14px), icone em circulo vazado com
       glow neon, titulo centrado na cor tema, badge de estado transparente
     - botoes ghost por funcao: Ligar/Abrir (verde), Desligar/Fechar (vermelho)
       e Auto (roxo); valvula volta a Aberta/Fechada; hint da luz alinhado
       entre dashboard e admin (ciclo circadiano do firmware)
     - index.html: bloco .app-download com QR de download do app
       (js/qrcode.min.js vendorizado, sem CDN; link configuravel no script)
     - sw.js cache estufa-v6 (pre-cache de qrcode.min.js)
docs: BLUEPRINT 1.4.0 — Registro, Estado Atual, 2.2/2.4/2.5, 6.1-6.2, 8.1
test: 38/38 node:test a passar
`

### v1.3.2 (24/09/2026) - Modo AUTO/MANUAL dos Atuadores + Visual Neon no Admin

`
feat(control): modo AUTO/MANUAL dos atuadores + visual neon no admin
     - server.js /api/control: action 'auto' -> {command:'AUTO'}; light aceita
       duty 0-100 (NaN -> VALIDATION 400) ou 'auto'; resposta inclui payload
     - control.js reescrito: so comando manual, credentials same-origin (cookie
       httpOnly, sem Bearer do localStorage), 401 -> redirect, 503 -> broker
       indisponivel, erros RFC 9457 (detail/title)
     - control.js: botoes on/off/auto em vent/valve + label de modo; luz com
       seletor AUTO/MANUAL e slider que publica so no change
     - admin.html/control.css: rotulos de hardware (Rele GPIO 26/27, LED
       WS2811), botao Auto, badge de modo, estados ativos por atuador
     - dashboard2.css: tema neon por atuador (--act-accent/--act-soft/--act-glow,
       --state-neon) + card com surface-solid
     - sensor.js: documenta mapeamento field1-8 (GPIOs); valvula Ligado/Desligado
fix(admin): repoe o cicloMonitorizar() da faixa ao vivo (guard sensor.js +
     DOMContentLoaded-safe) + corrige comentario do cabecalho que fechava o
     bloco em 'atuador/*/comando' (SyntaxError latente desde a reescrita);
     sw.js cache estufa-v5 (bug #12 fechado)
fix(ui): hint da iluminacao corrigido para o ciclo circadiano real (100/600
     lux eram thresholds de alerta do dashboard, nao do firmware)
chore(security): .gitignore cobre sketches .ino (firmware com credenciais)
docs: BLUEPRINT 1.3.2 — Registro, Estado Atual, 2.2/2.4/2.5, 6.2-6.3, 7.1-7.2, 8.1, 11.1.1, 16.2
test: 38/38 node:test a passar
`

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

- **Versao atual (v1.6.4):** Dashboard web com autenticacao, graficos ThingSpeak,
  **controlo de atuadores AUTO/MANUAL no painel de admin — tambem no site
  publicado (fila de comandos via Vercel + Upstash Redis, ADR-0007/0008)**,
  **cards Dark/Neon** e **QR de download do app na tela de login**; PWA, apps
  mobile (Android) e desktop (Electron/Windows).
- **Stack:** Node.js + Express + MongoDB (User/AccessLog) + Upstash Redis (fila de comandos) + HTML/CSS/JS vanilla + Chart.js + Service Worker + Capacitor + Electron + mqtt (broker local, opcional).
- **Deploy:** Vercel (serverless functions) com dominio customizado
  (**dashboardestufaiot-omega.vercel.app** — conta `deivisson1`, do autor da
  camada de hardware e dados; **nao** confundir com `dashboardestufaiot.vercel.app`,
  que e um projeto diferente noutra conta);
  **o controlo de atuadores funciona no site publicado** pela fila de comandos
  (`POST /api/control` → Upstash Redis → `GET /api/control/pending` pelo ESP32
  a cada 10 s).
- **Total de commits:** 58 commits (09/05/2026 - 25/09/2026).
- **Funcionalidades implementadas:**
  - Sistema de autenticacao JWT com cookies httpOnly + localStorage fallback
  - Dashboard com graficos em tempo real (ThingSpeak API) — **somente leitura**
  - **Controlo ativo de atuadores com modo AUTO/MANUAL** (ventilador e valvula
    ON/OFF/AUTO; iluminacao duty PWM 0-100 % ou AUTO) via `/api/control` —
    **disponivel no painel de admin tanto na rede local (MQTT) como no site
    publicado (fila Vercel + Upstash Redis, ADR-0007/0008)**
  - **Monitorizacao ao vivo no admin** (4 sensores + estado dos atuadores +
    status/RSSI), reutilizando `/js/sensor.js` (ciclo de `INTERVALO_S` s)
  - **QR Code de download do app na tela de login** (index.html; geracao local
    com `js/qrcode.min.js`, sem CDN; link configuravel no script)
  - Painel admin com logs de acesso e gerenciamento de usuarios
  - PWA com Service Worker v11 (cache limpo + network-first)
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
  - **Firmware ainda nao uploaded** (ESP32 sem porta serial). `API_VERCEL_TOKEN`
    **ja preenchido** em `src/main.cpp` (igual ao `DEVICE_TOKEN`) — build a passar.
  - **Falta o REST TOKEN do Upstash.** O endpoint
    `https://loyal-stag-44345.upstash.io` esta confirmado (responde), mas falta
    o token REST (o que comeca por `AX`, na seccao "REST API" do console). A
    password da ligacao TCP **nao serve**: o teste real devolveu
    `WRONGPASS invalid or missing auth token` (ver bug #12).
  - **`DEVICE_TOKEN` e a `REDIS_URL` por definir no ambiente da Vercel** — sem
    elas o poll responde 401 e a fila nao enfileira. O `.env` local ja tem os
    dois preenchidos, mas isso **nao** chega: as env vars da Vercel sao por
    ambiente e tem de ser configuradas la.
  - Firmware fora do versionamento — a pasta PlatformIO (`260929-*/`) passou a
    ser ignorada pelo Git, porque `src/main.cpp` tem WiFi/ThingSpeak/DEVICE_TOKEN
  - **Deploy do site (02/10/2026):** o projeto `dashboardestufaiot` foi criado na
    conta Vercel `deivisson1` (CLI `blecaute373`) e esta **no ar** em
    `https://dashboardestufaiot-omega.vercel.app` (alias de producao).
    **Env vars configuradas: 7/7** (`DEVICE_TOKEN`, `DEVICE_ID`, `JWT_SECRET`,
    `TS_CHANNEL`, `REDIS_URL`, `TS_API_KEY`, `MONGODB_URI`). O bug #13 fechou.
  - **A cadeia de controlo esta COMPLETA ponta-a-ponta (02/10/2026)** — do clique
    no painel ate ao comando sair da fila, tudo provado com **pedidos HTTP reais**
    no site publicado (nao por inspecao de codigo):
    `POST /api/auth/register` → **200** com `is_admin:true` (o 1.º registo nasce
    admin, `api/auth.js:45`) → `POST /api/auth/login` → **200** (antes **500**) →
    `GET /api/admin/users` → **200** com token e **401** sem token →
    `POST /api/control` → **202** → `GET /api/control/pending` com
    `X-Device-Token` → **200** com o **MESMO `id`** → 2.º poll → **`count:0`**
    (at-most-once). Ou seja: **o botao do rele ja e alcancavel por um humano**, e
    o comando chega ao outro lado intacto.
  - **Base de dados de producao (novo, ADR-0010):** cluster Atlas `Cluster63224`
    (MongoDB 8.0.34), base `estufa`, utilizador dedicado **`estufa_vercel`** com
    role **`readWrite@estufa`** — e nao `readWriteAnyDatabase`, porque a app so
    toca em `User` e `AccessLog` (least privilege, ENGENHARIA §9.2). O
    `0.0.0.0/0` da Access List e um **trade-off assumido**: as instancias
    serverless da Vercel saem de IPs dinamicos e nao sao allow-listaveis.
  - **Diagnostico da base: `npm run check:mongo`** — separa os quatro elos que
    falham em sitios diferentes (formato da URI offline, ping autenticado,
    leitura das colecoes reais, ESCRITA numa colecao descartavel) e imprime a
    URI sempre mascarada.
  - **Metodo que custou uma sessao (registado para nao repetir):** o MongoDB
    Atlas CLI **existe** nesta maquina
    (`C:\Program Files (x86)\MongoDB Atlas CLI\atlas.exe`) mas **nao esta no
    `PATH`** — `where.exe atlas` falha e `Test-Path $env:APPDATA\.atlas` da
    `False`, o que levou a concluir "nao ha CLI" quando o CLI estava
    **autenticado** e o cluster **ja existia**. *"Nao encontrei a ferramenta"* e
    *"a ferramenta nao existe"* sao conclusoes diferentes.
  - **A cadeia de comandos foi provada PONTA-A-PONTA no site publicado
    (02/10/2026), com pedidos reais** — nao por inspecao de codigo:
    `enfileirarComando()` → `GET /api/control/pending` devolveu o MESMO `id` e o
    mesmo payload (`{"command":"ON"}`); um segundo poll veio **vazio**
    (entrega at-most-once); e um comando expirado foi descartado (TTL logico
    de 5 min a funcionar). O acionamento manual esta operacional.
  - **`GET /api/thingspeak/last` passou a 200 com dados reais** (`27.40 °C`,
    umidade do ar `66.50`).
  - **Licao operacional do deploy:** todos os `vercel --prod` corriam bem no
    build mas ficavam **`Blocked`** — o processo do CLI era morto (por uma
    sessao/terminal novo) a meio de "Building…", e a Vercel nao conclui o
    deployment. O que funciona e **`vercel redeploy <url> --no-wait
    --non-interactive`**: a criacao acontece no servidor e o CLI devolve logo.
    Evita tambem o `--yes`, que o `redeploy` nao aceita.
  - **ATENCAO — dois projetos Vercel com o mesmo nome-base.** O dominio
    `dashboardestufaiot.vercel.app` esta **vivo noutra conta** (a do colega de
    TCC, onde o repo tem origem) e o firmware apontava para la. O firmware foi
    passado para o dominio desta conta (`...-omega`), porque foi **aqui** que as
    env vars ficaram. Os DOIS lados (painel e firmware) tem de apontar para o
    MESMO projeto: se o poll for para um projeto e a fila estiver no outro, o
    sintoma e o de sempre — 202 no painel e rele parado.
  - **Diagnostico da cadeia: `npm run check:control`** — verifica os 4 elos
    (REDIS_URL com round-trip real ao Upstash, DEVICE_TOKEN, token do firmware
    vs DEVICE_TOKEN, e a heuristica "parece token do Upstash")
  - Botao "verificar broker" inexistente no caminho **local** (a indisponibilidade
    do broker so aparece apos clique, 502) — no caminho publicado este problema
    deixou de existir (fila na nuvem, ADR-0007)

- _Ultima atualizacao: 02/10/2026_

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
11. ~~**Controlo de atuadores so local.**~~ **RESOLVIDO na v1.5.0 (ADR-0007).**
    `/api/control` deixou de devolver 503 no deploy Vercel: o comando e
    enfileirado e recolhido pelo firmware em `GET /api/control/pending`.
    Requisito de Operacao: `DEVICE_TOKEN` tem de existir como Environment
    Variable na Vercel **e** estar igual no firmware (`API_VERCEL_TOKEN`) — sem
    isso o endpoint responde 401 (fail-closed) e nenhum comando e aplicado.
    Latencia de ate ~10 s por desenho (era ~5 s; ver ADR-0008).
12. **Fila de comandos exige `REDIS_URL` na Vercel (ADR-0008).** E uma variavel
    so, com endpoint + token: `https://SEU-ENDPOINT.upstash.io/?_token=SEU_TOKEN`.
    Sem ela, `lib/store.js` falha com mensagem explicita (fail-fast, sem
    fallback) e `POST /api/control` devolve 500. Criar a base gratuita em
    https://console.upstash.com. O token **nao** vai para o firmware.
    **Duas armadilhas confirmadas em campo (02/10/2026):**
    - o **endpoint sozinho nao serve** — `lib/config.js` falha logo com
      "REDIS_URL sem token" (o token tem de estar na propria string);
    - o token tem de ser o **REST token** (comeca por `AX`, na seccao "REST API"
      do console). A **password da ligacao TCP** (string mais curta, tipo
      `0ic14fz...`) passa a validacao sintactica mas o Upstash responde
      **`WRONGPASS invalid or missing auth token`** no primeiro comando real.
    Verificar os dois casos com **`npm run check:control`** (faz um round-trip
    real: `SET`/`GET`/`DEL` de uma chave de diagnostico).

13. ~~**`MONGODB_URI` por definir no projeto Vercel.**~~ **RESOLVIDO em 02/10/2026
    (ADR-0010).** Era o ultimo elo em falta: com **6 das 7** variaveis
    configuradas, o mongoose tentava `mongodb://localhost:27017/estufa` (que nao
    existe na Vercel) e o `POST /api/auth/login` devolvia **500** — comprovado com
    pedido real. Sem login nao se chegava ao painel de admin, portanto **o botao
    que aciona o rele nao ficava acessivel por um humano**, mesmo com a fila a
    funcionar. Esse era o modo de falha mais enganador do projeto: a parte dificil
    (fila, polling, at-most-once) estava provada, e o que faltava era configuracao.

    **O que ficou registado como metodo** (porque custou uma sessao inteira):

    - **A credencial antiga era irrecuperavel.** Foi procurada no historico
      completo do Git (`git log --all -S 'mongodb+srv'`, 4 commits) e em todos os
      artefactos de auditoria do repo: so restam placeholders. A v1.1.0 removeu o
      segredo real e o Git nao o devolve. Alem disso, **o Atlas nunca devolve uma
      password existente** — e por desenho, nao por limitacao do CLI.
    - **O cluster ja existia.** O MongoDB Atlas CLI **estava instalado e
      autenticado** nesta maquina
      (`C:\Program Files (x86)\MongoDB Atlas CLI\atlas.exe`), mas **nao esta no
      `PATH`**: `where.exe atlas` falha e `Test-Path $env:APPDATA\.atlas` da
      `False`. A conclusao a que isso levou — *"nao ha CLI, logo nao da para
      gerir"* — estava errada. *"Nao encontrei a ferramenta"* e *"a ferramenta
      nao existe"* sao conclusoes diferentes.
    - **Decisao de menor privilegio (§9.2):** em vez de repor a password do
      `estufa_app` existente (role `readWriteAnyDatabase`), foi criado
      **`estufa_vercel`** com **`readWrite@estufa`** — a app so toca em `User` e
      `AccessLog`. Nao se corrigiu o sintoma mantendo o privilegio a mais.
    - **O `0.0.0.0/0` da Access List fica** (trade-off assumido): as instancias
      serverless da Vercel saem de IPs dinamicos da AWS e nao sao
      allow-listaveis de forma estavel. A defesa passa a ser a password SCRAM +
      o facto de a credencial viver so nas env vars da Vercel.

    | Var. | Estado medido em 02/10 |
    |---|---|
    | `DEVICE_TOKEN` | OK — `GET /pending` com o token do firmware → 200 |
    | `REDIS_URL` | OK — fila enfileira e entrega (prova ponta-a-ponta) |
    | `JWT_SECRET` | OK — sem ela `lib/config.js` lanca e a app toda dava 500 |
    | `TS_CHANNEL` | OK |
    | `TS_API_KEY` | OK — `/api/thingspeak/last` → 200 com dados reais |
    | `DEVICE_ID` | OK (`estufa01`) |
    | `MONGODB_URI` | **OK** — `POST /api/auth/login` → **200** (era 500) |

    Como foi fechado (02/10/2026):
    `vercel env add MONGODB_URI production --value "<srv do Atlas>" --sensitive --yes`
    seguido de `vercel redeploy <url> --no-wait --non-interactive` — o `--value`
    evita o prompt interativo, que nao funciona em execucao nao assistida.

    > **Armadilha dos dois projetos:** o dominio
    > `dashboardestufaiot.vercel.app` esta vivo **noutra conta** (do colega de
    > TCC). Este deploy usa `-omega` e o firmware foi apontado para la. Painel e
    > firmware tem de apontar para o MESMO projeto, senao o poll vai buscar a
    > fila de um lado e os comandos ficam no outro.

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
| **Service Worker** | Cache offline, PWA install | sw.js v9 |
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
| PWA | **Service Worker v9** | Offline, instalavel, network-first |
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
|   |   |-- control.js         # comando manual on/off/auto + luz auto/manual (admin)
|   |-- script.js              # Logica dashboard (graficos, alertas, CSV)
|   |-- pwa.js                 # Registro Service Worker
|   |-- sw.js                  # Service Worker v9 (cache modular + network-first)
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
|-- legacy/                    # Versao original ("as is") do dashboard — registro de proveniencia (nao e runtime)
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
| Login unificado | index.html | Entrar/Registrar + QR de download do app |
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
- **dashboard2.css**: cards Dark/Neon (fundo `#1a1c23`, borda tematica 14px,
  rim light no topo, icone SVG em circulo com halo neon, barras equalizer
  animadas, titulo na cor tema, chips transparentes) + `.act-gpio` e `.act-mode`
- **control.css**: botoes ghost por funcao (`.ctrl-on` verde / `.ctrl-off`
  vermelho / `.ctrl-auto` roxo), `.ctrl-slider`, `.ctrl-status-msg`, `.live-strip`
  — carregado **apenas** pelo admin
- **auth2.css**: campos, mensagens e `.app-download` (QR de download no login)

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

**`public/js/control.js`** (apenas admin) — v1.3.2: so comando manual; o browser
nunca fala com o broker MQTT (quem publica e o `server.js`):

| Funcao | Descricao |
| ------ | --------- |
| enviarComando(actuator, action) | POST /api/control com cookie httpOnly (`credentials: same-origin`); 401 -> redirect, 503 -> broker indisponivel, erros RFC 9457 |
| setBotoesDisabled(actuator, disabled) | Desativa/reativa botoes e slider do atuador durante o envio (anti-duplo-clique) |
| apiErrorMessage(payload, fallback) | Extrai `detail`/`title` (RFC 9457) com fallback legado `error` |
| mostrarStatus(msg, tipo) | Feedback em `#ctrlStatusMsg` (classe `.warn`), auto-hide 3.5s |
| marcarModo(actuator, modo) | Atualiza o label "Modo: Auto/Manual" (`modeVent`/`modeValve`/`modeLight`) |
| setLightMode(modo) | Alterna AUTO/MANUAL da iluminacao (`.is-active` nos botoes, slider desabilitado em AUTO) |
| cicloMonitorizar() | Polling do feed (`buscarUltimo()` de `/js/sensor.js`) para a faixa ao vivo; guard se sensor.js ausente |
| iniciarControlo() | Arranca o ciclo (chamada imediata + `setInterval` de `INTERVALO_S`), DOMContentLoaded-safe |

> **Nota (v1.3.2):** `cicloMonitorizar()` / `iniciarControlo()` (fim do ficheiro)
> fazem o polling do feed a cada `INTERVALO_S`, com guard para `sensor.js` ausente
> e arranque DOMContentLoaded-safe — repostos na correcao do bug #12. Aviso: o
> cabecalho evita de proposito a sequencia que fecha comentario (`atuador/*/comando`
> chegou a quebrar o ficheiro com SyntaxError — usa-se `atuador/<id>/comando`).


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
  ultima leitura, RSSI e estado dos atuadores (via `/js/sensor.js`, refrescada
  pelo `cicloMonitorizar()` do control.js a cada `INTERVALO_S`)
- **Controlo de Atuadores**: cards com botoes ON/OFF/AUTO (ventilador, valvula),
  seletor AUTO/MANUAL + slider PWM 0-100 % (iluminacao), rotulos de hardware
  (Rele GPIO 26/27, LED WS2811), badge de modo (`.act-mode`) e mensagem de
  feedback (`.ctrl-status-msg`)

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
`processarUltimo()`, `atualizarAtuador()`, `enviarComando()`, `marcarModo()`,
`setLightMode()`, `cicloMonitorizar()`.


---

## 8. PWA e Service Worker

### 8.1 Service Worker v11 (sw.js)

- **Cache:** `estufa-v11` (versionado — `activate` apaga versoes antigas)
- **Pre-cache (ASSETS):** CSS modular (10 folhas, incl. control.css), scripts
  (`/script.js`, `/js/theme.js`, `/js/sensor.js`, `/js/control.js`,
  `/js/qrcode.min.js`, `/pwa.js`),
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
| MONGODB_URI | URI de conexao MongoDB Atlas (User + AccessLog) | Sim |
| → detalhe | cluster `Cluster63224`, base `estufa`, utilizador **`estufa_vercel`** com role **`readWrite@estufa`** (nao `readWriteAnyDatabase` — least privilege, §9.2). Diagnostico: `npm run check:mongo`. Ver ADR-0010 | — |
| REDIS_URL | Upstash Redis numa string so (endpoint + token) — fila de comandos | Sim (producao) |
| DEVICE_TOKEN | Token que o ESP32 envia em `X-Device-Token` (comparado em tempo constante) | Sim (producao) |
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
  Desde a v1.3.2 autentica-se apenas com o cookie httpOnly (`credentials:
  same-origin`); o envio do token `Authorization: Bearer` foi removido.
- **Servidor local (`server.js`):** rota real, protegida por `requireAuthApi`,
  valida `actuator` (`vent|valve|light`) e `action` (`on|off|auto`; em `light`
  tambem um numero 0-100 como duty — NaN devolve VALIDATION/400), publica JSON
  no broker MQTT, regista auditoria (`control_<actuator>`) no AccessLog e
  responde `{ ok, actuator, action, payload }`.
- **Vercel (`api/control.js`):** `requireAdminApi` + `controlLimiter` (30/min),
  valida com o mesmo contrato (`lib/control.js`), enfileira o comando no
  **Upstash Redis** (`LPUSH` + `EXPIRE 300`, chave `estufa:comandos:<device>`) e
  responde **`202 {queued:true, id, expires_at}`** — aceite, ainda nao aplicado.
  Regista auditoria (`control_<actuator>`) no AccessLog, mas **depois** de o
  comando ja estar na fila e em modo best-effort (§13): uma falha do Atlas nao
  bloqueia o controlo (bolkhead §11.3).
  O **ESP32 e quem busca**: `GET /api/control/pending` com `X-Device-Token`
  comparado em tempo constante, devolve ate 10 comandos e faz `LPOP` (atomico —
  fecha a corrida `find`/`updateMany` do ADR-0007). Comando nunca recolhido
  expira aos 5 min. Latencia ate ~10 s. Ver ADR-0008.
  Sem `DEVICE_TOKEN` na Vercel ⇒ 401 *fail-closed*; sem as duas
  `REDIS_URL` ausente ⇒ 500 com mensagem explicita (fail-fast).
- **Topicos MQTT:** `fazenda/estufa01/atuador/vent_001|valv_001|ilum_001/comando`
  payloads `{"command":"ON"|"OFF"|"AUTO"}` (vent/valv) e `{"duty":0-100}` ou
  `{"command":"AUTO"}` (ilum).
- **Modo AUTO:** a decisao fica no firmware (o backend so reencaminha o comando);
  os limites praticos — vent liga >= 30 C / desliga <= 26 C; valvula abre <= 40 %
  / fecha >= 70 %; luz segue o ciclo circadiano do firmware (fotoperiodo, com
  atenuacao por luz natural medida em janela de blackout — apaga >= 5000 lux).
  A UI mostra "Modo: Auto/Manual" (atualizado no clique, sem ack).
- **Sem ack:** a API confirma apenas a **aceitacao** do comando (no caminho local,
  a publicacao no broker; na nuvem, a entrada na fila). O estado real regressa
  depois pelo ThingSpeak (field5-8) e e refletido nos cards quando o feed e
  atualizado (no admin, a cada `INTERVALO_S` via cicloMonitorizar).


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

### 12.4 check-control-chain.js (diagnóstico da cadeia de comandos)

- Verifica os QUATRO elos do acionamento manual (ADR-0007/0008), que falham em
  sitios diferentes e produzem o MESMO sintoma ("o rele nao reage ao clique"):
  `REDIS_URL` (com round-trip real ao Upstash), `DEVICE_TOKEN` na Vercel, o token
  no firmware vs o da Vercel, e a heuristica "parece token do Upstash"
- **Uso:** `npm run check:control`
- **Fora do `npm run check`**: precisa de rede e credenciais reais, enquanto
  `check`/`test` sao hermeticos por desenho (§5.2)

### 12.5 check-mongo.js (diagnóstico da base de dados)

- Verifica os quatro elos da ligacao ao Atlas: **formato** da URI (offline,
  detecta placeholders, base ausente no caminho — que faria o Mongoose usar
  `test` sem avisar — e credenciais mal escapadas), **ping** autenticado,
  **leitura** das colecoes reais (`users`, `accesslogs`) e **escrita** numa
  colecao descartavel
- **Uso:** `npm run check:mongo`
- Existe porque o modo de falha era ambiguo: sem `MONGODB_URI` o
  `POST /api/auth/login` devolve 500, indistinguivel de JWT errado ou Redis em
  baixo (bug #13 / ADR-0010)
- Imprime a URI **sempre mascarada** (`mascararUri()`): um diagnostico que loga a
  URI inteira e ele proprio o incidente — ela da acesso total a base
- Le `.env` e `.env.local` (o CLI da Vercel escreve o segundo)
- **Fora do `npm run check`**, pela mesma razao de 12.4

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
- [x] MongoDB Atlas com IP whitelist — **parcial, por desenho (ADR-0010)**: a
      Access List tem `0.0.0.0/0` porque as funcoes serverless da Vercel saem de
      IPs dinamicos da AWS e nao sao allow-listaveis de forma estavel. O que
      compensa: password SCRAM forte, utilizador de BD dedicado com
      `readWrite@estufa` (nao `readWriteAnyDatabase`), e a credencial a viver so
      nas env vars da Vercel
- [x] `npm run check:mongo` valida formato + ping + leitura + escrita sem expor
      a URI (ADR-0010)
- [x] Service Worker com cache seguro
- [x] Electron com nodeIntegration=false
- [ ] Dependencias auditadas (npm audit)
- [x] `/api/control` protegida por `requireAdminApi` + `controlLimiter` (30/min)
      + `deviceLimiter` (60/min) no poll, e auditoria no AccessLog
      (ver Secao 11.1.1)
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
| DEVICE_TOKEN | Vercel env vars **e** `main.cpp` (obrigatorio: e o unico segredo que o firmware conhece) | ✅ Seguro |
| REDIS_URL | **So** Vercel env vars (endpoint + token) — nunca no firmware, nunca no browser | ✅ Seguro |

**Regras de Seguranca:**
- Nunca commitar arquivos `.env` ou `.jwt_secret`
- `.env.example` deve conter apenas placeholders, nunca valores reais
- JWT_SECRET e gerado dinamicamente se nao definido (64 bytes aleatorios)
- Channel ID e API Key devem ser definidos via variaveis de ambiente
- `DEVICE_TOKEN` vazio ⇒ *fail-closed*: o poll devolve 401 e nenhum comando
  chega ao atuador
- `REDIS_URL` nunca entra no firmware: o ESP32 so conhece o
  URL publico da Vercel e o `DEVICE_TOKEN`
- **A credencial da base de dados tem o ambito minimo** (`readWrite@estufa`,
  ADR-0010) — nao `readWriteAnyDatabase`. A app so toca em `User` e `AccessLog`;
  um utilizador com escrita em *qualquer* base do cluster nao da nada em troca
  (§9.2, *least privilege*)
- `MONGODB_URI` nunca e impressa em diagnostico ou log: `npm run check:mongo`
  passa-a sempre por `mascararUri()` (§14.3)

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

Ha **dois caminhos de entrega** e o que muda e so o transporte — o contrato
`(actuator, action) -> payload` e o mesmo nos dois (`lib/control.js`, fonte
unica):

- **Rede local** (`server.js`): o painel de admin (`admin.html`, autenticado)
  envia `POST /api/control` via `public/js/control.js` -> o `server.js` publica
  no broker MQTT -> o ESP32, ja subscrito em
  `fazenda/estufa01/atuador/*/comando`, aciona o rele/PWM de imediato.
- **Site publicado** (Vercel, ADR-0007/0008): o mesmo `POST /api/control` nao
  alcanca a LAN, por isso **o sentido do comando e invertido** — o comando e
  enfileirado no Upstash Redis e e o **ESP32 que o busca** em
  `GET /api/control/pending` a cada 10 s. Latencia ate ~10 s (sem servico nem
  processo na rede local).

O dashboard publico **nao** tem botoes de comando. Alem do manual (ON/OFF e
duty), vent/valv/luz aceitam o modo **AUTO** (`action: "auto"` ->
`{"command":"AUTO"}`), com o firmware a decidir pelos thresholds (ver Secao
11.1.1).

**Como sei o estado real apos enviar um comando?**
A API nao devolve ack do ESP32: confirma apenas a publicacao no broker. O estado
real chega pelo ThingSpeak (field5-8) no ciclo de monitorizacao seguinte
(`INTERVALO_S`), atualizando os cards de atuadores no dashboard e no admin
(no admin, o ciclo roda via `cicloMonitorizar()` do control.js).


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
|-- legacy/                  # Versao original ("as is") — proveniencia
|-- README-APPS.md           # Documentacao de apps mobile/desktop
`

---

**Fim do Blueprint Estufa 01 v1.4.0**

