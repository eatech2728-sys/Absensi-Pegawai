import fs from 'fs';
import zlib from 'zlib';

function createPNG(width, height, isMaskable = false) {
  // RGBA buffer
  const stride = width * 4;
  const rawData = Buffer.alloc((stride + 1) * height);

  const cx = width / 2;
  const cy = height / 2;
  const r = width * (isMaskable ? 0.38 : 0.45);

  let rawIdx = 0;
  for (let y = 0; y < height; y++) {
    rawData[rawIdx++] = 0; // Filter type 0 (None)
    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Blue gradient background
      const t = (x + y) / (width + height);
      let rCol = Math.round(29 * (1 - t) + 79 * t);
      let gCol = Math.round(78 * (1 - t) + 70 * t);
      let bCol = Math.round(216 * (1 - t) + 229 * t);
      let aCol = 255;

      if (!isMaskable) {
        // Rounded squircle corner
        const cornerR = width * 0.22;
        const qx = Math.max(0, Math.abs(dx) - (width / 2 - cornerR));
        const qy = Math.max(0, Math.abs(dy) - (height / 2 - cornerR));
        const cornerDist = Math.sqrt(qx * qx + qy * qy);
        if (cornerDist > cornerR) {
          aCol = 0;
        }
      }

      // Pin shape in center
      // Pin center around cy - height * 0.08
      const pinCy = cy - height * 0.06;
      const pinDx = x - cx;
      const pinDy = y - pinCy;
      const pinDist = Math.sqrt(pinDx * pinDx + pinDy * pinDy);
      const pinR = width * 0.22;

      // Outer pin circle
      if (aCol > 0 && pinDist <= pinR) {
        rCol = 255;
        gCol = 255;
        bCol = 255;
      }

      // Inner pin circle
      if (aCol > 0 && pinDist <= pinR * 0.55) {
        rCol = 37;
        gCol = 99;
        bCol = 235;
      }

      // Pin triangle bottom
      if (aCol > 0 && y >= pinCy && y <= cy + height * 0.25) {
        const bottomY = cy + height * 0.25;
        const progress = (y - pinCy) / (bottomY - pinCy);
        const halfWidthAtY = pinR * Math.cos(Math.asin(Math.min(1, Math.abs(pinDy) / pinR || 0))) * (1 - progress * 0.85);
        if (Math.abs(pinDx) <= Math.max(width * 0.04, halfWidthAtY)) {
          rCol = 255;
          gCol = 255;
          bCol = 255;
        }
      }

      // Checkmark in center
      if (aCol > 0 && Math.abs(dy) < height * 0.08 && Math.abs(dx) < width * 0.08) {
        const checkX = dx / (width * 0.1);
        const checkY = (dy + height * 0.06) / (height * 0.1);
        // segment 1: (-0.5, 0) to (-0.1, 0.4)
        // segment 2: (-0.1, 0.4) to (0.6, -0.4)
        const d1 = Math.abs(checkY - (checkX * 1.0 + 0.5));
        const d2 = Math.abs(checkY - (-checkX * 1.14 + 0.28));
        if ((d1 < 0.22 && checkX >= -0.6 && checkX <= 0) || (d2 < 0.22 && checkX >= -0.1 && checkX <= 0.6)) {
          rCol = 255;
          gCol = 255;
          bCol = 255;
        }
      }

      rawData[rawIdx++] = rCol;
      rawData[rawIdx++] = gCol;
      rawData[rawIdx++] = bCol;
      rawData[rawIdx++] = aCol;
    }
  }

  // Deflate compressed data
  const compressed = zlib.deflateSync(rawData);

  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; // Compression
  ihdr[11] = 0; // Filter
  ihdr[12] = 0; // Interlace

  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function makeChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(12 + len);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);

  const crc = calculateCRC(chunk.subarray(4, 8 + len));
  chunk.writeUInt32BE(crc, 8 + len);
  return chunk;
}

function calculateCRC(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) c = 0xedb88320 ^ (c >>> 1);
      else c = c >>> 1;
    }
    table[n] = c;
  }

  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Generate files
const pwa192 = createPNG(192, 192, false);
fs.writeFileSync('public/pwa-192x192.png', pwa192);

const pwa512 = createPNG(512, 512, false);
fs.writeFileSync('public/pwa-512x512.png', pwa512);

const pwaMaskable = createPNG(512, 512, true);
fs.writeFileSync('public/pwa-maskable-512x512.png', pwaMaskable);

const appleTouch = createPNG(180, 180, false);
fs.writeFileSync('public/apple-touch-icon.png', appleTouch);

console.log('PWA icons successfully generated!');
