# 🏗️ ENGENHARIA.md — Boas Práticas e Padrões Industriais de Engenharia de Software

> **Documento de uso geral** — não é específico da Pandora nem de nenhuma linguagem/framework, embora se conecte com o projeto onde fizer sentido. Pensado como referência pra qualquer projeto de software sério, em qualquer stack.
>
> **Versão:** 1.0.0 · **Data:** 10/09/2026 · **Status:** framework de referência — pesquisa real sobre o estado atual (2026) da engenharia de software industrial, incluindo onde a indústria genuinamente discorda, não só onde há consenso.

---

## 0. Escopo e Como Usar Este Documento

Duas coisas antes de qualquer conteúdo:

**Isso não é uma lista de regras a seguir cegamente.** Engenharia de software madura em 2026 tem menos dogma absoluto do que os livros de 2008-2015 sugeriam — várias das ideias mais citadas (Clean Code, 100% de cobertura de teste, microsserviços por padrão) têm crítica séria e legítima vinda de gente muito experiente, não de gente que "não entendeu direito". Este documento marca explicitamente **onde existe debate real da indústria**, em vez de apresentar tudo como consenso — isso é o que separa uma referência séria de uma lista de blog genérica.

**Contexto decide mais que princípio abstrato.** A pergunta certa quase nunca é "isso é boa prática?" — é "isso é boa prática **pro meu contexto** (tamanho de time, estágio do produto, criticidade, stack)?". Esse documento é organizado pra deixar esse "depende" explícito e acionável, não pra escondê-lo atrás de afirmações categóricas.

---

## 1. Princípio Central: Otimize Pro Que Seu Projeto Precisa Agora

Antes de qualquer prática específica — a régua que decide como aplicar tudo abaixo: **complexidade de processo/arquitetura deveria ser proporcional ao problema real que você tem, não ao problema que você pode vir a ter.** A maioria dos projetos que falham em engenharia falha por excesso de engenharia prematura (microsserviços num MVP, abstração de camada pra um caso de uso só, processo pesado num time de 3 pessoas) tanto quanto por falta de disciplina. As duas direções são erro.

---

## 2. Código Limpo e Legibilidade

### 2.1 O Que Ainda Se Sustenta

Os princípios centrais de "Clean Code" (Robert C. Martin) que resistem bem ao escrutínio atual: nomes que revelam intenção (`emailAddress` em vez de `emailStr`, `isEnabled`/`hasAccess` pra booleanos), funções pequenas com um só nível de abstração, evitar comentários que só repetem o que o código já diz, e formatação consistente automatizada (linter/formatter, não debate humano sobre estilo).

### 2.2 A Crítica Séria (Não É Modismo)

Engenheiros experientes têm apontado, de forma consistente nos últimos anos, limitações reais do dogma de "Clean Code" original:

- **Excesso de abstração/indireção**: funções extremamente pequenas, forçadas por regra ("nunca mais de 4 linhas"), frequentemente **pioram** legibilidade — o leitor precisa pular entre 8 funções de 2 linhas cada pra entender um fluxo que caberia numa função de 15 linhas linear.
- **Foco datado em concorrência**: exemplos e conselhos de concorrência do livro original são rasos pra linguagens modernas com concorrência de primeira classe (Go, Rust, Elixir).
- **Regra vs. julgamento**: o próprio livro admite, na edição revisada, que "limpo" é padrão pessoal, não universal — mas segue sendo usado como régua absoluta em muitos times, o que gera dogmatismo que o próprio autor não pretendia.

**Recomendação prática**: trate as regras de Clean Code como heurísticas de partida, não lei — o teste real é "o próximo engenheiro consegue mudar isso sem precisar segurar o sistema inteiro na cabeça?", não "isso bate com a checklist do livro?".

### 2.3 Código Limpo na Era de Geração por IA (novidade de 2026)

Com assistentes de código (Copilot, Cursor, Claude Code e similares) virando parte padrão do fluxo de trabalho, a pergunta "clean code ainda importa se a IA escreve o código?" já tem resposta emergente: **importa mais, não menos** — a IA reduz o custo de gerar código, não o custo de manter código ruim. Nomenclatura clara e módulos bem definidos passam a importar tanto ou mais, porque são exatamente o que determina se um assistente de IA consegue navegar o projeto com contexto correto ou "alucina" uma mudança que quebra algo em outro lugar.

---

## 3. Princípios de Design: SOLID, DRY, KISS, YAGNI

