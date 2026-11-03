const fs = require('fs');
const path = require('path');
const { PNG } = require('../node_modules/.pnpm/pngjs@5.0.0/node_modules/pngjs');

function createAssetIcon(size) {
  const png = new PNG({ width: size, height: size });
  const scale = size / 512;

  // Helper to set pixel with alpha blending
  function setPixel(x, y, r, g, b, a = 255) {
    if (x < 0 || x >= size || y < 0 || y >= size) return;
    const idx = (size * Math.floor(y) + Math.floor(x)) << 2;
    if (a === 255) {
      png.data[idx] = r;
      png.data[idx + 1] = g;
      png.data[idx + 2] = b;
      png.data[idx + 3] = a;
    } else {
      const alpha = a / 255;
      const invAlpha = 1 - alpha;
      png.data[idx] = Math.round(r * alpha + png.data[idx] * invAlpha);
      png.data[idx + 1] = Math.round(g * alpha + png.data[idx + 1] * invAlpha);
      png.data[idx + 2] = Math.round(b * alpha + png.data[idx + 2] * invAlpha);
      png.data[idx + 3] = Math.min(255, png.data[idx + 3] + Math.round(a * invAlpha));
    }
  }

  // Draw rounded rectangle background
  const radius = 110 * scale;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Check rounded corner distance
      let inBounds = true;
      let dist = 0;
      if (x < radius && y < radius) {
        dist = Math.hypot(x - radius, y - radius);
        if (dist > radius) inBounds = false;
      } else if (x > size - radius && y < radius) {
        dist = Math.hypot(x - (size - radius), y - radius);
        if (dist > radius) inBounds = false;
      } else if (x < radius && y > size - radius) {
        dist = Math.hypot(x - radius, y - (size - radius));
        if (dist > radius) inBounds = false;
      } else if (x > size - radius && y > size - radius) {
        dist = Math.hypot(x - (size - radius), y - (size - radius));
        if (dist > radius) inBounds = false;
      }

      if (inBounds) {
        // Gradient from vibrant royal blue (37, 99, 235) to dark navy slate (15, 23, 42)
        const t = (x + y) / (size * 2);
        const r = Math.round(40 * (1 - t) + 15 * t);
        const g = Math.round(110 * (1 - t) + 25 * t);
        const b = Math.round(245 * (1 - t) + 60 * t);
        setPixel(x, y, r, g, b, 255);
      }
    }
  }

  // Draw Viewfinder Brackets in 4 corners
  function drawThickLine(x1, y1, x2, y2, thickness, r, g, b) {
    const len = Math.hypot(x2 - x1, y2 - y1);
    const dx = (x2 - x1) / len;
    const dy = (y2 - y1) / len;
    for (let i = 0; i <= len; i++) {
      const cx = x1 + dx * i;
      const cy = y1 + dy * i;
      for (let tx = -thickness / 2; tx <= thickness / 2; tx++) {
        for (let ty = -thickness / 2; ty <= thickness / 2; ty++) {
          setPixel(cx + tx, cy + ty, r, g, b, 255);
        }
      }
    }
  }

  const th = Math.max(2, Math.round(18 * scale));
  const bColor = [56, 189, 248]; // Sky blue #38bdf8

  // Top-left bracket
  drawThickLine(100 * scale, 160 * scale, 100 * scale, 110 * scale, th, ...bColor);
  drawThickLine(100 * scale, 110 * scale, 160 * scale, 110 * scale, th, ...bColor);

  // Top-right bracket
  drawThickLine(412 * scale, 160 * scale, 412 * scale, 110 * scale, th, ...bColor);
  drawThickLine(412 * scale, 110 * scale, 352 * scale, 110 * scale, th, ...bColor);

  // Bottom-left bracket
  drawThickLine(100 * scale, 352 * scale, 100 * scale, 402 * scale, th, ...bColor);
  drawThickLine(100 * scale, 402 * scale, 160 * scale, 402 * scale, th, ...bColor);

  // Bottom-right bracket
  drawThickLine(412 * scale, 352 * scale, 412 * scale, 402 * scale, th, ...bColor);
  drawThickLine(412 * scale, 402 * scale, 352 * scale, 402 * scale, th, ...bColor);

  // QR corner targets
  const qrTarget = (ox, oy, sz) => {
    for (let y = oy; y < oy + sz; y++) {
      for (let x = ox; x < ox + sz; x++) {
        setPixel(x, y, 255, 255, 255, 230);
      }
    }
  };
  const tSz = Math.round(30 * scale);
  qrTarget(130 * scale, 130 * scale, tSz);
  qrTarget((412 - 50) * scale, 130 * scale, tSz);
  qrTarget(130 * scale, (412 - 50) * scale, tSz);

  // Draw 3D Isometric Asset Cube in Center
  // Point math: Center is (256, 268) * scale
  const cx = 256 * scale;
  const cy = 268 * scale;
  const rSize = 88 * scale;
  const hSize = 100 * scale;

  // Polygon fill helper
  function fillPolygon(points, r, g, b) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const [px, py] of points) {
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
    }
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      const nodeX = [];
      let j = points.length - 1;
      for (let i = 0; i < points.length; i++) {
        if ((points[i][1] < y && points[j][1] >= y) || (points[j][1] < y && points[i][1] >= y)) {
          nodeX.push(points[i][0] + (y - points[i][1]) / (points[j][1] - points[i][1]) * (points[j][0] - points[i][0]));
        }
        j = i;
      }
      nodeX.sort((a, b) => a - b);
      for (let i = 0; i < nodeX.length; i += 2) {
        if (nodeX[i] >= maxX) break;
        if (nodeX[i + 1] > minX) {
          const start = Math.max(Math.floor(nodeX[i]), Math.floor(minX));
          const end = Math.min(Math.ceil(nodeX[i + 1]), Math.ceil(maxX));
          for (let x = start; x <= end; x++) {
            setPixel(x, y, r, g, b, 255);
          }
        }
      }
    }
  }

  // Top Face (Lighter blue #60a5fa)
  fillPolygon([
    [cx, cy - rSize],
    [cx + rSize, cy - rSize * 0.5],
    [cx, cy],
    [cx - rSize, cy - rSize * 0.5]
  ], 96, 165, 250);

  // Left Face (Mid royal blue #2563eb)
  fillPolygon([
    [cx - rSize, cy - rSize * 0.5],
    [cx, cy],
    [cx, cy + hSize],
    [cx - rSize, cy + hSize - rSize * 0.5]
  ], 37, 99, 235);

  // Right Face (Dark indigo blue #1d4ed8)
  fillPolygon([
    [cx, cy],
    [cx + rSize, cy - rSize * 0.5],
    [cx + rSize, cy + hSize - rSize * 0.5],
    [cx, cy + hSize]
  ], 29, 78, 216);

  // Subtle 3D Edge highlights
  drawThickLine(cx - rSize, cy - rSize * 0.5, cx, cy, Math.max(1, 2 * scale), 255, 255, 255);
  drawThickLine(cx, cy, cx + rSize, cy - rSize * 0.5, Math.max(1, 2 * scale), 255, 255, 255);
  drawThickLine(cx, cy, cx, cy + hSize, Math.max(1, 2 * scale), 255, 255, 255);

  // Luminous horizontal scanning laser
  const laserY = Math.round(cy);
  const laserStart = Math.round(80 * scale);
  const laserEnd = Math.round(432 * scale);
  for (let x = laserStart; x <= laserEnd; x++) {
    const edgeDist = Math.min(x - laserStart, laserEnd - x) / (70 * scale);
    const alpha = Math.min(255, Math.round(255 * Math.min(1, edgeDist)));
    setPixel(x, laserY - 1, 56, 189, 248, Math.round(alpha * 0.7));
    setPixel(x, laserY, 255, 255, 255, alpha);
    setPixel(x, laserY + 1, 56, 189, 248, Math.round(alpha * 0.7));
  }

  return PNG.sync.write(png);
}

