# ADR-0010 — Base de dados de produção: cluster, utilizador e diagnóstico

- **Status:** aceite
- **Data:** 2026-10-02
- **Contexto:** o deploy da Vercel tinha **6 das 7** variáveis de ambiente
  configuradas. Faltava `MONGODB_URI`. O `lib/config.js` e o `api/db.js` fazem
  *fail-fast* e sem fallback em produção, portanto o `POST /api/auth/login`
  devolvia **500** — comprovado com pedido real. Sem login não se chega ao painel
  de administração, e é lá que vive o botão que aciona o relé. Ou seja: **a fila
  de comandos já estava provada ponta-a-ponta, mas o caminho humano até ela
  estava cortado**. Este ADR registra a decisão de *onde* guardar os dados de
  produção e *com que credencial*, não apenas que a variável foi preenchida.

## O problema não era "faltava colar uma string"

Três restrições concretas moldaram a decisão:

1. **O valor antigo não existe mais.** Foi procurado no histórico completo do Git
   (`git log --all -S 'mongodb+srv'`, 4 commits) e em todos os artefactos de
   auditoria do repositório: restam apenas placeholders. A v1.1.0
   (`security: remove leaked secrets`) removeu o segredo real e o Git não o
   devolve. Não havia nada para recuperar.
2. **O Atlas nunca devolve uma password existente.** É por desenho. Qualquer
   credencial já criada é irrecuperável — só se define uma nova. Portanto
   "reaproveitar" e "criar" dão trabalho semelhante.
3. **O cluster já existia.** O Atlas CLI na máquina de desenvolvimento estava
   autenticado e `atlas clusters list` mostrou um cluster vivo
   (`Cluster63224`, MongoDB 8.0.34, `IDLE`) com dois utilizadores de BD e uma
   Access List já com `0.0.0.0/0`. Criar um segundo cluster não resolveria nada
   que o primeiro não resolvesse.

> **Nota de método:** o Atlas CLI **não** estava no `PATH`, o que fez a primeira
> busca concluir que "não havia CLI" (`where.exe atlas` falha, `Test-Path
> $env:APPDATA\.atlas` dá `False`). O binário existe em
> `C:\Program Files (x86)\MongoDB Atlas CLI\atlas.exe`. A lição: *"não encontrei
> a ferramenta"* e *"a ferramenta não existe"* são conclusões diferentes, e a
> diferença custou uma sessão inteira.

## Decisão

**Quatro decisões, todas deliberadas.**

### 1. Utilizador de BD dedicado com privilégio mínimo, não o `readWriteAnyDatabase`

Foi criado `estufa_vercel` com a role **`readWrite@estufa`** — ou seja, escrita
apenas na base `estufa`. Já existia `estufa_app` com
`readWriteAnyDatabase`, que funcionaria, mas escreve em *qualquer* base do
cluster (ENGENHARIA §9.2, *least privilege*: "nunca admin por conveniência").

O que a aplicação realmente toca é restrito e conhecido: `models/User.js` e
`models/AccessLog.js`. Nada mais. A role larga era, portanto, privilégio a mais
sem contrapartida.

### 2. Base explícita no caminho da URI

A URI termina em **`/estufa?retryWrites=true&w=majority`**. O nome da base é
explícito de propósito: sem ele, o Mongoose usa a base `test` sem avisar — os
utilizadores e os logs de auditoria iriam para um sítio inesperado, e o sintoma
seria "o login não encontra ninguém" com o cluster a servir tudo corretamente.

### 3. `0.0.0.0/0` na IP Access List — trade-off assumido

As instâncias serverless da Vercel saem de IPs dinâmicos da AWS, que não são
allow-listáveis de forma estável. A hipótese mais restrita exigiria um proxy com
egress estático (um serviço a mais, com custo e mais um segredo para gerir). Para
o âmbito deste projeto, a defesa fica na password SCRAM + no facto de a
credencial viver apenas nas env vars da Vercel. **Isto está registrado como
trade-off consciente de *serverless* vs *least privilege*, não como descuido.**

### 4. `npm run check:mongo` em vez de "ligar e ver se dá"

O modo de falha era genuinamente ambíguo: 500 no login é indistinguível de JWT
errado, Redis em baixo ou URI mal formada. `scripts/check-mongo.js` verifica os
quatro elos separadamente — formato da URI (offline), ping autenticado, leitura
das coleções reais e **escrita** numa coleção descartável — e imprime a URI
sempre mascarada, porque um diagnóstico que loga a URI inteira *é* ele próprio o
incidente.

Tal como o `check:control`, fica **fora** do `npm run check`: precisa de rede e
credenciais reais, enquanto `check`/`test` são herméticos por desenho
(ENGENHARIA §5.2).

## Alternativas consideradas

- **Reaproveitar o cluster do colega de TCC** (o domínio
  `dashboardestufaiot.vercel.app` responde com 10 utilizadores, noutra conta
  Vercel): rejeitada. Acoplaria este deploy a uma conta que não se administra —
  sem acesso a Access List, utilizadores ou logs, e sem forma de remediar um
  problema em horas de entrega.
- **Criar um cluster novo (M0/Flex):** rejeitada. Já existia um cluster vivo no
  projeto; um segundo seria duplicação de recursos e mais um sítio para as
  coisas divergirem.
- **Repor a password do `estufa_app` (`readWriteAnyDatabase`) e usá-lo:**
  rejeitada. Resolveria o sintoma mantendo o privilégio excessivo — e a decisão
  certa tomava-se mais tarde, com mais pressão, ou nunca.
