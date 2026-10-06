#!/usr/bin/env node
'use strict';

// Deterministic renderer for this master only: solid closed M/L/C/Z paths.
// Reject unsupported SVG features instead of silently rendering a different logo.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
let PNG;
try { ({ PNG } = require('pngjs')); }
catch (error) {
  if (error.code !== 'MODULE_NOT_FOUND') throw error;
  ({ PNG } = require('../dashboard/node_modules/pngjs'));
}
const root = path.resolve(__dirname, '..');
const masterFile = 'assets/brand/app-icon.svg';
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function flattenPath(d) {
  const tokens = d.match(/[MLCZ]|-?\d+(?:\.\d+)?/g) || [];
  if (tokens.join('') !== d.replace(/[\s,]/g, '')) throw new Error('Unsupported path command');
  let i = 0, x = 0, y = 0;
  const points = [];
  const number = () => {
    const value = Number(tokens[i++]);
    if (!Number.isFinite(value)) throw new Error('Invalid path coordinates');
    return value;
  };
  while (i < tokens.length) {
    const command = tokens[i++];
    if (command === 'M' || command === 'L') {
      if (command === 'M' && points.length) throw new Error('Multiple contours unsupported');
      x = number(); y = number(); points.push([x, y]);
    } else if (command === 'C' && points.length) {
      const x0 = x, y0 = y, x1 = number(), y1 = number();
      const x2 = number(), y2 = number(), x3 = number(), y3 = number();
      for (let step = 1; step <= 64; step++) {
        const t = step / 64, u = 1 - t;
        points.push([u ** 3 * x0 + 3 * u ** 2 * t * x1 + 3 * u * t ** 2 * x2 + t ** 3 * x3,
          u ** 3 * y0 + 3 * u ** 2 * t * y1 + 3 * u * t ** 2 * y2 + t ** 3 * y3]);
      }
      x = x3; y = y3;
    } else if (command === 'Z' && i === tokens.length && points.length > 2) {
      return points;
    } else throw new Error('Invalid closed path');
  }
  throw new Error('Path must be closed');
}

function parseMaster(svg) {
  if (!svg.includes('viewBox="0 0 1024 1024"') || /<(?:rect|circle|ellipse|image|use|filter|mask|g)\b|\b(?:transform|stroke|style)=/.test(svg)) {
    throw new Error('Unsupported master SVG');
  }
  const paths = [...svg.matchAll(/<path id="([a-z]+)" fill="(#[0-9A-Fa-f]{6})" d="([^"]+)"\s*\/>/g)]
    .map(([, id, fill, d]) => ({ id, fill, d, points: flattenPath(d) }));
  if (paths.map(p => p.id).join(',') !== 'background,ring,orbit,dot' ||
      paths.some(p => p.fill !== (p.id === 'background' ? '#000000' : '#FFFFFF')) ||
      (svg.match(/<path\b/g) || []).length !== paths.length) throw new Error('Unexpected master layers');
  return paths;
}

function glyphSvg(paths, color = '#000000') {
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">\n' +
    paths.filter(p => p.id !== 'background').map(p => `  <path fill="${color}" d="${p.d}"/>`).join('\n') + '\n</svg>\n';
}

