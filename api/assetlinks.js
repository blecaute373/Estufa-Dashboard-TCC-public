// GET /api/assetlinks — serve o Digital Asset Links do TWA.
// Motivo: `public/.well-known/assetlinks.json` nunca chega ao bundle do deploy
// (o Vercel ignora pastas com ponto inicial na recolha de estaticos), por isso
// uma rota `dest: /public/...` dava sempre 404. Servir por funcao elimina a
// dependencia do ficheiro estar no bundle: o fingerprint vive no codigo.

const { ASSETLINKS_FINGERPRINT } = require('../lib/config');

module.exports = (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.status(200).json([
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: 'com.estufa.dashboard',
        sha256_cert_fingerprints: [ASSETLINKS_FINGERPRINT],
      },
    },
  ]);
};
