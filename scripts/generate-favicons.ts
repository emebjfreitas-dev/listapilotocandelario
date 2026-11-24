import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

/**
 * Gera o SVG oficial da identidade visual do Lista Piloto (EMEB Candelário 2027)
 * com paleta Azul-Marinho Institucional (#081326 -> #1649a8), Ficha Escolar Branca
 * e Selo de Frequência/Chamada Esmeralda (#10b981 / #047857) + detalhe Dourado (#fbbf24).
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

  if (microDetail) {
    // Versão de altíssimo contraste otimizada para 16x16, 32x32 e 48x48
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgMicro" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0b1f44" />
      <stop offset="55%" stop-color="#14428c" />
      <stop offset="100%" stop-color="#1d4ed8" />
    </linearGradient>
    <linearGradient id="checkMicro" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#10b981" />
      <stop offset="100%" stop-color="#047857" />
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="512" height="512" rx="112" fill="url(#bgMicro)" />
  <!-- Ficha / Lista Principal Simplificada -->
  <rect x="96" y="88" width="280" height="336" rx="44" fill="#ffffff" />
  <rect x="138" y="148" width="196" height="38" rx="19" fill="#14428c" />
  <rect x="138" y="218" width="150" height="34" rx="17" fill="#93c5fd" />
  <rect x="138" y="284" width="118" height="34" rx="17" fill="#cbd5e1" />
  <!-- Selo Verde de Presença -->
  <circle cx="356" cy="356" r="108" fill="#081326" />
  <circle cx="356" cy="356" r="90" fill="url(#checkMicro)" />
  <path d="M312 358 L344 390 L404 322" fill="none" stroke="#ffffff" stroke-width="32" stroke-linecap="round" stroke-linejoin="round" />
</svg>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="lpBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#081326" />
      <stop offset="52%" stop-color="#0e3a8a" />
      <stop offset="100%" stop-color="#1d4ed8" />
    </linearGradient>
    <radialGradient id="lpGlow" cx="30%" cy="22%" r="72%">
      <stop offset="0%" stop-color="#60a5fa" stop-opacity="0.28" />
      <stop offset="100%" stop-color="#081326" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="lpCard" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="100%" stop-color="#eef4ff" />
    </linearGradient>
    <linearGradient id="lpBadge" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#10b981" />
      <stop offset="100%" stop-color="#047857" />
    </linearGradient>
    <linearGradient id="lpGold" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#fbbf24" />
      <stop offset="100%" stop-color="#f59e0b" />
    </linearGradient>
  </defs>

  <!-- Fundo Azul-Marinho Institucional -->
  <rect x="0" y="0" width="512" height="512" rx="${clipRx}" fill="url(#lpBg)" />
  <rect x="0" y="0" width="512" height="512" rx="${clipRx}" fill="url(#lpGlow)" />

  <g ${transformAttr}>
    <!-- Sombra suave da ficha de chamada -->
    <rect x="114" y="106" width="268" height="324" rx="40" fill="#040b18" opacity="0.34" />

    <!-- Ficha / Prancheta Institucional do Lista Piloto -->
    <rect x="104" y="92" width="268" height="324" rx="40" fill="url(#lpCard)" />

    <!-- Topo Cobalt da Ficha + Presilha Dourada -->
    <path d="M104 132 C104 109.9 121.9 92 144 92 L332 92 C354.1 92 372 109.9 372 132 L372 162 L104 162 Z" fill="#14428c" />
    <rect x="184" y="70" width="108" height="36" rx="18" fill="url(#lpGold)" />
    <circle cx="238" cy="88" r="7" fill="#081326" />

    <!-- Linhas da Lista Nominal & Indicadores -->
    <circle cx="152" cy="212" r="14" fill="#1649a8" />
    <rect x="182" y="200" width="144" height="24" rx="12" fill="#0f172a" opacity="0.88" />

    <circle cx="152" cy="272" r="14" fill="#38bdf8" />
    <rect x="182" y="260" width="124" height="24" rx="12" fill="#334155" opacity="0.72" />

    <circle cx="152" cy="332" r="14" fill="#94a3b8" />
    <rect x="182" y="320" width="96" height="24" rx="12" fill="#64748b" opacity="0.55" />

    <!-- Selo de Frequência Confirmada (Esmeralda) -->
    <circle cx="352" cy="352" r="88" fill="#0a1f47" />
    <circle cx="352" cy="352" r="74" fill="url(#lpBadge)" />
    <path
      d="M316 354 L341 379 L392 324"
      fill="none"
      stroke="#ffffff"
      stroke-width="22"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
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

  console.log('Generating Lista Piloto favicons & Apple Touch / PWA PNG icons...');

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
      .flatten({ background: { r: 8, g: 19, b: 38 } })
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
    .flatten({ background: { r: 8, g: 19, b: 38 } })
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
