/**
 * Estufa 01 — QR code de download do APK (página de entrada)
 *
 * Estava inline em `index.html`, depois do `<script src="/js/qrcode.min.js">`
 * — a dependência do global `QRCode` é a razão para a ordem de carregamento
 * se manter: `qrcode.min.js`, depois este ficheiro.
 */
'use strict';

/* Aponta para o download direto do APK (GitHub Releases). Publique o APK numa
   release com o nome exato "estufa01.apk" — o link abaixo passa a baixá-lo. */
(function () {
  const APP_DOWNLOAD_URL = 'https://github.com/matheusbritogarbin-byte/Estufa-Dashboard-TCC/releases/latest/download/estufa01.apk';
  const link = document.getElementById('appQrLink');   // fallback clicável (mantém-se em sincronia)
  if (link) link.href = APP_DOWNLOAD_URL;

  const el = document.getElementById('appQr');
  if (!el || typeof QRCode === 'undefined') return;

  new QRCode(el, {
    text: APP_DOWNLOAD_URL,
    width: 180,                    // maior = módulos maiores = leitura mais fiável
    height: 180,
    colorDark: '#000000',          // contraste máximo
    colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.M
  });
})();
