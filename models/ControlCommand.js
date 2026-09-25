const mongoose = require('mongoose');

/**
 * Fila de comandos de atuadores (ADR-0007).
 *
 * Controlador (Vercel) grava `pending`; o firmware recolhe no proximo poll e
 * o documento passa a `delivered`.
 *
 * - `expires_at` com TTL index: o MongoDB apaga sozinho o que nao foi buscado
 *   (retencao com prazo definido, ENGENHARIA §9.5), sem job de limpeza.
 * - indice composto serve a consulta exata do poll (device + status + validade).
 */
const controlCommandSchema = new mongoose.Schema({
  device:    { type: String, required: true, default: 'estufa01', index: true },
  actuator:  { type: String, required: true, index: true },   // vent | valve | light
  action:    { type: String, required: true },                 // on | off | auto | 0-100
  payload:   { type: mongoose.Schema.Types.Mixed, required: true },
  status:    { type: String, enum: ['pending', 'delivered'], default: 'pending', index: true },
  user_id:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  username:  { type: String, default: null },
  delivered_at: { type: Date, default: null },
  expires_at:   { type: Date, required: true },
}, { timestamps: { createdAt: 'created_at' } });

// Limpeza automatica: documento expira sozinho (comando nunca entregue morre).
controlCommandSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });
// Consulta do poll: pendentes de um dispositivo, do mais antigo para o mais novo.
controlCommandSchema.index({ device: 1, status: 1, created_at: 1 });

module.exports = mongoose.model('ControlCommand', controlCommandSchema);
