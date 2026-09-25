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
  vent:  'fazenda/estufa01/atuador/vent_001/comando',
  valve: 'fazenda/estufa01/atuador/valv_001/comando',
  light: 'fazenda/estufa01/atuador/ilum_001/comando',
};

/**
 * Valida e normaliza a ação pedida.
 * @returns {{ payload: object } | { erro: string }}
 */
function validarComando(actuator, action) {
  if (!TOPICOS[actuator]) return { erro: 'Actuator invalido.' };

  if (actuator === 'light') {
    if (action === 'auto') return { payload: { command: 'AUTO' } };
    const duty = Math.max(0, Math.min(100, Number(action)));
    if (Number.isNaN(duty))
      return { erro: 'action de light deve ser um numero (duty 0-100) ou "auto".' };
    return { payload: { duty } };
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

module.exports = { TOPICOS, validarComando, montarComando };
