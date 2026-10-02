# 📦 `legacy/` — Versão original ("as is") do dashboard

Esta pasta guarda a **versão original** do dashboard da Estufa 01, preservada
como **registro de proveniência e autoria** do projeto. Ela **não faz parte do
runtime** — nada em `api/`, `public/` ou `server.js` a carrega.

## `dashboard_estufa_original.html`

| | |
|---|---|
| **Autor** | Deivisson Lino Campos dos Santos Junior ([@blecaute373](https://github.com/blecaute373)) |
| **Estado** | Versão "as is" — monolítica e **já calibrada** para o hardware real |
| **Arquitetura** | Um único ficheiro HTML com CSS (`<style>`), JavaScript (`<script>`) e o consumo da API do ThingSpeak **tudo junto**, sem separação de camadas |
| **Diferença central para o sistema atual** | Falava **direto** com a API do ThingSpeak a partir do browser, com a **chave de API embutida no próprio HTML** — exatamente o problema que a v1.1.0 do projeto teve de reverter ("security: remove leaked secrets") |
| **Destino desta versão** | Reformatada e modularizada (CSS/JS separados, `api/` no servidor, proxy ThingSpeak, login JWT, painel admin) |

### Por que ela está versionada aqui

Duas razões concretas, não sentimentais:

1. **Proveniência verificável da autoria.** O ficheiro é a evidência de que o
   firmware ESP32, a integração com o ThingSpeak e o dashboard calibrado
   existiam **antes** do sistema web atual. Ver o parágrafo seguinte.
2. **Fonte de verdade das calibrações do hardware.** Os limites que hoje estão
   documentados como "thresholds do firmware" (BLUEPRINT §11.1.1) nasceram
   **neste ficheiro**.

### A prova da autoria do firmware

Na linha 740 do ficheiro original está, literalmente:

```js
/* thresholds do master (sketch_apr13a.ino) */
const TH = {
  tempSup: 30, tempInf: 26,      // ventoinha liga >= 30 C / desliga <= 26 C
  soloInf: 40, soloSup: 70,      // valvula abre <= 40 % / fecha >= 70 %
  luxMin: 100, luxMax: 600,
  umidArCrit: 30,
};
```

O comentário aponta para `sketch_apr13a.ino` — o sketch do ESP32 que **é o
firmware do projeto**. E os seis valores batem **exatamente** com os limites que
o BLUEPRINT §11.1.1 atribui ao firmware (ventoinha >= 30 °C / <= 26 °C, válvula
<= 40 % / >= 70 %), e com o `INTERVALO_S = 16` do ciclo de telemetria
ThingSpeak. Ou seja: **as constantes de calibração viajaram do firmware escrito
por Deivisson para a documentação do sistema atual** — é o rastro que liga a
autoria ao artefato.

### Sanitização (leia antes de reaproveitar)

A chave de API do ThingSpeak que estava embutida no ficheiro original **foi
removida** e substituída por `REDACTED_VER_legacy_README`. Ela era uma
credencial real de um canal antigo (não o canal de produção atual, que vive em
`TS_CHANNEL`/`TS_API_KEY`) — mas uma credencial real commitada num repositório é
uma credencial comprometida, independentemente de estar em uso
(ENGENHARIA §9.10). O `CH_ID` foi mantido por não ser segredo e por dar sentido
histórico ao ficheiro.

> **Não reaproveite este ficheiro como base do dashboard atual.** Ele é
> deliberadamente o exemplo do antipadrão: chave de API no cliente, sem
> separação de camadas e sem autenticação. O dashboard atual (`public/`) existe
> justamente para resolver isso.