import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const resDir = join(process.cwd(), 'android', 'app', 'src', 'main', 'res');

// SVG template for the full icon (ic_launcher & ic_launcher_round)
function getFullIconSvg(size) {
  const cornerRadius = Math.round(size * 0.195);
  const letterASize = Math.round(size * 0.42);
  const letterAY = Math.round(size * 0.52);
  const brandSize = Math.round(size * 0.09);
  const brandY = Math.round(size * 0.88);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
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
}

// SVG template for adaptive foreground (centered transparent background, 108x108 grid system)
function getForegroundIconSvg(size) {
  const letterASize = Math.round(size * 0.42);
  const letterAY = Math.round(size * 0.45);
  const brandSize = Math.round(size * 0.08);
  const brandY = Math.round(size * 0.85);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <text x="${size/2}" y="${letterAY}" font-family="Arial,Helvetica,sans-serif" font-size="${letterASize}" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="central">A</text>
  <text x="${size/2}" y="${brandY}" font-family="Arial,Helvetica,sans-serif" font-size="${brandSize}" font-weight="bold" fill="#a8e6cf" text-anchor="middle" dominant-baseline="central" letter-spacing="${size * 0.02}">AGRILUX</text>
</svg>`;
}

const launcherSizes = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
};

const foregroundSizes = {
  'mipmap-mdpi': 108,
  'mipmap-hdpi': 162,
  'mipmap-xhdpi': 216,
  'mipmap-xxhdpi': 288,
  'mipmap-xxxhdpi': 432,
};

async function main() {
  console.log('Generating Android Mipmap Icons...');

  for (const [folder, size] of Object.entries(launcherSizes)) {
    const dir = join(resDir, folder);
    mkdirSync(dir, { recursive: true });

    // ic_launcher.png
    const fullSvg = getFullIconSvg(size);
    await sharp(Buffer.from(fullSvg)).png().toFile(join(dir, 'ic_launcher.png'));
    await sharp(Buffer.from(fullSvg)).png().toFile(join(dir, 'ic_launcher_round.png'));

    // ic_launcher_foreground.png
    const fgSize = foregroundSizes[folder];
    const fgSvg = getForegroundIconSvg(fgSize);
    await sharp(Buffer.from(fgSvg)).png().toFile(join(dir, 'ic_launcher_foreground.png'));

    console.log(`Updated icons in ${folder} (${size}x${size} launcher, ${fgSize}x${fgSize} foreground)`);
  }

  // Also update ic_launcher_background.xml color to #1a6b3c
  const bgXmlPath = join(resDir, 'values', 'ic_launcher_background.xml');
  const bgXmlContent = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#1a6b3c</color>
</resources>
`;
  writeFileSync(bgXmlPath, bgXmlContent, 'utf-8');
  console.log('Updated ic_launcher_background.xml color to #1a6b3c');

  // Generate 512x512 play store icon in public/icons/play-store-icon.png just in case
  const storeIconDir = join(process.cwd(), 'public', 'icons');
  mkdirSync(storeIconDir, { recursive: true });
  await sharp(Buffer.from(getFullIconSvg(512))).png().toFile(join(storeIconDir, 'play-store-icon-512.png'));
  console.log('Generated public/icons/play-store-icon-512.png');
}

main().catch(err => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
