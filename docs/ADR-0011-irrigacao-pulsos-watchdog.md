# ADR-0011 — Irrigação em pulsos com watchdog (bomba submersa AC)

- **Status:** aceite
- **Data:** 2026-10-08
- **Contexto:** o atuador de irrigação (GPIO27) deixou de ser uma válvula solenoide e passou a ser uma **bomba submersa AC (Durapets 3 W, 180 L/h)** acionada pelo mesmo relé — agora na **fase**, não no neutro, com reservatório próprio e boia de nível no GPIO25. Ao contrário da válvula (inócua se ficar aberta), a bomba AC tem duas restrições físicas novas: **queima a seco** (precisa de proteção a nível obrigatória) e **esvazia o reservatório** se ficar ligada tempo demais. O controlo antigo era uma **histerese contínua 40 %→70 %** no sensor capacitivo de solo: abria a válvula e só fechava aos 70 %. Com uma bomba isso é insustentável — o sensor capacitivo é lento (a água leva minutos a infiltrar até ele "sentir"), então a histerese mantém a bomba ligada muito além do necessário, super-regando e secando o reservatório.

## Decisão

Substituir a histerese contínua por **irrigação em pulsos com várias camadas de segurança**, mantendo os identificadores públicos (`valv_001`, `"valve"`, field6) para não quebrar o dashboard/Node-RED:

1. **Pulsos + espera (A3):** liga a bomba por `BOMBA_PULSO_MS` (6 s, ~0,3 L na vazão máxima), desliga e espera `BOMBA_ESPERA_MS` (5 min) antes de reavaliar — tempo para a água infiltrar e o sensor capacitivo sentir. O pulso também termina antes se o solo já chegou a `UMID_SOLO_LIMITE_SUPERIOR`.
2. **Limite diário (`BOMBA_MAX_PULSOS_DIA = 12`):** ~3,6 L/dia no máximo; o contador zera por dia do ano (`tm_yday` via NTP), com **fallback em `millis()`** (subtração sem sinal ≥ 24 h) quando não há internet.
3. **Ponto único de acionamento (`bombaDefinir(bool)`, A1):** todo caminho (automático, MQTT, fila da Vercel, PAUSE) passa por ela. Recusa ligar sem água no reservatório.
4. **Boia de nível (A2, GPIO25) — SUPERADO pela emenda v1.8.2:** `INPUT_PULLUP`, `LOW` = há água; sem boia (pino solto) o pull-up lê HIGH = sem água e a bomba fica **bloqueada** (fail-safe a seco). Constante `BOIA_COM_AGUA_NIVEL` permite inverter a lógica numa linha.
5. **Watchdog de tempo (`bombaWatchdog()`, A4):** corre **sempre** no início de `avaliarControle()` — antes do `return` da pausa global, inclusive em modo manual — e desliga a bomba se passar de `BOMBA_MAX_ON_MS` (12 s) ou se faltar água persistente. Teto garantido maior que o pulso via `static_assert`.
6. **Debounce da boia (`NIVEL_DEBOUNCE_MS = 1 s`) — SUPERADO pela emenda v1.8.2:** durante o bombeamento a água balança e a boia pode abrir por um instante; só corta por falta d'água se persistir 1 s. Para **ligar**, o bloqueio é imediato. O corte por tempo nunca é atrasado.

## Consequências

