# 👥 Contribuidores — Estufa 01

Este projeto de TCC foi desenvolvido em **co-autoria**. Este ficheiro regista a
repartição das contribuições por camada, para que o trabalho de cada pessoa
fique claro e corretamente atribuído.

## Resumo

| Camada | Autor |
|---|---|
| Firmware ESP32 (C++) e integração ThingSpeak no firmware | Deivisson |
| Dashboard original "as is", calibrado para o hardware | Deivisson |
| Stack de dados: Node-RED + InfluxDB + Grafana | Deivisson |
| Reestruturação do dashboard em camadas (frontend, `api/`, `lib/`) | Matheus |
| **Sistema de login e credenciamento** (JWT, bcrypt, rate limiting) | Matheus |
| Painel de administração (logs e gestão de utilizadores) | Matheus |
| **Escolha da Vercel como plataforma de hospedagem** e primeiro deploy | Matheus |
| Apps mobile (Capacitor) e desktop (Electron), PWA | Matheus |
| Fila de comandos em Upstash Redis, controlo remoto do relé fim-a-fim, MongoDB Atlas em produção, scripts de diagnóstico | Deivisson |

A base do sistema web — arquitetura, autenticação, painel, apps e a decisão de
hospedagem — é de Matheus. Deivisson é o autor da camada de hardware e dados e
co-autor do sistema web a partir da v1.6.2, com as contribuições listadas abaixo.

## Autores

