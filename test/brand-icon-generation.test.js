'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { PNG } = require('pngjs');
const { parseMaster, flattenPath, renderPng, generatedAssets, generate } = require('../scripts/generate-brand-icons.cjs');
const root = path.resolve(__dirname, '..');
const master = fs.readFileSync(path.join(root, 'assets/brand/app-icon.svg'), 'utf8');

test('master renderer rejects unsupported SVG instead of dropping shapes', () => {
  assert.equal(parseMaster(master).length, 4);
  for (const invalid of [master.replace('id="ring"', 'id="unexpected"'), master.replace('</svg>', '<circle r="5"/></svg>'), master.replace('fill="#FFFFFF"', 'fill="#FAFAFA"')]) assert.throws(() => parseMaster(invalid));
  for (const d of ['M 0 0 Q 2 2 4 4 Z', 'M 0 0 L 1 1', 'M 0 0 L 1 1 Z M 2 2', 'M 0 0 C NaN 2 3 4 5 6 Z']) assert.throws(() => flattenPath(d));
});

test('all outputs reproduce exactly, detect drift, and leave pets/providers untouched', () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'brand-generation-'));
  try {
    const protectedFile = path.join(target, 'TokenTrackerWin/assets/tray-mascot-onDark.ico');
    fs.mkdirSync(path.dirname(protectedFile), { recursive: true }); fs.writeFileSync(protectedFile, 'pet sentinel');
    generate({ outputRoot: target }); generate({ outputRoot: target, check: true });
    assert.equal(fs.readFileSync(protectedFile, 'utf8'), 'pet sentinel');
    fs.writeFileSync(path.join(target, 'dashboard/public/icon-192.png'), 'drift');
    assert.throws(() => generate({ outputRoot: target, check: true }), /icon-192\.png/);
    generate({ outputRoot: target }); generate({ outputRoot: target, check: true });
    for (const file of generatedAssets().keys()) assert.doesNotMatch(file, /mascot|bot-|brand-logos|frames/);
  } finally { fs.rmSync(target, { recursive: true, force: true }); }
});

test('ICO entries contain the shared PNG raster at every Windows shell size', () => {
  const assets = generatedAssets({ groups: ['web', 'windows'] });
  const ico = assets.get('TokenTrackerWin/assets/trayicon.ico');
  assert.equal(ico.readUInt16LE(2), 1); assert.equal(ico.readUInt16LE(4), 5);
  for (const [i, size] of [16, 32, 48, 64, 256].entries()) {
    const entry = 6 + i * 16, offset = ico.readUInt32LE(entry + 12), bytes = ico.readUInt32LE(entry + 8);
    const png = PNG.sync.read(ico.subarray(offset, offset + bytes));
    assert.equal(png.width, size); assert.equal(png.height, size);
    assert.deepEqual(png.data, PNG.sync.read(renderPng(parseMaster(master), size)).data);
  }
  assert.deepEqual(assets.get('dashboard/public/icon.svg'), Buffer.from(master));
});

test('16/32/48 icons retain a separate satellite and connected ring/orbit', () => {
  for (const size of [16, 32, 48]) {
    const png = PNG.sync.read(renderPng(parseMaster(master), size));
    const visited = new Set(), components = [];
    const white = i => png.data[i * 4] > 160 && png.data[i * 4 + 3] > 200;
    for (let i = 0; i < size * size; i++) {
      if (visited.has(i) || !white(i)) continue;
      const queue = [i]; visited.add(i);
      for (let p = 0; p < queue.length; p++) {
        const cell = queue[p], x = cell % size, y = Math.floor(cell / size);
        for (const [nx, ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1],[x-1,y-1],[x+1,y-1],[x-1,y+1],[x+1,y+1]]) {
          const next = ny * size + nx;
          if (nx >= 0 && ny >= 0 && nx < size && ny < size && !visited.has(next) && white(next)) { visited.add(next); queue.push(next); }
        }
      }
      components.push(queue.length);
    }
    assert.equal(components.length, 2, `connected mark and separate dot at ${size}px: ${components}`);
    assert.equal(png.data[3], 0, 'outside tile corner is transparent');
  }
});

test('actual frontend and Windows consumers bind to generated resources', () => {
  assert.match(fs.readFileSync(path.join(root, 'dashboard/index.html'), 'utf8'), /href="\/icon\.svg"/);
  assert.match(fs.readFileSync(path.join(root, 'dashboard/src/ui/components/Shell.jsx'), 'utf8'), /src="\/app-icon\.png"/);
  for (const file of ['TokenTrackerWin/TokenTrackerWin.csproj', 'TokenTrackerWin/installer/TokenTracker.iss']) {
    const content = fs.readFileSync(path.join(root, file), 'utf8'); assert.match(content, /trayicon\.ico/);
  }
  const wrapper = fs.readFileSync(path.join(root, 'TokenTrackerWin/scripts/make-icon.ps1'), 'utf8');
  assert.match(wrapper, /generate-brand-icons\.cjs.*--windows/); assert.doesNotMatch(wrapper, /boltPath|New-Pt|System\.Drawing/);
});