- **O "ligar" manual virou um pulso de no máximo `BOMBA_MAX_ON_MS`** — não fica ligado indefinidamente; o watchdog corta. O painel mostra o estado real via field6 quando o feed atualiza.
- **PAUSE e queda de Wi-Fi desligam a bomba:** `globalAplicarComando` (ramo PAUSE/STOP) chama `bombaDefinir(false)` e `conectarWiFi()` desliga a bomba no início (o `while` de reconexão pode bloquear ~30 s). Segurança não depende do modo de operação.
- **Sensor de solo inválido nunca irriga:** `soloValido` (faixa 500–3800) porta a decisão automática; sensor solto/em curto não rega às cegas e conta como offline em `saude_sensores`.
- **Bancada exige cuidado:** sem tensão de rede no início, carga de baixa tensão no lugar da bomba, e só no fim a bomba AC.
- **O poll da Vercel é à prova de cabeçalhos grandes (revisão v1.8.1):** o fim dos cabeçalhos passa a ser detectado pelos **últimos 4 bytes lidos** (`ult4`), e não pelo conteúdo guardado numa `String` limitada — com cabeçalhos maiores que o limite antigo (512 B) o `\r\n\r\n` nunca era visto, o corpo ficava vazio e o comando (já removido da fila por `LPOP`) era **perdido em silêncio**. Agora guarda-se só a linha de status (≤128 B), cabeçalhos que não terminam logam `[VERCEL] Resposta incompleta` e o log "Poll de comandos ativo" só aparece **depois** de um JSON válido.
- **Nada bloqueante com a bomba ligada (revisão v1.8.1):** no `loop()`, `conectarLocalMQTT()`, `conectarThingSpeak()` e `pollComandosVercel()` só correm com a bomba **desligada** (`bombaAtiva` = `estadoValvula` false) — esses caminhos podem bloquear vários segundos (handshake TLS, espera do CONNACK) e o `bombaWatchdog()` é por software, não corta nada com o loop preso. `localMQTT.loop()`/`tsMQTT.loop()` (não bloqueantes) continuam sempre; `setHandshakeTimeout(3)`/`setSocketTimeout(3)` limitam o bloqueio. Como a bomba só fica ligada ≤ `BOMBA_MAX_ON_MS`, adiar as reconexões custa no máximo ~12 s.

## Emenda (2026-10-08, v1.8.2) — sem boia: proteção só por teto de tempo + limite diário

**Contexto:** o utilizador não quer nenhuma ligação extra no ESP32 além do GPIO27
(relé da bomba) — sem boia no GPIO25, sem fio de touch e sem cálculo de
nível/litros. A boia de nível e o debounce (itens 4 e 6 acima) ficam **superados**
por esta emenda. field8 do ThingSpeak continua a ser o RSSI e o painel web não muda.

**Decisão:** removidos `PIN_NIVEL_AGUA`, `BOIA_COM_AGUA_NIVEL`, `NIVEL_DEBOUNCE_MS`,
`reservatorioTemAgua()` (+ protótipo), `semAguaDesdeMs` e o ramo de falta d'água de
`bombaWatchdog()`. O GPIO25 deixa de ser usado. A irrigação fica protegida só por:

- **teto de tempo** por pulso (`BOMBA_MAX_ON_MS`, corte imediato, vale no manual);
- **limite diário** de pulsos (`BOMBA_MAX_PULSOS_DIA = 6`, ~1,8 L/dia) como única
  barreira de volume — a contagem passa para `bombaDefinir()` (transição OFF→ON,
  vale para automático e manual) e o reset diário é extraído para
  `atualizarContadorDiario()`, chamada no início de `avaliarControle()` (depois do
  `return` da pausa), porque antes corria depois de early-returns e nesses casos
  não rodava.

**Consequências:**

- O "Ligar" manual (MQTT e fila) também conta no limite diário; ao atingi-lo,
  `bombaDefinir(true)` recusa e o caminho 2.3 publica OFF sem entrar em modo manual
  (mensagem "ON recusado: limite diario atingido").
- O contador é **persistido na flash** (NVS/Preferences, namespace "estufa", chaves
  `pulsos_hoje`/`dia_pulsos`) a cada incremento e a cada reset diário, e lido no
  `setup()` — sobrevive a reboot. Escritas ≤ `BOMBA_MAX_PULSOS_DIA` por dia.
- **Risco assumido:** sem sensor de nível, nada detecta o balde vazio — a única
  proteção a seco é o teto de tempo de cada pulso e o limite diário de volume.
  Reabastecer passa a ser **rotina manual** do utilizador (dimensionar o balde por
  ~80% do volume; fórmula em §19.1 do BLUEPRINT).

**Alternativa futura:** se um dia se quiser proteção a seco automática **sem ocupar
GPIO**, usar uma **boia de rede em série com a fase da bomba** (contato
normalmente-fechado que abre sem água) — corte elétrico, não lógico; isenta o
firmware e o ESP32 de qualquer pino de nível.

## Alternativas descartadas

- **Histerese contínua 40 %→70 % (modelo antigo):** feita para uma válvula inócua. Numa bomba AC super-rega, esvazia o reservatório e queima a seco — rejeitada.
- **Bomba contínua com só proteção a seco:** resolve a queima, mas não o esvaziamento do reservatório nem a super-rega pelo sensor lento.
- **Relé no neutro:** descartado por segurança — o relé comuta a **fase** (fusível 0,5 A, caixa fechada, emendas isoladas, DR 30 mA se possível); ver §hardware no BLUEPRINT.
