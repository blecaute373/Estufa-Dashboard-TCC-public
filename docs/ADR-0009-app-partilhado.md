# ADR-0009 — Uma única montagem Express para dev e produção

- **Status:** aceite
- **Data:** 2026-09-29
- **Contexto:** o projeto tem **duas** entradas que montam o mesmo backend: `server.js` (dev local, com broker MQTT) e `api/index.js` (função serverless da Vercel). Durante meses cada uma declarou o seu próprio `express()`, os seus `use()` e o seu handler de erro. Isso já tinha motivado o [ADR-0003](ADR-0003-lib-partilhada.md) para as *funções*, mas a **montagem** ficou de fora — e é nela que moram os comportamentos transversais. O [BUGS.md](../BUGS.md) tem três incidentes causados por drift entre as duas.

O que esta duplicação causou na prática, e foi encontrado em auditoria (o "Bugs Conhecidos em Aberto" do [BLUEPRINT.md](../BLUEPRINT.md) já regista incidentes deste tipo — e o próprio [ADR-0003](ADR-0003-lib-partilhada.md) nasceu de um: `requireAuthApi` em vez de `requireAdminApi` em dev):

| Problema | Sintoma |
|---|---|
| `express-rate-limit` sem `app.set('trust proxy', 1)` na Vercel | todos os utilizadores atrás do mesmo edge IP partilham 1 contador; o login legítimo é bloqueado com 429 em rede corporativa/mobile |
| `setGlobal('express-rate-limit/window', '1m')` dentro da função | **polui todo o processo Lambda** e é herdado por qualquer função carregada depois — 429 em endpoint sem limiter |
| `GET /api/control` registado na Vercel, inexistente no `server.js` | **404 com `Content-Type: text/html` e corpo HTML** na entrada local, violando o §14.1 (toda a API responde em Problem Details) |
| `POST /api/admin/promote-first` sem limiter no `server.js` | bootstrap do admin sem rate limit local; na Vercel tinha 5/15 min |
| dois `errorHandler` com middlewares de erro diferentes | 500 com formas distintas consoante o sítio onde correu |

## Decisão

**`lib/app.js` é o dono do `express()`.** Nenhuma entrada chama `express()` nem declara middlewares de novo.

```
lib/app.js  →  criarApp({ paginaProtegida, controleLocal, fallbackEstatico, nome })
   ├─  helmet (X-Frame-Options: SAMEORIGIN, CSP report-only)   ← §14.2
   ├─  cookie-parser
   ├─  trust proxy = 1                        ← só com proxy (nunca em localhost)
   ├─  windowMs/limit/window definidos ANTES de qualquer limiter
   ├─  página protegida em 307 (nunca serve HTML de login)
   ├─  /api/health  { status, uptime, thingspeak }
   ├─  404 → problem() para TODO o /api/*   ← §14.1
   ├─  estáticos + fallback SPA, sempre por último
   └─  errorHandler + 404 final
```

Cada entrada fornece **três extensões** (o que é genuinamente seu) e recebe o resto montado igual:

| | `paginaProtegida` | `controleLocal` | `fallbackEstatico` |
|---|---|---|---|
| `server.js` | `requireAuth` + MQTT | `POST` MQTT direto | `index.html` |
| `api/index.js` | `requireAuthApi` | — (usa `api/control.js`) | `index.html` |

A paridade é **verificada por teste** (`test/parity.test.js`), não por revisão de código: sobem-se as duas apps em portas efémeras e exige-se o mesmo comportamento para rota desconhecida (404 Problem Details), `Content-Type` de 404, `X-Content-Type-Options`, `/api/health` sem auth, `/admin.html` sem cookie (307) e `/api/admin/promote-first` sem body (400, e **não** 429 — prova que a janela global é restaurada por montagem).

## Alternativas consideradas

- **Deixar `server.js` e `api/index.js` independentes e manter uma tabela de paridade no BLUEPRINT:** foi o que existiu; falhou três vezes. Um checklist de "não esquecer X" não impede drift, só ajuda a reparar nele depois.
- **Ter uma única entrada e simular o serverless no dev:** o `server.js` não é um luxo — é o único caminho com broker MQTT. Remover-lhe o MQTT deixaria o desenvolvimento local sem controlo de atuadores.
- **Framework/meta-servidor em vez de Express:** custo de migração sem ganho para o problema, que é organizacional.
- **Copiar `api/index.js` para `server.js` e apagar a diferença:** inverte o problema. O que está certo hoje em um ficheiro passa a poder estar errado no outro na próxima sessão.

## Consequências

- **Ganho imediato de segurança:** `helmet` e `trust proxy` entram na Vercel, e o limiter de bootstrap entra no dev local. §14.2 sai do "recomendado" para "implementado".
- **Uma montagem mais lenta a mudar:** qualquer middleware novo passa a valer nas duas entradas ao mesmo tempo. É o objetivo, mas exige testar os dois caminhos — daí o teste de paridade.
- **`controleLocal` é uma exceção explícita** na API de `criarApp`. Se aparecer uma segunda diferença entre entradas, o desenho deve ser revisto em vez de se acumularem flags.
- **Cache de leitura (`lib/cache.js`), decidida na mesma revisão:** o proxy ThingSpeak faz 2 pedidos HTTPS por chamada, e cada carga/atualização de painel fazia os dois de novo. TTL de **8 s** (metade do intervalo de publicação do canal, portanto nenhuma leitura repetida chega ao ThingSpeak) + **coalescência** de pedidos simultâneos + **LRU de 32 chaves** para não reter dados de canais antigos + **erro nunca é cachado** + `x-thingspeak-cache: hit|miss|stale`. O valor nunca é mais antigo que uma publicação do canal.
