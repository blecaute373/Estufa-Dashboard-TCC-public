const mongoose = require('mongoose');
// Fonte única de verdade para os enums: `lib/` não depende de Mongoose (§4.3),
// logo é esta camada que define o domínio e o schema limita-se a espelhá-lo.
const { SOURCES, LEVELS } = require('../lib/syslog');

/**
 * SystemLog — registo técnico/diagnóstico (ao contrário do AccessLog, que é
 * auditoria de acessos).
 *
 * Separação deliberada: o AccessLog é escrito pelo servidor e é fiável; o
 * SystemLog pode ter `source: 'esp'`, que chega por MQTT através de um broker
 * sem autenticação na LAN — não é autoritativo (ver ADR-0008).
 *
 * Dois timestamps, com finalidades distintas:
 * - `created_at`  → quando o **aconteceu** (vem do `lib/syslog.js`).
 * - `inserted_at` → quando foi **gravado** (timestamps do Mongoose).
 * Persistir apenas a hora de escrita perderia a hora real de eventos que
 * chegam com atraso (ex.: via MQTT após queda de rede).
 */
const systemLogSchema = new mongoose.Schema(
  {
    created_at: { type: Date, required: true, default: Date.now },
    source: { type: String, required: true, enum: SOURCES, index: true },
    level: { type: String, required: true, enum: LEVELS, default: 'info' },
    tag: { type: String, default: null }, // 'WIFI', 'MQTT_LOCAL', 'SENSORES', 'TS'…
    message: { type: String, required: true },
    data: { type: String, default: null }, // JSON opcional com contexto
  },
  { timestamps: { createdAt: 'inserted_at', updatedAt: false } }
);

systemLogSchema.index({ source: 1, created_at: -1 });
systemLogSchema.index({ level: 1, created_at: -1 });
// TTL: um único campo — não pode ser composto. O índice serve também o sort
// descendente por data (índice ascendente usado ao contrário).
systemLogSchema.index(
  { created_at: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60, name: 'system_log_ttl_30d' }
);

module.exports = mongoose.model('SystemLog', systemLogSchema);