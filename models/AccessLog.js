const mongoose = require('mongoose');

const accessLogSchema = new mongoose.Schema({
  user_id:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  username:  { type: String, default: null },
  event:     { type: String, required: true }, // login, logout, register, failed_login
  ip_address: { type: String, default: 'unknown' },
  user_agent: { type: String, default: 'unknown' },
  details:   { type: String, default: null },
}, { timestamps: { createdAt: 'created_at' } });

accessLogSchema.index({ user_id: 1 });
accessLogSchema.index({ event: 1 });
accessLogSchema.index({ created_at: -1 });

module.exports = mongoose.model('AccessLog', accessLogSchema);