/**
 * Icon Generator Script
 *
 * Generates placeholder icons for electron-builder.
 * In production, replace these with actual branding assets.
 *
 * Usage: node scripts/generate-icons.js
 */

const fs = require('fs');
const path = require('path');

// Create a simple 1x1 pixel PNG (smallest valid PNG)
// This is a placeholder - replace with actual icons for production
function createPlaceholderPNG(size = 256) {
  // PNG header + minimal valid image data
  // This creates a simple colored square
  const width = size;
  const height = size;

  // PNG signature
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;  // bit depth
  ihdrData[9] = 2;  // color type (RGB)
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace

  const ihdrCRC = crc32(Buffer.concat([Buffer.from('IHDR'), ihdrData]));
  const ihdr = Buffer.concat([
    Buffer.from([0, 0, 0, 13]),
    Buffer.from('IHDR'),
    ihdrData,
    ihdrCRC
  ]);

  // IDAT chunk - create simple uncompressed image data
  // For simplicity, we'll create a minimal valid IDAT
  // Using zlib deflate with no compression
  const rawData = [];
  for (let y = 0; y < height; y++) {
    rawData.push(0); // filter byte
    for (let x = 0; x < width; x++) {
      // Purple-ish color for LOGOS brand
      rawData.push(0x6B); // R
      rawData.push(0x46); // G
      rawData.push(0xC1); // B (purple)
    }
  }

  const zlib = require('zlib');
  const compressed = zlib.deflateSync(Buffer.from(rawData));

  const idatCRC = crc32(Buffer.concat([Buffer.from('IDAT'), compressed]));
  const idatLength = Buffer.alloc(4);
  idatLength.writeUInt32BE(compressed.length, 0);
  const idat = Buffer.concat([
    idatLength,
    Buffer.from('IDAT'),
    compressed,
    idatCRC
  ]);

  // IEND chunk
  const iendCRC = crc32(Buffer.from('IEND'));
  const iend = Buffer.concat([
    Buffer.from([0, 0, 0, 0]),
    Buffer.from('IEND'),
    iendCRC
  ]);

  return Buffer.concat([signature, ihdr, idat, iend]);
}

// CRC32 implementation for PNG
function crc32(data) {
  let crc = 0xFFFFFFFF;
  const table = makeCRCTable();

  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ data[i]) & 0xFF];
  }

  const result = Buffer.alloc(4);
  result.writeUInt32BE((crc ^ 0xFFFFFFFF) >>> 0, 0);
  return result;
}

function makeCRCTable() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
    }
    table[n] = c;
  }
  return table;
}

// Create icon directories
const resourcesDir = path.join(__dirname, '..', 'resources');
const iconsDir = path.join(resourcesDir, 'icons');

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Generate PNG icons for Linux
const sizes = [16, 32, 48, 64, 128, 256, 512];
for (const size of sizes) {
  const png = createPlaceholderPNG(size);
  const filename = path.join(iconsDir, `${size}x${size}.png`);
  fs.writeFileSync(filename, png);
  console.log(`Created ${filename}`);
}

// Create main icon.png (256x256)
const mainIcon = createPlaceholderPNG(256);
fs.writeFileSync(path.join(resourcesDir, 'icon.png'), mainIcon);
console.log('Created resources/icon.png');

console.log(`
Icons generated successfully!

NOTE: These are placeholder icons (solid purple squares).
For production, replace with actual LOGOS branding:
  - resources/icon.ico (Windows)
  - resources/icon.icns (macOS)
  - resources/icons/*.png (Linux)

You can use tools like:
  - electron-icon-maker
  - png2icns (macOS)
  - ImageMagick convert
`);