- **Pôr a URI no `.env` versionado:** impossível por regra (`.gitignore` cobre
  `.env*`; a v1.1.0 existe precisamente por isto).

## Consequências

**Positivas**

- A cadeia de controlo ficou **completa de ponta a ponta**: painel → login →
  autorização de admin → fila → poll do dispositivo. Antes, o último trecho era
  inalcançável por um humano mesmo estando funcional.
- A credencial que corre em produção é a **mínima necessária**, e o seu âmbito é
  legível na própria definição (`readWrite@estufa`).
- O modo de falha deixou de ser ambíguo: `npm run check:mongo` separa formato,
  autenticação, leitura e escrita, e diz qual falhou.

**Negativas / riscos assumidos**

- **`0.0.0.0/0`** na Access List: qualquer origem pode *tentar* autenticar-se. A
  defesa passa a ser exclusivamente a password. Ver a decisão 3 para o porquê.
- **A password transitou pelo terminal.** Foi gerada dentro do comando e nunca
  impressa, mas o *scrollback* do PowerShell pode retê-la. A ordem correta de
  resposta, se isso for um problema (ENGENHARIA §9.10), é **rotacionar primeiro
  e limpar depois** — a rotação é o único passo que remove de facto a capacidade
  de quem viu o valor.
- **Passou a haver dois utilizadores de BD no cluster** (`estufa_app` e
  `estufa_vercel`). Convém apagar o `estufa_app` quando se confirmar que nada
  mais o usa — um credencial a mais é superfície a mais.
- **A app não tem endpoint nem UI para trocar a password.** O primeiro
  administrador criado serve, portanto, para validação; a substituição é feita
  através de `POST /api/auth/register` + `scripts/make-admin.js`, ou repondo a
  password do utilizador de BD (que é outra coisa — é a credencial da
  *aplicação*, não a do *utilizador*).

## Como verificar (checklist)

**Resultado FINAL medido no site publicado**
(`https://dashboardestufaiot-omega.vercel.app`), em 02/10/2026. Cada linha é um
**pedido HTTP real** — não inspeção de código:

| Pedido | Antes | Depois |
|---|---|---|
| `POST /api/auth/login` | **500** | **200** `{"is_admin":true}` |
| `POST /api/auth/register` (1.º utilizador) | 500 | **200**, `is_admin:true` (bootstrap do `api/auth.js:45` — `userCount === 0`) |
| `GET /api/admin/users` com token | 500 (sem login possível) | **200** com o utilizador |
| `GET /api/admin/users` **sem** token | — | **401** (autorização antes da lógica) |
| `GET /api/admin/logs` | 500 | **200** com logs reais (IP, user-agent, evento) |
| `GET /api/auth/status` | 200 `{"registeredUsers":0}` | **200** `{"registeredUsers":1}` |
| `POST /api/control` **sem** token | — | **401** |
| `POST /api/control` **com** token | 202 | **202** `id=c6378c0e-…` |
| `GET /api/control/pending` **com** `X-Device-Token` | 200 | **200**, `count:1`, **mesmo id** |
| `GET /api/control/pending` (2.º poll) | `count:0` | **`count:0`** (at-most-once) |
| `GET /api/thingspeak/last` | 200 | **200** com dados reais (`27.40 °C`) |

Prova de que a escrita de produção chegou a **este** cluster (e não a outro):
o `npm run check:mongo` corria com `users: 0` / `accesslogs: 0` antes dos
testes e `accesslogs: 1` logo após o `POST /api/auth/login` com utilizador
inexistente — o registo de `failed_login` escrito pela Vercel apareceu na coleção
que o script local estava a ler. É a mesma base, confirmada por observação do
efeito, não por configuração.

**O que isto prova:** o transporte, a autenticação e a autorização funcionam no
site publicado, e o acionamento manual deixou de ter um trecho inalcançável por
um humano. O que **não** prova: que o relé físico comuta — isso depende de o
ESP32 estar a fazer o poll com o `DEVICE_TOKEN` certo (ver `check:control` e a
nota de que o firmware ainda não foi carregado).

## Reproduzir

```bash
# 1. Conferir o cluster e o utilizador (Atlas CLI; não está no PATH)
& 'C:\Program Files (x86)\MongoDB Atlas CLI\atlas.exe' projects list
& '...\atlas.exe' clusters connectionStrings describe Cluster63224 --projectId <id>

# 2. Criar/repor o utilizador de privilégio mínimo
& '...\atlas.exe' dbusers create readWrite@estufa --username estufa_vercel \
    --password <gerada> --projectId <id>

# 3. Diagnóstico local (formato + ping + leitura + escrita)
npm run check:mongo

# 4. Publicar a variável (só em produção; a password é sensível)
vercel env add MONGODB_URI production --value "<srv>" --sensitive --yes
vercel redeploy <url> --no-wait --non-interactive   # ver ADR-0008, "lição do deploy"
```

> **Armadilha dos dois projetos (repete-se aqui porque voltou a morder):**
> `dashboardestufaiot.vercel.app` está vivo **noutra conta** e responde
> `{"registeredUsers":10}` do cluster do colega. Este deploy é o
> **`-omega`**. Um diagnóstico que teste "o domínio" sem dizer **qual** conclui
> coisas erradas — o valor `10` não tem nada a ver com esta base.