function renderPng(paths, size, { monochrome = false } = {}) {
  if (!Number.isInteger(size) || size < 1 || size > 1024) throw new Error('Invalid icon size');
  const factor = size <= 64 ? 8 : 4, side = size * factor;
  const pixels = Buffer.alloc(side * side * 4);
  for (const layer of paths) {
    if (monochrome && layer.id === 'background') continue;
    // Below 24px the satellite needs half a pixel of breathing room. Widen the
    // same opening and shift only the dot; do not substitute a different mark.
    let contour = layer.points;
    if (size <= 24 && layer.id === 'dot') contour = contour.map(([x, y]) => [x + 32, y - 40]);
    if (size <= 24 && layer.id === 'ring') contour = flattenPath(layer.d
      .replace('M 739 292', 'M 712 309').replace('758 315', '778 329')
      .replace('L 684 374', 'L 704 388').replace('666 350 Z', '650 367 Z'));
    const points = contour.map(([x, y]) => [x * side / 1024, y * side / 1024]);
    const value = monochrome || layer.id === 'background' ? 0 : 255;
    const minY = Math.max(0, Math.floor(Math.min(...points.map(p => p[1]))));
    const maxY = Math.min(side, Math.ceil(Math.max(...points.map(p => p[1]))));
    for (let y = minY; y < maxY; y++) {
      const scan = y + 0.5, hits = [];
      for (let a = 0; a < points.length; a++) {
        const [ax, ay] = points[a], [bx, by] = points[(a + 1) % points.length];
        if ((ay <= scan && by > scan) || (by <= scan && ay > scan)) hits.push(ax + (scan - ay) * (bx - ax) / (by - ay));
      }
      hits.sort((a, b) => a - b);
      for (let a = 0; a + 1 < hits.length; a += 2) {
        const left = Math.max(0, Math.ceil(hits[a] - 0.5)), right = Math.min(side, Math.ceil(hits[a + 1] - 0.5));
        for (let x = left; x < right; x++) {
          const offset = (y * side + x) * 4;
          pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = value; pixels[offset + 3] = 255;
        }
      }
    }
  }
  const result = new PNG({ width: size, height: size });
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let alpha = 0, red = 0;
    for (let sy = 0; sy < factor; sy++) for (let sx = 0; sx < factor; sx++) {
      const offset = ((y * factor + sy) * side + x * factor + sx) * 4;
      alpha += pixels[offset + 3]; red += pixels[offset] * pixels[offset + 3];
    }
    const offset = (y * size + x) * 4;
    result.data[offset] = result.data[offset + 1] = result.data[offset + 2] = alpha ? Math.round(red / alpha) : 0;
    result.data[offset + 3] = Math.round(alpha / (factor * factor));
  }
  return PNG.sync.write(result, { colorType: 6, inputColorType: 6, inputHasAlpha: true });
}

function createIco(entries) {
  const header = Buffer.alloc(6 + entries.length * 16);
  header.writeUInt16LE(1, 2); header.writeUInt16LE(entries.length, 4);
  let offset = header.length;
  entries.forEach(({ size, png }, index) => {
    const p = 6 + index * 16;
    header[p] = header[p + 1] = size === 256 ? 0 : size;
    header.writeUInt16LE(1, p + 4); header.writeUInt16LE(32, p + 6);
    header.writeUInt32LE(png.length, p + 8); header.writeUInt32LE(offset, p + 12); offset += png.length;
  });
  return Buffer.concat([header, ...entries.map(e => e.png)]);
}

function createIcns(entries) {
  const chunks = entries.map(({ type, png }) => {
    const header = Buffer.alloc(8); header.write(type, 0, 4, 'ascii'); header.writeUInt32BE(png.length + 8, 4);
    return Buffer.concat([header, png]);
  });
  const header = Buffer.alloc(8); header.write('icns'); header.writeUInt32BE(8 + chunks.reduce((n, b) => n + b.length, 0), 4);
  return Buffer.concat([header, ...chunks]);
}

