# 👥 Contribuidores — Estufa 01

Este projeto de TCC foi desenvolvido em **co-autoria**. Este ficheiro regista a
repartição das contribuições de forma explícita, para que nenhum crédito seja
implicitamente transferido de uma pessoa para outra.

## Autores

### Deivisson Lino Campos dos Santos Junior — co-autor
- GitHub: [@blecaute373](https://github.com/blecaute373)
- Fork: [blecaute373/Estufa-Dashboard-TCC](https://github.com/blecaute373/Estufa-Dashboard-TCC) (remote `mine`)
- **Origem do sistema (camada de hardware e de dados):**
  - **Firmware ESP32 em C++** — autor do código do dispositivo
    (`sketch_apr13a.ino` → hoje `260929-*/src/main.cpp`), incluindo a
    **integração com a API do ThingSpeak no próprio firmware** (publicação da
    telemetria e mapeamento de `field1`–`field8`).
  - **Versão original "as is" do dashboard** — um único ficheiro HTML com CSS,
    JavaScript e o consumo do ThingSpeak **tudo junto**, já **calibrada para o
    hardware real**, mas **sem ocultar as chaves de API** (elas estavam embutidas
    no HTML). Preservada em [`legacy/dashboard_estufa_original.html`](legacy/README.md)
    como registro de proveniência; é dela que saíram as constantes de calibração
    hoje documentadas como "thresholds do firmware" (BLUEPRINT §11.1.1).
  - **Stack de dados e visualização: Node-RED + InfluxDB + Grafana** — a
    infraestrutura de aquisição, série temporal e painéis operacionais.
- **Contribuição no sistema web atual:**

  - **Fila de comandos em Upstash Redis** (ADR-0008) — migração da fila do
    MongoDB para o Upstash, com `REDIS_URL` numa única string e garantia de
    entrega *at-most-once* pelo lado do dispositivo.
  - **Controlo remoto do atuador (relé) fim-a-fim** — diagnóstico da cadeia
    completa painel → `/api/control` → fila → firmware → relé; identificação da
    causa-raiz (token vazio compilava sem aviso e o painel dizia "enfileirado
    OK" enquanto o relé nunca se movia).
  - **Firmware ESP32** (`260929-*/src/main.cpp`) — injeção do token via
    `include/secrets.h` (gitignored) + `secrets.h.example` versionado, com
    heurística de runtime `tokenPareceUpstash()` e avisos acionáveis na porta
    série.
  - **MongoDB Atlas em produção** (ADR-0010) — utilizador de BD com privilégio
    mínimo (`readWrite@estufa`, em vez de `readWriteAnyDatabase`), diagnóstico
    do *fail-fast* que derrubava o `POST /api/auth/login` com 500.
  - **App partilhada dev/prod** (ADR-0009) e cache de leitura com TTL.
  - **Scripts de diagnóstico** `scripts/check-control-chain.js`
    (`npm run check:control`) e `scripts/check-mongo.js`
    (`npm run check:mongo`), sempre com segredos mascarados.
  - **Deploy em produção** na Vercel (conta `deivisson1`), as 7 variáveis de
    ambiente configuradas e a cadeia de controlo verificada por pedidos HTTP
    reais.

### Matheus Garbin — autor do sistema web
- GitHub: [@matheusbritogarbin-byte](https://github.com/matheusbritogarbin-byte)
- E-mail: matheusbritogarbin@gmail.com
- **Contribuição:** partindo da versão "as is", **formatou e reorganizou** o
  projeto na arquitetura em camadas que se mantém até hoje (CSS/JS separados,
  backend em `api/`, biblioteca `lib/` partilhada entre dev e produção —
  ADR-0001/0003), **incorporou o sistema de login e autenticação** (JWT
  httpOnly, fail-fast, bcrypt, rate limiting — ADR-0002), criou o **painel de
  admin** com logs e gestão de utilizadores, e conduziu as correções
  documentadas do projeto (erros RFC 9457, ADR-0004; proxy ThingSpeak
  resiliente, ADR-0005; controlo remoto MQTT/WSS, ADR-0006; primeira fila de
  comandos na Vercel, ADR-0007; apps mobile em Capacitor e desktop em Electron;
  PWA; deploy Vercel). É o autor de **todos os commits registrados no histórico
  Git** do repositório, de v0.1.0 a v1.6.1.

## Nota sobre o histórico Git e a proveniência

**Todo o histórico de commits do repositório foi produzido por Matheus Garbin**,
sob os identificadores `Matheus Garbin <anonymous070508@gmail.com>`,
`anonymous070508-crypto <anonymous070508@gmail.com>` e `Matheus Garbin
<matheusbritogarbin@gmail.com>`. Esses registos **não foram reescritos nem
reatribuídos**.

Isso é esperado, e não contradiz a co-autoria registrada acima: a camada de
origem do projeto (firmware ESP32, integração ThingSpeak, dashboard "as is" e a
stack Node-RED/InfluxDB/Grafana) **existia antes de passar pelo Git**. Quando o
projeto entrou no repositório, já tinha sido reformatado e ganhado o sistema de
login — o primeiro commit é literalmente `Tira o numero thinkspeak`, ou seja, o
próprio ato de sanitizar a versão original para poder publicá-la (`v0.1.0`,
09/05/2026). **Artefato fora do Git não aparece no `git log`** — é por isso que a
proveniência é registrada aqui e corroborada pelo ficheiro preservado em
`legacy/`, e não pelo histórico de commits.

| Camada | Autor | Como é verificável |
|---|---|---|
| Firmware ESP32 (C++), integração ThingSpeak no firmware | **Deivisson** | `legacy/dashboard_estufa_original.html` linha 740 referencia `sketch_apr13a.ino` e replica os seis thresholds do firmware — batem com o BLUEPRINT §11.1.1 |
| Dashboard original "as is", calibrado | **Deivisson** | `legacy/dashboard_estufa_original.html` (monolítico, chave de API embutida) |
| Stack de dados: Node-RED + InfluxDB + Grafana | **Deivisson** | não versionada neste repositório (infraestrutura separada) |
| Reestruturação em camadas, login/JWT, painel admin, apps, deploy | **Matheus** | `git log` completo, v0.1.0 → v1.6.1 |
| Fila Upstash Redis (ADR-0008), Atlas em produção (ADR-0010), firmware com token injetado, scripts de diagnóstico | **Deivisson** | commits `59a2aa9`, `3cb9b9a`, `d88a8b0`, `cc21af8` + ADRs 0008/0009/0010 |

A co-autoria de Deivisson no **sistema web** está registrada desde a v1.6.2, pelos
commits que efetivamente realizou. A sua autoria da **camada de origem** está
registrada neste ficheiro e no artefato preservado — o formato que a evidência
disponível permite, sem reescrever o passado de ninguém.