| Princípio | O que diz | Onde vira over-engineering se aplicado sem critério |
|---|---|---|
| **S**ingle Responsibility | Uma unidade de código, uma razão pra mudar | Fragmentar uma classe simples em 5 "responsabilidades" que sempre mudam juntas na prática |
| **O**pen/Closed | Aberto pra extensão, fechado pra modificação | Criar camada de abstração/plugin pra um caso de uso que nunca vai ter uma segunda variação real |
| **L**iskov Substitution | Subtipo deve poder substituir o tipo base sem quebrar comportamento | Raramente vira over-engineering sozinho — mais um sinal de design de herança ruim quando violado |
| **I**nterface Segregation | Interfaces específicas, não uma genérica gigante | Criar 10 interfaces de um método cada quando 2 interfaces coerentes resolveriam |
| **D**ependency Inversion | Depender de abstração, não de implementação concreta | Injetar interface pra uma dependência que nunca vai ter segunda implementação (ex.: um único banco de dados pro projeto inteiro) |
| **DRY** (Don't Repeat Yourself) | Não duplicar conhecimento/lógica de negócio | "Abstração prematura" — duas coisas que parecem iguais hoje mas representam conceitos de negócio diferentes; forçar reuso cedo demais cria acoplamento que duplicação não criaria |
| **KISS** (Keep It Simple) | Prefira a solução mais simples que resolve o problema real | — |
| **YAGNI** (You Aren't Gonna Need It) | Não construa flexibilidade pra requisito hipotético | — |

**A tensão real, documentada por engenheiros seniores (ex.: Sandi Metz — "duplicação é mais barata que a abstração errada")**: DRY aplicado cedo demais, antes do padrão de reuso real se provar, tende a criar uma abstração errada que é mais cara de desfazer do que a duplicação teria sido. A prática recomendada por várias vozes sérias da indústria: **tolerar duplicação até a terceira ocorrência real** ("regra dos três") antes de extrair abstração — as duas primeiras vezes ainda não provam que é o mesmo conceito de negócio, só que parece igual.

---

## 4. Arquitetura de Software

### 4.1 Monolito vs. Microsserviços — o Estado Real do Debate em 2026

Depois de uma década de "microsserviços por padrão" (2016-2022) seguida de reação séria contra o excesso (2022-2024), a indústria em 2026 convergiu pra uma posição mais pragmática, não mais binária:

| Sinal | Aponta pra |
|---|---|
| Time com menos de ~10 engenheiros, produto com menos de 1 ano | **Monolito modular** — um único deployável, com fronteiras internas claras (módulos/pacotes bem separados) |
| Mais de ~50 engenheiros, ou partes do sistema com necessidade de escala genuinamente diferente entre si | Microsserviços começam a fazer sentido — mas exigem maturidade operacional real (observabilidade, orquestração) antes de compensar |
| Incerto sobre onde as fronteiras de domínio realmente estão | Monolito — decompor cedo demais **fixa um chute** como decisão arquitetural cara de reverter |
| Times autônomos que precisam deployar sem coordenar uns com os outros | Microsserviços resolvem um problema **organizacional**, não só técnico — Lei de Conway (a arquitetura tende a espelhar a estrutura de comunicação da organização) explica por que isso importa mais que a tecnologia em si |

**Casos de referência real, não hipotéticos**: Shopify roda bilhões de dólares em transações sobre um monolito modular (Ruby on Rails) com milhares de engenheiros — a prova de que monolito não é sinônimo de "não escala". Netflix é o exemplo canônico de microsserviços — mas tem centenas de engenheiros dedicados só à plataforma que sustenta isso, investimento que a maioria das organizações não tem.

**Padrão de migração, quando fizer sentido migrar**: Strangler Fig — extrair componentes de alto valor um de cada vez do monolito, mantendo o sistema no ar o tempo todo, em vez de reescrita completa (reescritas completas têm histórico de fracasso desproporcional).

**Argumento novo que não existia há 3 anos**: assistentes de IA de código (Copilot, Cursor) navegam e editam com mais precisão dentro de um serviço pequeno e bem-escopado do que dentro de um monolito grande com dependência implícita espalhada — isso é um fator genuinamente novo a favor de decomposição, mas só depois que as fronteiras de domínio já são conhecidas (ver Seção 4.2).

### 4.2 Domain-Driven Design (DDD) — Antes de Decompor, Não Depois

DDD propõe modelar o software em torno dos conceitos e da linguagem do domínio de negócio real (não das tabelas do banco), organizando o sistema em **contextos delimitados** (bounded contexts) — áreas onde um termo tem um significado consistente e específico. A recomendação hoje amplamente aceita: **defina os bounded contexts antes de decidir se e como decompor em serviços** — cada bounded context é um candidato natural a virar um serviço próprio depois, se e quando a decomposição fizer sentido (Seção 4.1). Decompor sem ter os contextos claros é decompor no lugar errado.

### 4.3 Camadas e Portas-e-Adaptadores (Arquitetura Hexagonal)

Independente de monolito ou microsserviço, separar o núcleo de regra de negócio das dependências externas (banco, fila, API de terceiro) por meio de interfaces ("portas") com implementações trocáveis ("adaptadores") continua sendo prática sólida — permite testar a lógica de negócio sem precisar de banco real rodando, e trocar uma dependência externa sem tocar na regra de negócio. Isso não é sobre ter uma pasta chamada "domain" — é sobre a regra de negócio genuinamente não importar nada de infraestrutura.

---

## 5. Testes

### 5.1 A Pirâmide de Testes (e Suas Alternativas Legítimas)

Modelo clássico (Mike Cohn, 2009): muitos testes de unidade rápidos e isolados na base, menos testes de integração no meio, poucos testes ponta-a-ponta (E2E) no topo — proporção de referência aproximada **70% unidade / 20% integração / 10% E2E**, ajustável conforme a arquitetura.

**Alternativas legítimas, não "erradas", pra contextos diferentes**:

| Modelo | Formato | Quando faz mais sentido |
|---|---|---|
| Pirâmide clássica | Muita unidade, pouco E2E | Backend com lógica de negócio pesada e complexa |
| Troféu de testes | Ênfase em integração | Frontend, onde testar unidades isoladas de UI dá falsa confiança |
| Colmeia de testes | Muitos testes de integração pequenos | Arquiteturas de microsserviços |
| Diamante de testes | Ênfase no meio, pouca unidade/E2E | Sistemas data-heavy onde a lógica real está na integração com dados |

**Nenhum modelo é universal** — a escolha certa reflete onde o risco real do seu sistema está concentrado, não qual modelo está na moda.

### 5.2 Um Jeito Mais Rigoroso de Pensar Tamanho de Teste (Google)

Em vez da categoria subjetiva "é unitário ou é integração?" (que gera debate infinito sem critério objetivo), a prática interna do Google usa **tamanho mensurável**: Small (processo único, sem I/O de rede/disco, geralmente <100ms), Medium (pode usar localhost/containers locais), Large (sistema completo, pode envolver rede real). Isso troca rótulo subjetivo por limite operacional objetivo — e expõe a tensão real por trás da pirâmide: **hermeticidade (isolamento) vs. fidelidade (o quanto reflete produção de verdade) estão em conflito direto** — teste maior e mais fiel custa mais e quebra (fica "flaky") com mais frequência; o modelo de tamanho é uma forma disciplinada de só pagar esse custo onde o risco realmente justifica.

### 5.3 O Que Mudou de Verdade em 2026: Testes na Era de IA

Geração de fluxo de usuário por assistentes de IA passou a superar a velocidade de escrita manual de testes E2E — o que torna geração automatizada de teste E2E prioridade estratégica, não "bom ter". Ao mesmo tempo, cobertura de código deixou de ser tratada como meta séria por engenheiros experientes — **100% de cobertura é hoje amplamente reconhecida como métrica de vaidade**: cobertura mede se uma linha foi executada, não se o comportamento foi verificado. Mutation testing (introduzir bug de propósito e verificar se algum teste falha) é uma medida mais honesta de qualidade de suíte de testes do que porcentagem de linha coberta.

### 5.4 TDD: Prática Válida, Não Universal

Test-Driven Development (escrever teste antes do código) tem defensores sérios e resultados reais em contextos específicos (lógica de negócio complexa, APIs bem especificadas) — mas não é praticado de forma estrita nem por muitos engenheiros seniores respeitados, e "teste depois" bem feito (escrever teste logo após implementar, antes de seguir em frente) é uma prática igualmente legítima e mais comum na indústria real do que o discurso de conferência sugere. O que importa de verdade não é a ordem cronológica de escrita, é que o teste exista, seja significativo, e rode antes do merge.

---

## 6. Controle de Versão e Colaboração

### 6.1 Estratégias de Branching

| Estratégia | Como funciona | Quando faz sentido |
|---|---|---|
| **Trunk-Based Development** | Todo mundo commita direto (ou via branch de vida curtíssima, horas) na branch principal | Times com CI/CD real, deploy contínuo — usado por Google, Meta, Netflix em escala |
| **GitHub Flow** | Branch de feature curta → PR → merge na principal → deploy | Times pequenos/médios, produtos web com deploy contínuo |
| **Git Flow** | Branches de `develop`, `release/*`, `hotfix/*` além da principal | Software versionado com ciclo de release fixo (desktop, mobile, on-premise) — **hoje é a exceção, não o padrão**, para a maioria dos produtos web |

**O sinal mais claro de que Git Flow parou de servir**: cherry-pick constante entre branches, branches de release que se arrastam por semanas — isso não é a estrutura "protegendo" o time, é a estrutura escondendo problema até o último minuto.

### 6.2 Conventional Commits

Formato padronizado, hoje amplamente adotado, que torna o histórico de commits **legível por máquina** (permite gerar changelog e versão semântica automaticamente):

```
feat(payments): add retry logic for Stripe webhook

Stripe occasionally returns 503 during high traffic.
Without retry logic, failed webhooks leave orders in
"pending" state indefinitely.

Fixes: #891
```

Prefixos comuns: `feat` (funcionalidade nova), `fix` (correção), `docs`, `refactor`, `test`, `chore`. O corpo do commit existe pra explicar **por quê**, não **o quê** — o diff já mostra o que mudou.

### 6.3 Code Review

- **PRs pequenos e focados** — a referência prática mais citada é manter mudanças sob ~400 linhas; PR grande demais recebe revisão superficial, não porque o revisor é preguiçoso, mas porque revisão de qualidade real tem limite cognitivo.
- **Automatize o óbvio** — linter e formatter cuidam de estilo; revisão humana foca em lógica, arquitetura e bugs potenciais, nunca em debate de formatação.
- **Feedback estruturado como sugestão, não crítica pessoal** — explicar o "por quê" da sugestão, não só apontar o problema.
- **Pareamento estratégico** (pair programming) funciona melhor em problema complexo, onboarding, ou bug crítico — não precisa ser prática o tempo todo pra ter valor.

---

## 7. CI/CD e Estratégias de Deploy

### 7.1 O Pipeline Mínimo Sério

Lint → typecheck → testes (Seção 5) → build → deploy — cada estágio falha rápido e bloqueia o próximo. Nenhum commit chega a produção sem passar por todos.

### 7.2 Estratégias de Deploy

| Estratégia | Como funciona | Trade-off |
|---|---|---|
| **Rolling** | Substitui instâncias antigas por novas gradualmente | Simples, mas por um período há duas versões rodando ao mesmo tempo |
| **Blue-Green** | Ambiente novo (green) sobe completo, tráfego troca de uma vez do antigo (blue) | Rollback instantâneo (só troca o roteamento de volta), mas exige infraestrutura em dobro durante o deploy |
| **Canary** | Nova versão recebe fração pequena do tráfego real primeiro, aumenta gradualmente se métricas ficarem saudáveis | Detecta problema com exposição mínima, mas exige observabilidade real (Seção 9) pra funcionar — canário sem métrica confiável não serve pra nada |

### 7.3 Feature Flags: Desacoplar Deploy de Release

Um princípio que virou essencial pra trunk-based development funcionar de verdade (Seção 6.1): **deployar código não é o mesmo que liberar a funcionalidade pro usuário**. Código novo pode ir pra produção atrás de uma flag desligada, e ser ligado depois — pra um usuário específico, uma porcentagem do tráfego, ou todo mundo de uma vez — sem precisar de um novo deploy pra isso. Isso também é o que torna deploy canário (7.2) e rollback instantâneo possíveis sem depender só de infraestrutura.

---

## 8. Segurança (DevSecOps)

### 8.1 OWASP Top 10 (2025) — a Referência Padrão da Indústria

A lista mudou de forma significativa desde a versão de 2021, refletindo uma indústria que já não trata segurança como "flaw de código isolado" — o foco se moveu pra arquitetura insegura, complexidade operacional e cadeia de suprimentos de software:

| # | Categoria | O que cobre |
|---|---|---|
| A01 | Quebra de Controle de Acesso | Continua o risco mais crítico — autorização mal aplicada, escalação de privilégio |
| A02 | Design Inseguro | Ausência de controle de segurança **definido antes de codificar** — categoria proativa, não reativa |
| A03 | Falhas de Autenticação | Gestão fraca de identidade e sessão |
| A08 | Falhas de Integridade de Software/Dados | Deserialização insegura, atualização adulterada, **comprometimento de pipeline de CI/CD** |
| A09 | Falhas de Log e Alerta de Segurança | Visibilidade insuficiente pra detectar um ataque em andamento |
| A10 | Tratamento Inadequado de Condições Excepcionais | Erro/exceção mal tratado expondo dado interno ou criando estado explorável — categoria nova |

**O que essa mudança sinaliza pra qualquer projeto**: segurança de pipeline (quem pode alterar o processo de build/deploy, quão verificável é uma dependência) hoje pesa tanto quanto validação de input no código da aplicação em si.

### 8.2 Princípios que Não Mudam Independente da Lista Anual

- **Least privilege** — todo processo/credencial com o mínimo de acesso necessário, nunca "admin por conveniência"
- **Defesa em profundidade** — nenhuma camada única de proteção deveria ser a única coisa entre um atacante e o dado sensível
- **Segredos nunca em código versionado** — variável de ambiente ou gerenciador de segredos dedicado, sempre; `.gitignore` no `.env` desde o primeiro commit do projeto
- **Validação de input no servidor, sempre** — validação de cliente é experiência de usuário, não segurança; o servidor nunca confia em nada que vem do cliente
- **Threat modeling antes de codificar features sensíveis** — pensar em "quem tentaria abusar disso e como" na fase de design é mais barato que corrigir depois

### 8.3 Segurança da Cadeia de Suprimentos

Escaneamento automatizado de dependências (Dependabot, Snyk, ou equivalente) rodando em CI, não como tarefa manual — a maioria das vulnerabilidades reais em produção hoje vem de dependência desatualizada, não de código próprio malfeito. Isso conecta direto com A08 (integridade de software) da lista OWASP 2025.

---

## 9. Observabilidade

### 9.1 Os Três Pilares (e o Quarto Emergente)

| Pilar | O que é | Melhor pra |
|---|---|---|
| **Logs** | Registro de evento discreto, com timestamp e contexto | Debug detalhado de um evento específico — mais flexível, mais propenso a inconsistência entre times |
| **Métricas** | Série temporal numérica agregada | Alerta e visão de saúde geral — barato de consultar, mas não aponta causa raiz sozinho |
| **Traces** | Rastreamento de uma requisição através de múltiplos serviços | Achar onde, numa cadeia de chamadas distribuída, o tempo/erro está concentrado |

Os três se complementam — métrica avisa que algo está errado, trace aponta onde na cadeia, log detalha o que aconteceu exatamente naquele ponto. Nenhum dos três sozinho resolve o problema que os outros dois resolvem. Discussão em andamento na indústria propõe **profiles** (perfil contínuo de uso de CPU/memória) como um possível quarto pilar, ainda não consenso fechado.

### 9.2 SLI, SLO e SLA — a Diferença Que Times Confundem

| Termo | O que é |
|---|---|
| **SLI** (Indicador) | A métrica medida de fato — ex.: latência p99, taxa de erro |
| **SLO** (Objetivo) | A meta interna pra esse indicador — ex.: "p99 < 300ms em 99.9% do tempo" |
| **SLA** (Acordo) | O compromisso externo/contratual, geralmente mais frouxo que o SLO interno, com consequência formal se violado |

SLO deveria ser sempre mais rigoroso que SLA — a folga entre os dois é o que dá margem de manobra antes de uma violação contratual de verdade acontecer.

### 9.3 Comece Pequeno, Não pelos Três de Uma Vez

Não é necessário implementar logging, métrica e trace completos simultaneamente — comece pelo que resolve a dor real atual (geralmente logging estruturado primeiro) e expanda conforme a complexidade do sistema justificar o investimento adicional.

---

## 10. Resiliência e Tolerância a Falhas

### 10.1 Retry com Backoff Exponencial e Jitter

Reexecutar automaticamente uma operação que falhou por erro transitório (rede instável, serviço temporariamente sobrecarregado) — nunca um erro permanente/determinístico, que só vai falhar de novo do mesmo jeito.

```ts
async function comRetry<T>(operacao: () => Promise<T>, maxTentativas = 3): Promise<T> {
  for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
    try {
      return await operacao();
    } catch (erro) {
      if (tentativa === maxTentativas || !éErroTransitorio(erro)) throw erro;
      const backoff = Math.pow(2, tentativa) * 1000; // 2s, 4s, 8s...
      const jitter = Math.random() * 500; // evita "retry storm" sincronizado entre clientes
      await new Promise(r => setTimeout(r, backoff + jitter));
    }
  }
  throw new Error("inalcançável");
}
```

**Idempotência é pré-requisito, não detalhe**: só faz sentido reexecutar uma operação automaticamente se repeti-la não causa efeito colateral duplicado (cobrar duas vezes, criar registro duplicado). Use uma chave de idempotência (identificador único da operação, verificado no servidor) sempre que a operação tiver efeito colateral real.

### 10.2 Circuit Breaker

Depois de um número de falhas consecutivas contra uma dependência, **parar de tentar de propósito** por um período (estado "aberto"), em vez de continuar martelando um serviço que já provou estar fora — depois de um tempo, permite uma tentativa de teste (estado "meio-aberto") pra ver se recuperou, antes de voltar ao normal (estado "fechado"). Isso evita que um serviço já derrubado seja mantido derrubado pela avalanche de retries de todo mundo tentando ao mesmo tempo.

### 10.3 Bulkhead: Isolamento de Falha

Segmentar recursos (pool de conexão, thread, capacidade) por dependência, de forma que uma dependência lenta ou travada não consuma todo o recurso disponível e derrube partes do sistema que não têm nada a ver com aquela dependência específica — o nome vem literalmente dos compartimentos estanques de um navio, que existem pra um furo não afundar o navio inteiro.

### 10.4 Fallback em Cadeia — Já é Prática Aqui no Projeto

Provedor primário falha → tenta secundário → tenta terciário, com timeout e circuit breaker em cada nível — é exatamente o padrão que o fallback multi-provedor de IA da Pandora já implementa (Seção 3.7 do blueprint), aplicado de forma genérica a qualquer dependência externa crítica, não só a provedor de IA.

---

## 11. Design de APIs

### 11.1 REST: Convenções Que Viraram Padrão de Fato

- **Recursos são substantivos, verbos HTTP carregam a ação**: `GET /usuarios/123`, nunca `GET /getUsuario?id=123`.
- **Idempotência por verbo**: `GET`, `PUT`, `DELETE` são idempotentes (repetir não muda o resultado); `POST` não é — daí a necessidade de chave de idempotência (Seção 10.1) quando um `POST` precisa ser seguro pra repetir.
- **Códigos de status com significado real** — nunca `200 OK` pra uma resposta de erro; `201 Created` com header `Location` apontando pro recurso criado; `4xx` pra erro do cliente, `5xx` pra erro do servidor.
- **Formato de erro padronizado**: RFC 9457 (Problem Details) é hoje a referência — corpo de erro estruturado e consistente (`type`, `title`, `status`, `detail`), em vez de cada endpoint inventar seu próprio formato de erro.
- **Versionamento explícito desde o dia um**: `/v1/recurso` é a abordagem mais pragmática (visível, funciona com cache/CDN, testável direto no navegador) — versionar por header é "mais limpo" na teoria, mas invisível e mais fácil de esquecer na prática.
- **Paginação sempre em coleção**, nunca retornar lista completa sem limite.

### 11.2 Rate Limiting

| Algoritmo | Como funciona | Limitação |
|---|---|---|
| Janela fixa | Conta requisições por minuto/hora num contador simples | Permite pico na borda da janela (99 no fim de um minuto + 100 no início do próximo = 199 em 2 segundos) |
| Janela deslizante | Conta com timestamp, remove entradas antigas continuamente | Mais preciso, mais caro de computar |

Retornar sempre os headers `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` — o cliente deveria conseguir se adaptar sem adivinhar.

### 11.3 GraphQL e gRPC: Quando Fogem do Padrão REST

GraphQL faz sentido quando clientes diferentes (app mobile, web, parceiro externo) precisam de formas de dado muito diferentes da mesma fonte — evita over-fetching/under-fetching que REST rígido causaria. gRPC faz sentido em comunicação serviço-a-serviço interna de alta performance, onde o overhead de JSON sobre HTTP importa de verdade — não é a escolha certa pra uma API pública consumida por terceiros.

---

## 12. Bancos de Dados e Persistência

### 12.1 Migrations Como Código Versionado

Toda mudança de schema é um arquivo de migration versionado e revisável, nunca uma alteração manual direto no banco de produção — o schema do banco merece o mesmo rigor de versionamento que o código-fonte.

### 12.2 Problema N+1

O erro de performance mais comum em aplicações com ORM: buscar uma lista de N registros, depois fazer uma query adicional pra cada um deles pra buscar dado relacionado — vira N+1 queries onde uma query com `JOIN` (ou `include`/`with` do ORM) resolveria em uma só. Ferramenta de log de query em ambiente de desenvolvimento pega isso cedo, antes de virar problema de produção sob carga real.

### 12.3 Transações e Consistência

Operação que precisa que múltiplas mudanças aconteçam todas ou nenhuma (transferência entre duas contas, por exemplo) precisa de transação real do banco — nunca duas escritas separadas "torcendo" pra segunda não falhar depois da primeira já ter acontecido. Em sistemas distribuídos onde uma transação ACID clássica não é possível através de serviços diferentes, o padrão **Saga** (sequência de transações locais, cada uma com uma ação de compensação pra desfazer se uma etapa posterior falhar) é a resposta padrão da indústria — junto com aceitar consistência eventual como trade-off consciente, não acidental.

### 12.4 Índices: A Ferramenta Mais Sub-utilizada e Mais Mal-utilizada

Faltando, tornam consulta comum lenta conforme a tabela cresce; em excesso, tornam toda escrita mais lenta (cada índice precisa ser atualizado a cada inserção/atualização). Indexar o que é genuinamente consultado com frequência e filtrado por igualdade/intervalo — não indexar "por garantia".

---

## 13. Tratamento de Erros

### 13.1 Fail-Fast

Validar pré-condições o quanto antes e falhar imediatamente com mensagem clara, em vez de deixar um estado inválido se propagar silenciosamente e falhar de forma confusa três camadas depois — um erro que aponta exatamente onde e por quê é infinitamente mais barato de debugar que um sintoma distante da causa.

### 13.2 Exceções vs. Valores de Erro Explícitos

Duas escolas legítimas, não uma certa e uma errada: linguagens com exceção como Java/Python/JS tratam erro excepcional genuíno (rede caiu, arquivo não existe) como exceção lançada; linguagens como Go/Rust tratam erro como **valor de retorno explícito** que o chamador é forçado a lidar (`Result<T, E>`, `(valor, erro)`) — a vantagem dessa segunda escola é tornar caminho de erro visível na assinatura da função, em vez de escondido até em runtime. Em qualquer dos dois modelos, o erro **nunca deveria ser silenciosamente engolido** (`catch` vazio, erro ignorado) — isso é o antipadrão mais caro de debugar de toda essa seção.

### 13.3 Mensagens de Erro Não Deveriam Vazar Detalhe Interno pro Usuário Final

Conecta direto com a categoria A10 da OWASP 2025 (Seção 8.1) — mensagem de erro exposta ao usuário final não deveria incluir stack trace, query SQL, ou caminho de arquivo interno. O detalhe completo vai pro log estruturado (Seção 9.1), o usuário recebe uma mensagem genérica e segura, com um identificador de correlação pra suporte técnico rastrear no log se precisar.

---

## 14. Configuração e Ambientes: a Metodologia Twelve-Factor

Doze princípios, publicados originalmente pela Heroku, que continuam sendo a referência prática mais citada pra aplicação bem-comportada em ambiente de nuvem — os mais aplicáveis hoje, independente de stack:

| Fator | Princípio |
|---|---|
| Config | Configuração fica em variável de ambiente, nunca hardcoded ou em arquivo versionado |
| Dependências | Declaradas explicitamente (lockfile), nunca assumidas como "já instaladas no ambiente" |
| Paridade dev/prod | Ambiente de desenvolvimento o mais parecido possível com produção (mesma versão de banco, mesmo runtime) |
| Processos sem estado | Processo da aplicação não guarda estado que não sobreviveria a um restart — estado real vai pra banco/cache externo |
| Logs como stream de evento | A aplicação escreve pra saída padrão; o que faz com o log (arquivo, agregador) é responsabilidade de fora do processo, não da aplicação em si |
| Descartabilidade | Processo pode subir e morrer rápido, sem processo de boot pesado nem shutdown que perde trabalho em andamento sem tentar salvar |

---

## 15. Documentação

### 15.1 README Mínimo Sério

O que instala, como roda localmente, como testa, e como faz deploy — nessa ordem de prioridade. Um README que não deixa alguém novo rodar o projeto em 15 minutos é um README incompleto, independente de quão bem escrito o resto está.

### 15.2 ADR — Architecture Decision Records

Documento curto, versionado junto do código, registrando **uma decisão arquitetural específica**: contexto, opções consideradas, decisão tomada, consequências aceitas. O valor não é documentar a decisão — é documentar **por que as alternativas foram descartadas**, informação que se perde completamente se só o código final for versionado. Formato mínimo: título, status (proposto/aceito/superado), contexto, decisão, consequências.

### 15.3 Comentário No Código: Explique "Por Quê", Não "O Quê"

Comentário que repete o que o código já diz claramente é ruído, não documentação (`i++; // incrementa i`). Comentário que explica uma decisão não-óbvia, uma limitação conhecida, ou o motivo de um workaround estranho é valioso — o critério é sempre "isso é informação que o código não consegue carregar sozinho?".

### 15.4 Documentação de API: Contrato, Não Prosa

OpenAPI/Swagger (REST) ou schema GraphQL como fonte de verdade única, gerando documentação interativa automaticamente — documentação de API mantida manualmente em prosa separada do código sistematicamente fica desatualizada, pela mesma razão estrutural que qualquer documento humano-mantido tende a ficar (o mesmo problema já visto acontecer repetidamente com o "Estado Atual" do blueprint da Pandora).

---

## 16. Gerenciamento de Dependências

### 16.1 Versionamento Semântico (SemVer)

`MAJOR.MINOR.PATCH` — major quebra compatibilidade, minor adiciona funcionalidade compatível, patch corrige bug sem mudar comportamento esperado. O valor real do SemVer só existe se o mantenedor da dependência o respeita de verdade — trate como sinal forte, não garantia absoluta.

### 16.2 Lockfiles Não São Opcionais

`package-lock.json`/`pnpm-lock.yaml`/`Cargo.lock`/equivalente sempre versionado — sem lockfile, "funciona na minha máquina" deixa de ser piada e vira realidade estrutural, porque cada instalação pode resolver versões de dependência transitiva ligeiramente diferentes.

### 16.3 Atualização de Dependência é Trabalho Contínuo, Não Evento

Dependência desatualizada é a fonte mais comum de vulnerabilidade real em produção (Seção 8.3) — automação (Dependabot, Renovate) abrindo PR de atualização regularmente, com CI validando antes do merge, é mais sustentável que "projeto de atualização" esporádico e doloroso a cada 2 anos.

---

## 17. Inteligência Artificial na Engenharia de Software (2026)

Isso merece seção própria porque é o desenvolvimento mais recente e ainda em consolidação de todo este documento.

- **Geração de código não elimina a necessidade de entender o código gerado** — o custo se moveu de "escrever" pra "revisar e entender profundamente", e um engenheiro que aceita sugestão de IA sem entender de verdade acumula dívida técnica invisível mais rápido que antes.
- **Assistentes de IA navegam melhor código bem-modularizado** (Seção 4.1) — isso é um argumento novo, genuinamente 2026, a favor de manter fronteiras de módulo/serviço claras, além de todos os argumentos anteriores que já existiam sem IA nenhuma no processo.
- **Geração de teste (especialmente E2E, Seção 5.3) virou aplicação madura de IA** — não substitui julgamento sobre o que testar, mas reduz drasticamente o custo de escrever o teste depois que o "o quê" está definido por um humano.
- **Revisão de código assistida por IA complementa, não substitui, revisão humana** — boa pra pegar padrão óbvio/estilo/vulnerabilidade conhecida; julgamento sobre se a mudança faz sentido pro produto continua sendo trabalho humano.

---

## 18. Tutorial Completo: Aplicando Tudo a uma Feature Real

Em vez de só listar princípio, isso constrói uma feature do zero — **endpoint de cancelamento de assinatura** — tocando praticamente toda seção anterior com decisão concreta. Exemplo em TypeScript, mas cada decisão generaliza pra qualquer linguagem.

### 18.1 Design da API Primeiro (Seção 11)

```
POST /v1/subscriptions/{id}/cancel
Idempotency-Key: <uuid gerado pelo cliente>
```
`POST` porque cancelamento é uma ação, não substituição de estado completo — mas com chave de idempotência explícita (Seção 10.1/11.1) porque o cliente pode reenviar em caso de timeout, e cancelar duas vezes não pode gerar efeito colateral duplicado (ex.: dois emails de confirmação, ou reembolso duplicado).

### 18.2 Onde a Lógica Mora (Seção 4.3, Portas e Adaptadores)

```ts
// Núcleo de domínio — não importa nada de Express, Stripe, ou banco específico
interface RepositorioAssinatura {
  buscarPorId(id: string): Promise<Assinatura | null>;
  salvar(assinatura: Assinatura): Promise<void>;
}
interface ProvedorPagamento {
  cancelarCobrancaRecorrente(idExterno: string): Promise<void>;
}

async function cancelarAssinatura(
  id: string,
  repo: RepositorioAssinatura,
  pagamento: ProvedorPagamento
): Promise<Resultado<void, ErroDominio>> {
  const assinatura = await repo.buscarPorId(id);
  if (!assinatura) return erro("ASSINATURA_NAO_ENCONTRADA");
  if (assinatura.status === "cancelada") return sucesso(undefined); // idempotente por natureza do domínio
  
  await pagamento.cancelarCobrancaRecorrente(assinatura.idExterno);
  assinatura.status = "cancelada";
  await repo.salvar(assinatura);
  return sucesso(undefined);
}
```

Note o retorno como valor explícito (`Resultado<T, E>`, Seção 13.2) em vez de exceção — o chamador é forçado a lidar com o caso de erro, não pode esquecer um `catch`.

### 18.3 Segurança (Seção 8.2)

Antes de qualquer lógica de negócio rodar: o usuário autenticado é dono dessa assinatura, ou tem permissão de suporte pra agir nela? Checagem de autorização acontece **antes** de tocar em `cancelarAssinatura` — nunca depois, nunca como um "detalhe" implícito.

### 18.4 Resiliência (Seção 10)

`pagamento.cancelarCobrancaRecorrente` chama um serviço externo (Stripe, por exemplo) — precisa de retry com backoff pra falha transitória de rede, e circuit breaker se o provedor de pagamento inteiro cair. Se falhar depois de todas as tentativas, a assinatura **não** deveria ficar marcada como cancelada localmente enquanto o provedor externo ainda cobra — a ordem das operações no código de 18.2 (cancelar externo primeiro, salvar local depois) já reflete essa decisão de propósito.

### 18.5 Observabilidade (Seção 9)

```ts
logger.info("cancelamento_assinatura_iniciado", { assinaturaId: id, usuarioId });
// ... lógica ...
logger.info("cancelamento_assinatura_concluido", { assinaturaId: id, duracaoMs });
metrica.incrementar("assinaturas_canceladas_total");
```
Log estruturado (campos nomeados, não string interpolada) — permite consultar "quantos cancelamentos falharam por usuário X" sem parsing de texto livre.

### 18.6 Testes (Seção 5)

| Tamanho | O que testa aqui |
|---|---|
| Small (unidade) | `cancelarAssinatura` com repositório e provedor de pagamento **fake** — testa a lógica de decisão isolada, roda em milissegundos |
| Medium (integração) | O endpoint HTTP completo contra um banco de dados real em container, provedor de pagamento mockado |
| Large (E2E) | Um teste, não muitos: o fluxo completo contra ambiente de staging real, incluindo o provedor de pagamento em modo sandbox |

### 18.7 Git e CI (Seções 6-7)

```
feat(subscriptions): add cancellation endpoint with idempotency key

Prevents duplicate refunds on client retry after timeout.
Cancellation order: external provider first, then local state,
to avoid marking cancelled locally while still being charged
if the provider call fails.
```
PR pequeno, só essa feature — revisão focada em lógica de negócio e no motivo da ordem de operações (que o corpo do commit já explica, Seção 6.2), não em debate de formatação (já resolvido por linter automatizado).

### 18.8 O Que Ficou Provado

Uma feature de escopo modesto tocou API design, arquitetura, segurança, resiliência, observabilidade, testes em três tamanhos, e convenção de commit — não porque cada seção precisa aparecer sempre, mas porque isso é exatamente o tipo de decisão que uma feature "simples" de verdade exige quando levada a sério. É essa disciplina, aplicada consistentemente, que separa código que funciona uma vez de sistema que se sustenta em produção por anos.

---

## 19. Aplicação ao Projeto Pandora

O monorepo TypeScript da Pandora já reflete boa parte deste documento sem ter sido formalizado nesses termos: fallback em cadeia multi-provedor (Seção 10.4), migrations versionadas via Prisma (Seção 12.1), Turborepo como estrutura de monolito modular por pacotes (Seção 4.1) em vez de microsserviços prematuros, e um histórico de revisão que já funciona quase como uma série de ADRs informais (Seção 15.2) — cada entrada registra contexto, causa raiz e decisão, só falta o formato dedicado.

**Onde vale atenção, considerando este documento**: o padrão de retry/circuit breaker do fallback de IA (já existe) poderia se generalizar formalmente pra qualquer chamada externa crítica, não só provedor de IA; e as correções de bug documentadas no histórico de revisão (ex.: v2.6.1, v2.6.3) são material bruto perfeito pra virarem ADRs retroativos formais, deixando "por que essa decisão" pesquisável sem precisar vasculhar o registro de revisões inteiro.

---

## 20. Checklist — Antes de Chamar uma Feature de "Pronta"

- [ ] Nomenclatura revela intenção; função faz uma coisa que dá pra descrever numa frase (Seção 2)
- [ ] Nenhuma abstração nova foi criada antes da terceira ocorrência real do padrão (Seção 3, regra dos três)
- [ ] Decisão de arquitetura (novo serviço vs. módulo no monolito) justificada por sinal real, não por moda (Seção 4.1)
- [ ] Teste no tamanho certo pra cada camada de risco — não só unidade, não só E2E (Seção 5)
- [ ] Commit segue convenção e o corpo explica o "porquê" (Seção 6.2)
- [ ] Autorização checada antes da lógica de negócio rodar, nunca depois (Seção 8.2)
- [ ] Toda chamada externa tem timeout, retry com backoff+jitter, e é segura pra repetir (idempotência) — Seção 10
- [ ] Erro tratado nunca é silenciosamente engolido; mensagem ao usuário nunca vaza detalhe interno (Seção 13)
- [ ] Configuração sensível em variável de ambiente, nunca em código versionado (Seção 14)
- [ ] Dependência nova adicionada com lockfile atualizado e versionamento semântico respeitado (Seção 16)

---

## 21. Fontes e Leituras Principais

- Martin, R. C. — *Clean Code*; críticas contemporâneas de engenheiros seniores sobre abstração excessiva e conteúdo datado
- Metz, S. — princípio de que duplicação é mais barata que abstração errada
- Fowler, M. — arquitetura evolutiva, "monolito primeiro", padrão Strangler Fig
- Evans, E. — Domain-Driven Design
- Cockburn, A. — Arquitetura Hexagonal (Portas e Adaptadores)
- Cohn, M. — Pirâmide de Testes original
- *Software Engineering at Google* — modelo de tamanho de teste Small/Medium/Large, tensão hermeticidade vs. fidelidade
- Nygard, M. — *Release It!*, origem do padrão Circuit Breaker
- OWASP Foundation — Top 10 (2025), Application Security Verification Standard
- Wiggins, A. — Metodologia Twelve-Factor App (Heroku)
- Conway, M. — Lei de Conway
- RFC 9457 (Problem Details for HTTP APIs), RFC 10008 (método QUERY)
- Fielding, R. — dissertação original definindo REST