// Generate Icons
const iconsDir = path.resolve(__dirname, '../apps/web/public/icons');
if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });

const buf512 = createAssetIcon(512);
fs.writeFileSync(path.join(iconsDir, 'icon-512x512.png'), buf512);
fs.writeFileSync(path.resolve(__dirname, '../apps/web/src/app/apple-icon.png'), buf512);

const buf192 = createAssetIcon(192);
fs.writeFileSync(path.join(iconsDir, 'icon-192x192.png'), buf192);
fs.writeFileSync(path.join(iconsDir, 'apple-touch-icon.png'), buf192);

const buf48 = createAssetIcon(48);
fs.writeFileSync(path.resolve(__dirname, '../apps/web/public/favicon.ico'), buf48);

// Brain directory copy for chat display
const brainPath = '/Users/manoj/.gemini/antigravity/brain/0df6e406-491d-40ca-b689-2c7a0a55f1bd/app-icon.png';
fs.writeFileSync(brainPath, buf512);

console.log('✅ Icons generated successfully:');
console.log('  512x512: apps/web/public/icons/icon-512x512.png');
console.log('  192x192: apps/web/public/icons/icon-192x192.png');
console.log('  Favicon: apps/web/public/favicon.ico');
console.log('  Brain Display: ' + brainPath);

