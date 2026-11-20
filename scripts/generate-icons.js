// scripts/generate-icons.js
// Run: node scripts/generate-icons.js
import sharp from 'sharp';
import { mkdirSync } from 'fs';
import { join } from 'path';

const outDir = join(process.cwd(), 'public', 'icons');
mkdirSync(outDir, { recursive: true });

async function generateIcon(size) {
  const cornerRadius = Math.round(size * 0.195);
  const letterASize = Math.round(size * 0.42);
  const letterAY = Math.round(size * 0.52);
  const brandSize = Math.round(size * 0.09);
  const brandY = Math.round(size * 0.88);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1a6b3c"/>
      <stop offset="100%" style="stop-color:#0f4a25"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${cornerRadius}" fill="url(#bg)"/>
  <text x="${size/2}" y="${letterAY}" font-family="Arial,Helvetica,sans-serif" font-size="${letterASize}" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="central">A</text>
  <rect x="${size*0.2}" y="${brandY - brandSize}" width="${size*0.6}" height="${brandSize * 1.3}" fill="#0f4a25" rx="${brandSize * 0.2}"/>
  <text x="${size/2}" y="${brandY}" font-family="Arial,Helvetica,sans-serif" font-size="${brandSize}" font-weight="bold" fill="#a8e6cf" text-anchor="middle" dominant-baseline="central" letter-spacing="${size * 0.02}">AGRILUX</text>
</svg>`;

  await sharp(Buffer.from(svg))
    .png()
    .toFile(join(outDir, `icon-${size}x${size}.png`));

  console.log(`Generated icon-${size}x${size}.png`);
}

// Also generate the base icon.svg as PNG for apple-touch-icon
async function generateAppleTouchIcon() {
  const size = 180;
  const cornerRadius = Math.round(size * 0.195);
  const letterASize = Math.round(size * 0.42);
  const letterAY = Math.round(size * 0.52);
  const brandSize = Math.round(size * 0.09);
  const brandY = Math.round(size * 0.88);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1a6b3c"/>
      <stop offset="100%" style="stop-color:#0f4a25"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${cornerRadius}" fill="url(#bg)"/>
  <text x="${size/2}" y="${letterAY}" font-family="Arial,Helvetica,sans-serif" font-size="${letterASize}" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="central">A</text>
  <rect x="${size*0.2}" y="${brandY - brandSize}" width="${size*0.6}" height="${brandSize * 1.3}" fill="#0f4a25" rx="${brandSize * 0.2}"/>
  <text x="${size/2}" y="${brandY}" font-family="Arial,Helvetica,sans-serif" font-size="${brandSize}" font-weight="bold" fill="#a8e6cf" text-anchor="middle" dominant-baseline="central" letter-spacing="${size * 0.02}">AGRILUX</text>
</svg>`;

  await sharp(Buffer.from(svg))
    .png()
    .toFile(join(outDir, 'apple-touch-icon.png'));

  console.log('Generated apple-touch-icon.png');
}

await Promise.all([
  generateIcon(192),
  generateIcon(512),
  generateAppleTouchIcon(),
]);

console.log('All icons generated!');
