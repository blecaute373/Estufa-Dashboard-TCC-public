/**
 * Conexão MongoDB (singleton para serverless)
 */
const mongoose = require('mongoose');

let cached = global.mongoose;
if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
  if (cached.conn) return cached.conn;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI não definida nas variáveis ambiente');
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(uri, {
      bufferCommands: false,
      maxPoolSize: 1, // critical para serverless
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 30000,
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

module.exports = connectDB;