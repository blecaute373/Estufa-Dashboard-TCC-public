/**
 * Estufa 01 — Cache em memória com TTL (ENGENHARIA §5.6 / §10)
 *
 * PORQUÊ um cache aqui (e não uma "micro-optimização"):
 *
 * O dashboard faz polling a `/api/thingspeak/*` a cada 16 s — por utilizador.
 * Num cenário normal (browser do PC + PWA do telemóvel + app Electron) o mesmo
 * feed é pedido várias vezes por ciclo, e cada pedido é um HTTPS com timeout e
 * até 3 tentativas contra o ThingSpeak. O canal publica, no máximo, a cada
 * **15 s** (limite do plano grátis) — logo servir a mesma leitura durante 8 s
 * não devolve dado mais velho do que aquele que o sensor já tem.
 *
 * Dois mecanismos, ambos testáveis sem rede:
 *
 *   1. TTL — dentro da janela, devolve o valor guardado (0 idas ao upstream).
 *   2. Coalescência — N pedidos simultâneos com a cache fria partilham UMA
 *      ida ao upstream. Sem isto, três clientes a abrir o dashboard ao mesmo
 *      tempo custavam três chamadas em vez de uma.
 *
 * O que NÃO se faz de propósito:
 *
 *   - Não se cacheia falha. Se o fetch lançar, a promessa rejeita e nada é
 *     guardado; a tentativa seguinte volta a bater no upstream. Fixar um erro
 *     transitório durante 8 s seria pior do que não ter cache nenhum.
 *   - Não há TTL por chave nem persistência: é um acelerador, não uma base de
 *     dados. A memória da função serverless tem de ficar limitada (`max`), e
 *     a entrada mais antiga é evictada quando o limite é atingido.
 */
'use strict';

const TTL_PADRAO_MS = 8000;
const MAX_PADRAO = 32;

/**
 * @param {{ ttlMs?: number, max?: number, agora?: () => number }} [opcoes]
 *   `agora` é injectável para o teste do TTL não depender de `setTimeout`.
 * @returns {{ get: Function, set: Function, obterOuCarregar: Function, tamanho: Function, limpar: Function }}
 */
function criarCacheTtl({ ttlMs = TTL_PADRAO_MS, max = MAX_PADRAO, agora = Date.now } = {}) {
  const itens = new Map();  // chave -> { valor, expiraEm }
  const emVoo = new Map();  // chave -> promessa em curso (coalescência)

  function get(chave) {
    const item = itens.get(chave);
    if (!item) return undefined;
    if (item.expiraEm <= agora()) {
      // Expirado: liberta já, em vez de ocupar lugar até à evicção seguinte.
      itens.delete(chave);
      return undefined;
    }
    return item.valor;
  }

  function set(chave, valor) {
    // `Map` preserva a ordem de inserção, portanto a primeira chave é a mais
    // antiga — é essa que sai quando o limite é atingido.
    if (!itens.has(chave) && itens.size >= max) {
      const maisAntiga = itens.keys().next().value;
      itens.delete(maisAntiga);
    }
    itens.set(chave, { valor, expiraEm: agora() + ttlMs });
    return valor;
  }

  async function obterOuCarregar(chave, carregar) {
    const cacheado = get(chave);
    if (cacheado !== undefined) return cacheado;

    // Coalescência: quem chega enquanto o primeiro pedido está em curso espera
    // pela MESMA promessa, em vez de repetir a chamada ao upstream.
    const pendente = emVoo.get(chave);
    if (pendente) return pendente;

    const promessa = (async () => {
      try {
        // `set` só corre depois de o valor existir: um erro propaga-se sem
        // deixar nada em cache (`finally` limpa a coalescência nos dois casos).
        return set(chave, await carregar());
      } finally {
        emVoo.delete(chave);
      }
    })();

    emVoo.set(chave, promessa);
    return promessa;
  }

  return {
    get,
    set,
    obterOuCarregar,
    tamanho: () => itens.size,
    limpar: () => { itens.clear(); emVoo.clear(); },
  };
}

/**
 * Cabeçalho `Cache-Control` coerente com o TTL do cache de servidor: o browser
 * (e o PWA) deixam de repetir o pedido dentro da mesma janela — a poupança
 * começa antes de chegar ao servidor.
 */
function cacheControlPublico(ttlMs = TTL_PADRAO_MS) {
  return `public, max-age=${Math.max(0, Math.floor(ttlMs / 1000))}`;
}

module.exports = { TTL_PADRAO_MS, MAX_PADRAO, criarCacheTtl, cacheControlPublico };