function generatedAssets(options = {}) {
  const master = fs.readFileSync(path.join(root, masterFile));
  const paths = parseMaster(master.toString());
  const assets = new Map(), cache = new Map();
  const png = (size, monochrome = false) => {
    const key = `${size}:${monochrome}`;
    if (!cache.has(key)) cache.set(key, renderPng(paths, size, { monochrome }));
    return cache.get(key);
  };
  const put = (file, bytes) => assets.set(file.replaceAll('\\', '/'), Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes));
  const macLayers = dir => {
    put(`${dir}/01-background.svg`, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><path fill="#000000" d="M 0 0 L 1024 0 L 1024 1024 L 0 1024 Z"/></svg>\n');
    put(`${dir}/02-orbit.svg`, glyphSvg(paths, '#FFFFFF'));
  };
  const menuBar = dir => { for (const size of [18, 36]) put(`${dir}/menubar_${size}.png`, png(size, true)); };
  if (options.iconAssetsDir) { macLayers(options.iconAssetsDir); return assets; }
  if (options.menubarAssetsDir) { menuBar(options.menubarAssetsDir); return assets; }
  const groups = options.groups || ['web', 'windows', 'macos', 'linux'];
  put('assets/brand/app-mark.svg', glyphSvg(paths));
  if (groups.includes('web')) {
    put('dashboard/public/icon.svg', master);
    for (const [file, size] of [['app-icon.png', 256], ['favicon-16.png', 16], ['favicon-32.png', 32], ['apple-touch-icon.png', 180], ['icon-192.png', 192], ['icon-512.png', 512]]) put(`dashboard/public/${file}`, png(size));
    put('dashboard/public/favicon.ico', createIco([16, 32, 48].map(size => ({ size, png: png(size) }))));
  }
  if (groups.includes('windows')) put('TokenTrackerWin/assets/trayicon.ico', createIco([16, 32, 48, 64, 256].map(size => ({ size, png: png(size) }))));
  if (groups.includes('macos')) {
    macLayers('TokenTrackerBar/TokenTrackerBar/AppIcon.icon/Assets');
    menuBar('TokenTrackerBar/TokenTrackerBar/Assets.xcassets/MenuBarIcon.imageset');
    put('TokenTrackerBar/AppIcon-iOS-Default-1024x1024@1x.png', png(1024));
    put('TokenTrackerBar/TokenTrackerBar/AppIcon.icns', createIcns([
      ['icp4', 16], ['icp5', 32], ['icp6', 64], ['ic07', 128], ['ic08', 256], ['ic09', 512], ['ic10', 1024],
      ['ic11', 32], ['ic12', 64], ['ic13', 256], ['ic14', 512]
    ].map(([type, size]) => ({ type, png: png(size) }))));
  }
  if (groups.includes('linux')) put('TokenTrackerLinux/src-tauri/icons/icon.png', png(512));
  if (groups.length === 4) put('assets/brand/generated-manifest.json', JSON.stringify({
    schema_version: 1, master: masterFile, master_sha256: sha256(master),
    renderer: 'closed M/L/C/Z paths; 64-step cubic flattening; 8x/4x scanline supersampling; pngjs RGBA',
    outputs: [...assets].map(([file, bytes]) => ({ file, bytes: bytes.length, sha256: sha256(bytes) }))
  }, null, 2) + '\n');
  return assets;
}

function generate(options = {}) {
  const outputRoot = path.resolve(options.outputRoot || root);
  const assets = generatedAssets(options), drift = [];
  for (const [file, bytes] of assets) {
    const target = path.resolve(outputRoot, file);
    const current = fs.existsSync(target) ? fs.readFileSync(target) : null;
    if (current && current.equals(bytes)) continue;
    if (options.check) drift.push(file);
    else { fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, bytes); }
  }
  if (drift.length) throw new Error(`Generated brand assets drift: ${drift.join(', ')}`);
  return [...assets.keys()];
}

if (require.main === module) {
  const options = {}, groups = [];
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg === '--check') options.check = true;
    else if (['--web', '--windows', '--macos', '--linux'].includes(arg)) groups.push(arg.slice(2));
    else if (['--output-root', '--icon-assets-dir', '--menubar-assets-dir'].includes(arg)) {
      const value = process.argv[++i]; if (!value || value.startsWith('--')) throw new Error(`Missing value: ${arg}`);
      options[{ '--output-root': 'outputRoot', '--icon-assets-dir': 'iconAssetsDir', '--menubar-assets-dir': 'menubarAssetsDir' }[arg]] = value;
    } else throw new Error(`Unknown option: ${arg}`);
  }
  if (options.iconAssetsDir && options.menubarAssetsDir) throw new Error('Use only one directed macOS output');
  if (groups.length) options.groups = [...new Set(groups)];
  console.log(`${options.check ? 'Verified' : 'Generated'} ${generate(options).length} brand assets.`);
}

module.exports = { parseMaster, flattenPath, glyphSvg, renderPng, createIco, createIcns, generatedAssets, generate };
