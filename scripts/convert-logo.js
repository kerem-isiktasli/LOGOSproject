/**
 * Convert SVG Logo to Icon Formats
 *
 * Converts the LOGOS SVG to PNG icons for electron-builder
 * electron-builder will auto-convert PNG to ICO/ICNS
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SVG_PATH = path.join(__dirname, '..', 'src', 'renderer', 'assets', 'logo.svg');
const RESOURCES_DIR = path.join(__dirname, '..', 'resources');
const ICONS_DIR = path.join(RESOURCES_DIR, 'icons');

// Sizes needed for different platforms
const SIZES = [16, 32, 48, 64, 128, 256, 512, 1024];

async function main() {
  // Ensure directories exist
  if (!fs.existsSync(ICONS_DIR)) {
    fs.mkdirSync(ICONS_DIR, { recursive: true });
  }

  // Read SVG
  const svgBuffer = fs.readFileSync(SVG_PATH);
  console.log('Read SVG logo from:', SVG_PATH);

  // Generate PNG icons at various sizes
  for (const size of SIZES) {
    const pngBuffer = await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toBuffer();

    const filename = path.join(ICONS_DIR, `${size}x${size}.png`);
    fs.writeFileSync(filename, pngBuffer);
    console.log(`Created: ${size}x${size}.png`);

    // Also save 256x256 as main icon.png
    if (size === 256) {
      fs.writeFileSync(path.join(RESOURCES_DIR, 'icon.png'), pngBuffer);
      console.log('Created: resources/icon.png');
    }
  }

  console.log('\nIcon conversion complete!');
  console.log('electron-builder will auto-convert PNG to ICO/ICNS during build.');
}

main().catch(console.error);
