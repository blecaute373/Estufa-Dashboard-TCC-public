/**
 * Script para tornar um usuário admin no MongoDB
 * Uso: node scripts/make-admin.js <username>
 *
 * Exemplo: node scripts/make-admin.js admin
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mongoose = require('mongoose');

async function main() {
  const username = process.argv[2];
  if (!username) {
    console.error('Uso: node scripts/make-admin.js <username>');
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI não definida no .env');
    process.exit(1);
  }

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
    console.log('[DB] Conectado ao MongoDB');

    const user = await mongoose.connection.db.collection('users').findOneAndUpdate(
      { username: username.toLowerCase() },
      { $set: { is_admin: true } },
      { returnDocument: 'after' }
    );

    if (!user) {
      console.error(`Usuário "${username}" não encontrado.`);
      process.exit(1);
    }

    console.log(`✅ Usuário "${username}" agora é ADMIN!`);
    console.log(`   Email: ${user.email}`);
    console.log(`   is_admin: ${user.is_admin}`);
    
    console.log('\n⚠️  IMPORTANTE: Faça logout e login novamente no site!');
    console.log('   O token JWT antigo não tem a permissão de admin.');
    
    await mongoose.disconnect();
  } catch (err) {
    console.error('Erro:', err.message);
    process.exit(1);
  }
}

main();