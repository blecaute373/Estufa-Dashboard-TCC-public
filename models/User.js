const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true, lowercase: true },
  email:    { type: String, unique: true, required: true, lowercase: true },
  password_hash: { type: String, required: true },
  is_active: { type: Boolean, default: true },
  last_login: { type: Date, default: null },
}, { timestamps: { createdAt: 'created_at' } });

module.exports = mongoose.model('User', userSchema);