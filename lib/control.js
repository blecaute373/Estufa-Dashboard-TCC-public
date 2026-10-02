/**
 * Estufa 01 — Contrato dos comandos de atuadores (ENGENHARIA §5, §18.3)
 *
 * Fonte única da regra de negócio "(actuator, action) -> payload" usada por
 * AMBOS os caminhos de entrega (ENGENHARIA §3 — DRY com 2 ocorrências reais):
 *   - local  (`server.js`): publica o payload num tópico MQTT do broker da estufa
 *   - nuvem  (`api/control.js`): enfileira o payload para o ESP32 buscar
 *
 * Formato consumido pelo firmware (ver BLUEPRINT §11.1.1):
 *   vent/valve: {command:'ON'|'OFF'|'AUTO'}
 *   light:      {duty:0-100} ou {command:'AUTO'}
 *
 * Comandos são **idempotentes por natureza** (definem estado, não incrementam),
 * portanto reentrega é inofensiva — condição que permite retry sem chave de
 * idempotência (ENGENHARIA §11.1).
 */
'use strict';

const TOPICOS = {
  vent:   'fazenda/estufa01/atuador/vent_001/comando',
  valve:  'fazenda/estufa01/atuador/valv_001/comando',
  light:  'fazenda/estufa01/atuador/ilum_001/comando',
  // Atuador lógico: não aciona hardware — congela/retoma TODA a automação no
  // firmware (PAUSE/AUTO). Existe para o caminho da fila ter o mesmo contrato
  // do caminho MQTT direto do navegador (que publica no mesmo tópico).
  global: 'fazenda/estufa01/atuador/global_001/comando',
};

/**
 * Duty do actuator `light`: aceita `number` finito ou string numérica
 * estritamente formatada.
 *
 * Porque validação ESTRITA e não `Number(action)`: a coerção do JavaScript
 * transforma valores que o utilizador nunca quis em números válidos —
 * `Number([])` é 0, `Number(true)` é 1, `Number(null)` é 0. Todos passavam
 * a validação anterior e iam parar ao firmware como `{duty: 0}`. É
 * falha-silenciosa num atuador real (ENGENHARIA §9.2 Validação de input).
 *
 * @returns {number | null} `null` se não for um duty válido.
 */
function normalizarDuty(action) {
  if (typeof action === 'number') {
    return Number.isFinite(action) ? action : null;
  }
  // Só string com dígitos (e no máximo um ponto decimal). Rejeita '', ' 50 ',
  // '1e3', '0x10', '50px', '+50', arrays e objetos.
  if (typeof action !== 'string' || !/^\d{1,3}(\.\d+)?$/.test(action)) return null;
  const duty = Number(action);
  return Number.isFinite(duty) ? duty : null;
}

/**
 * Valida e normaliza a ação pedida.
 * @returns {{ payload: object } | { erro: string }}
 */
function validarComando(actuator, action) {
  if (!TOPICOS[actuator]) return { erro: 'Actuator invalido.' };

  if (actuator === 'global') {
    // Interruptor geral da automação: 'pause' (ou 'off') congela, 'auto' retoma.
    // Não usa ON/OFF semântico porque não há estado de hardware a "ligar".
    if (action === 'auto') return { payload: { command: 'AUTO' } };
    if (action === 'pause' || action === 'off') return { payload: { command: 'PAUSE' } };
    return { erro: 'action de global deve ser "pause" (pausar) ou "auto" (retomar).' };
  }

  if (actuator === 'light') {
    if (action === 'auto') return { payload: { command: 'AUTO' } };
    const duty = normalizarDuty(action);
    if (duty === null)
      return { erro: 'action de light deve ser um numero (duty 0-100) ou "auto".' };
    return { payload: { duty: Math.max(0, Math.min(100, duty)) } };
  }

  if (action === 'auto') return { payload: { command: 'AUTO' } };
  if (action === 'on')   return { payload: { command: 'ON' } };
  if (action === 'off')  return { payload: { command: 'OFF' } };
  return { erro: 'action deve ser "on", "off" ou "auto".' };
}

/** Caminho local: comando completo com tópico MQTT. */
function montarComando(actuator, action) {
  const validacao = validarComando(actuator, action);
  if (validacao.erro) return validacao;
  return { topico: TOPICOS[actuator], payload: validacao.payload };
}

module.exports = { TOPICOS, validarComando, montarComando, normalizarDuty };