### Matheus Garbin — autor do sistema web
- GitHub: [@matheusbritogarbin-byte](https://github.com/matheusbritogarbin-byte)
- **Contribuição:** partindo da versão "as is", **formatou e reorganizou** o
  projeto na arquitetura em camadas que se mantém até hoje (CSS/JS separados,
  backend em `api/`, biblioteca `lib/` partilhada entre dev e produção —
  ADR-0001/0003).
- **Sistema de login e credenciamento:** concebeu e implementou a autenticação
  do sistema (JWT httpOnly, *fail-fast*, bcrypt, rate limiting — ADR-0002) e o
  **painel de admin** com logs e gestão de utilizadores.
- **Hospedagem na Vercel:** teve a ideia de hospedar o sistema na Vercel e
  conduziu o primeiro deploy, que tornou o painel acessível online e abriu o
  caminho para a fila de comandos na nuvem (ADR-0007).
- **Correções e evolução documentadas:** erros RFC 9457 (ADR-0004); proxy
  ThingSpeak resiliente (ADR-0005); controlo remoto MQTT/WSS (ADR-0006); primeira
  fila de comandos na Vercel (ADR-0007); apps mobile em Capacitor e desktop em
  Electron; PWA.
- É o autor de **todos os commits do histórico Git de v0.1.0 a v1.6.1**.

### Deivisson Lino Campos dos Santos Junior — autor da camada de hardware e dados e co-autor do sistema web
- GitHub: [@blecaute373](https://github.com/blecaute373)
- **Camada de hardware e de dados:**
  - **Firmware ESP32 em C++** — autor do código do dispositivo
    (`sketch_apr13a.ino` → hoje `260929-*/src/main.cpp`), incluindo a
    **integração com a API do ThingSpeak no próprio firmware** (publicação da
    telemetria e mapeamento de `field1`–`field8`).
  - **Versão original "as is" do dashboard** — um único ficheiro HTML com CSS,
    JavaScript e o consumo do ThingSpeak juntos, já calibrada para o hardware
    real, mas com as chaves de API embutidas no HTML. Preservada em
    [`legacy/dashboard_estufa_original.html`](legacy/README.md) como registo de
    proveniência; dela saíram as constantes de calibração hoje documentadas como
    "thresholds do firmware" (BLUEPRINT §11.1.1).
  - **Stack de dados e visualização: Node-RED + InfluxDB + Grafana** —
    aquisição, série temporal e painéis operacionais (infraestrutura separada,
    não versionada neste repositório).
- **Contribuição no sistema web (a partir da v1.6.2):**
  - **Fila de comandos em Upstash Redis** (ADR-0008) — migração da fila do
    MongoDB para o Upstash, com `REDIS_URL` numa única string e entrega
    *at-most-once* pelo lado do dispositivo.
  - **Controlo remoto do atuador (relé) fim-a-fim** — diagnóstico da cadeia
    painel → `/api/control` → fila → firmware → relé, e identificação da
    causa-raiz (token vazio compilava sem aviso e o painel dizia "enfileirado
    OK" enquanto o relé nunca se movia).
  - **Firmware:** injeção do token via `include/secrets.h` (ignorado pelo Git) +
    `secrets.h.example` versionado, com a heurística `tokenPareceUpstash()` e
    avisos acionáveis na porta série.
  - **MongoDB Atlas em produção** (ADR-0010) — utilizador de BD com privilégio
    mínimo (`readWrite@estufa`), e diagnóstico do *fail-fast* que derrubava o
    `POST /api/auth/login` com 500.
  - **App partilhada dev/prod** (ADR-0009) e cache de leitura com TTL.
  - **Scripts de diagnóstico** `scripts/check-control-chain.js`
    (`npm run check:control`) e `scripts/check-mongo.js`
    (`npm run check:mongo`), sempre com segredos mascarados.
  - **Configuração do ambiente de produção** na conta Vercel `deivisson1`
    (7 variáveis de ambiente) e verificação da cadeia de controlo por pedidos
    HTTP reais. A plataforma foi escolhida por Matheus; aqui registam-se a
    configuração e a verificação dessa implantação.

## Nota sobre o histórico Git e a proveniência

Os commits de **v0.1.0 a v1.6.1** foram todos produzidos por Matheus Garbin e
**não foram reescritos nem reatribuídos**. A partir da v1.6.2 há também commits de
Deivisson (por exemplo `59a2aa9`, `3cb9b9a`, `d88a8b0`, `cc21af8`).

Isto é esperado e não contradiz a co-autoria registada acima: a camada de
hardware e dados (firmware ESP32, integração ThingSpeak, dashboard "as is" e a
stack Node-RED/InfluxDB/Grafana) **existia antes de entrar no Git**. Quando o
projeto passou a ser versionado, já tinha sido reformatado e ganho o sistema de
login; o primeiro commit (`Tira o numero thinkspeak`, v0.1.0, 09/05/2026) é a
sanitização da versão original para poder publicá-la. Artefacto produzido fora do
Git não aparece no `git log`, por isso a sua proveniência é registada aqui e
corroborada pelo ficheiro preservado em `legacy/`.

O código do firmware encontra-se, por agora, fora do versionamento deste
repositório, por conter configuração sensível de rede.

| Camada | Autor | Como é verificável |
|---|---|---|
| Firmware ESP32 (C++), integração ThingSpeak no firmware | Deivisson | `legacy/dashboard_estufa_original.html` (linha 740) referencia `sketch_apr13a.ino` e replica os seis thresholds do firmware, que coincidem com o BLUEPRINT §11.1.1 |
| Dashboard original "as is", calibrado | Deivisson | `legacy/dashboard_estufa_original.html` |
| Stack de dados: Node-RED + InfluxDB + Grafana | Deivisson | Infraestrutura separada, não versionada neste repositório |
| Reestruturação em camadas, login e credenciamento, painel admin, apps, escolha da Vercel e primeiro deploy | Matheus | `git log` completo, v0.1.0 → v1.6.1 |
| Fila Upstash Redis (ADR-0008), Atlas em produção (ADR-0010), firmware com token injetado, scripts de diagnóstico | Deivisson | Commits `59a2aa9`, `3cb9b9a`, `d88a8b0`, `cc21af8` e ADRs 0008/0009/0010 |