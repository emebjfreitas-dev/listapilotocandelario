import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

/**
 * Gera o SVG oficial da identidade visual com o Brasão de Jundiaí de Alta Definição
 * (EMEB Prof. Joaquim Candelário de Freitas 2027) com fundo Azul-Marinho Institucional
 * (#060e1e -> #1649a8), anel dourado elegante e o Brasão Oficial centralizado.
 */
function buildBrandSvg(options: {
  roundedCorners: boolean;
  scaleFactor?: number;
  microDetail?: boolean;
}): string {
  const { roundedCorners, scaleFactor = 1, microDetail = false } = options;
  const clipRx = roundedCorners ? 116 : 0;
  const cx = 256;
  const cy = 256;
  const transformAttr =
    scaleFactor !== 1
      ? `transform="translate(${cx}, ${cy}) scale(${scaleFactor}) translate(-${cx}, -${cy})"`
      : '';

  const brasaoPath = path.resolve('public', 'brasao-jundiai.png');
  const brasaoBase64 = fs.existsSync(brasaoPath)
    ? `data:image/png;base64,${fs.readFileSync(brasaoPath).toString('base64')}`
    : '';

  if (microDetail) {
    // Versão de altíssimo contraste otimizada para 16x16, 32x32 e 48x48
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgMicro" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#060e1e" />
      <stop offset="100%" stop-color="#14428c" />
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="512" height="512" rx="112" fill="url(#bgMicro)" />
  ${brasaoBase64 ? `<image href="${brasaoBase64}" x="40" y="40" width="432" height="432" preserveAspectRatio="xMidYMid meet" />` : ''}
</svg>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="lpBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#060e1e" />
      <stop offset="48%" stop-color="#0c2550" />
      <stop offset="100%" stop-color="#1649a8" />
    </linearGradient>
    <radialGradient id="lpGlow" cx="35%" cy="25%" r="75%">
      <stop offset="0%" stop-color="#60a5fa" stop-opacity="0.32" />
      <stop offset="100%" stop-color="#060e1e" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="goldRing" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fde047" />
      <stop offset="50%" stop-color="#f59e0b" />
      <stop offset="100%" stop-color="#d97706" />
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#020617" flood-opacity="0.45" />
    </filter>
  </defs>

  <!-- Fundo Azul-Marinho Institucional com Brilho -->
  <rect x="0" y="0" width="512" height="512" rx="${clipRx}" fill="url(#lpBg)" />
  <rect x="0" y="0" width="512" height="512" rx="${clipRx}" fill="url(#lpGlow)" />

  <g ${transformAttr}>
    <!-- Círculo de Fundo Elegante com Borda Dourada / Anel Institucional -->
    <circle cx="256" cy="256" r="208" fill="#ffffff" filter="url(#shadow)" />
    <circle cx="256" cy="256" r="208" fill="none" stroke="url(#goldRing)" stroke-width="8" />

    <!-- Brasão de Jundiaí Oficial Centralizado em Alta Definição -->
    ${brasaoBase64 ? `<image href="${brasaoBase64}" x="76" y="76" width="360" height="360" preserveAspectRatio="xMidYMid meet" />` : ''}
  </g>
</svg>`;
}

async function generateFavicons() {
  const publicDir = path.resolve('public');

  // 1. Gravar favicon.svg vetorial oficial
  const masterSvg = buildBrandSvg({ roundedCorners: true });
  const microSvg = buildBrandSvg({ roundedCorners: true, microDetail: true });
  const fullBleedSvg = buildBrandSvg({ roundedCorners: false });
  const maskableSvg = buildBrandSvg({ roundedCorners: false, scaleFactor: 0.78 });

  fs.writeFileSync(path.join(publicDir, 'favicon.svg'), masterSvg, 'utf8');

  console.log('Generating Lista Piloto favicons & Apple Touch / PWA PNG icons with Official Jundiaí Coat of Arms...');

  const microSizes = [16, 32, 48];
  const pngBuffers: Record<number, Buffer> = {};

  for (const size of microSizes) {
    const png = await sharp(Buffer.from(microSvg))
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9 })
      .toBuffer();

    pngBuffers[size] = png;

    if (size === 16) {
      fs.writeFileSync(path.join(publicDir, 'favicon-16x16.png'), png);
    } else if (size === 32) {
      fs.writeFileSync(path.join(publicDir, 'favicon-32x32.png'), png);
    }
  }

  // PWA padrão (192x192 e 512x512 com cantos arredondados)
  for (const size of [192, 512]) {
    const png = await sharp(Buffer.from(masterSvg))
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9 })
      .toBuffer();

    if (size === 192) {
      fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), png);
    } else {
      fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), png);
    }
  }

  // Conjunto completo de Ícones de Toque Apple (180x180 principal + tamanhos 167x167, 152x152, 120x120)
  // iOS exige PNG 100% opaco (sem canal alpha) com preenchimento integral para a máscara squircle do sistema
  const appleSizes = [180, 167, 152, 120];
  for (const size of appleSizes) {
    const applePng = await sharp(Buffer.from(fullBleedSvg))
      .resize(size, size, { fit: 'cover' })
      .flatten({ background: { r: 6, g: 14, b: 30 } })
      .removeAlpha()
      .png({ compressionLevel: 9 })
      .toBuffer();

    if (size === 180) {
      fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), applePng);
      fs.writeFileSync(path.join(publicDir, 'apple-touch-icon-180x180.png'), applePng);
    } else {
      fs.writeFileSync(path.join(publicDir, `apple-touch-icon-${size}x${size}.png`), applePng);
    }
  }

  // Android Maskable Icon (512x512) — Safe zone ~78% centralizado em fundo azul-marinho opaco
  const pwaMaskableIcon = await sharp(Buffer.from(maskableSvg))
    .resize(512, 512, { fit: 'cover' })
    .flatten({ background: { r: 6, g: 14, b: 30 } })
    .removeAlpha()
    .png({ compressionLevel: 9 })
    .toBuffer();

  fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), pwaMaskableIcon);

  // ICO multi-resolução (16x16, 32x32, 48x48)
  console.log('Building binary multi-resolution favicon.ico (16x16, 32x32, 48x48)...');
  const icoSizes = [16, 32, 48];
  const count = icoSizes.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  let offset = headerSize + dirEntrySize * count;

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);

  const dirEntries: Buffer[] = [];
  const imageBuffers: Buffer[] = [];

  for (const s of icoSizes) {
    const buf = pngBuffers[s];
    const entry = Buffer.alloc(dirEntrySize);
    entry.writeUInt8(s === 256 ? 0 : s, 0);
    entry.writeUInt8(s === 256 ? 0 : s, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(buf.length, 8);
    entry.writeUInt32LE(offset, 12);
    dirEntries.push(entry);
    imageBuffers.push(buf);
    offset += buf.length;
  }

  const icoBuffer = Buffer.concat([header, ...dirEntries, ...imageBuffers]);
  fs.writeFileSync(path.join(publicDir, 'favicon.ico'), icoBuffer);

  console.log('Favicon & iOS/PWA icon generation completed successfully!');
  console.log('Generated:');
  console.log(' - public/favicon.svg');
  console.log(' - public/favicon.ico (' + icoBuffer.length + ' bytes)');
  console.log(' - public/favicon-16x16.png');
  console.log(' - public/favicon-32x32.png');
  console.log(' - public/apple-touch-icon.png (180x180 opaque iOS-ready)');
  console.log(' - public/apple-touch-icon-180x180.png / 167x167 / 152x152 / 120x120');
  console.log(' - public/pwa-192x192.png');
  console.log(' - public/pwa-512x512.png');
  console.log(' - public/pwa-maskable-512x512.png (512x512 opaque safe-zone)');
}

generateFavicons().catch((err) => {
  console.error('Error generating favicons:', err);
  process.exit(1);
});
