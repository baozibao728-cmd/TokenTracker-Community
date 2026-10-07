import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { deflateSync } from 'node:zlib';
import { PNG } from 'pngjs';
import {
  canonicalIconPath,
  createRgbaPng,
  linuxDir,
  repositoryRoot,
  syncTauriIcon,
  tauriIconPath,
} from '../scripts/sync-tauri-icon.mjs';

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function pngHeader(buffer) {
  assert.deepEqual(buffer.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    bitDepth: buffer[24],
    colorType: buffer[25],
  };
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data = Buffer.alloc(0)) {
  const name = Buffer.from(type, 'ascii');
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  name.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(chunk.subarray(4, 8 + data.length)), 8 + data.length);
  return chunk;
}

function palettePngFixture() {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(2, 0);
  header.writeUInt32BE(1, 4);
  header[8] = 8;
  header[9] = 3;
  const palette = Buffer.from([0, 0, 0, 255, 255, 255]);
  const transparency = Buffer.from([0, 255]);
  const scanline = deflateSync(Buffer.from([0, 0, 1]));
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header),
    pngChunk('PLTE', palette),
    pngChunk('tRNS', transparency),
    pngChunk('IDAT', scanline),
    pngChunk('IEND'),
  ]);
}

test('palette PNG input converts to RGBA while preserving palette transparency', () => {
  const paletteFixture = palettePngFixture();
  assert.equal(pngHeader(paletteFixture).colorType, 3);

  const converted = createRgbaPng(paletteFixture);
  assert.deepEqual(pngHeader(converted), {
    width: 2,
    height: 1,
    bitDepth: 8,
    colorType: 6,
  });
  assert.deepEqual([...PNG.sync.read(converted).data], [0, 0, 0, 0, 255, 255, 255, 255]);
});

test('canonical dashboard icon converts to an 8-bit RGBA PNG', () => {
  const canonical = fs.readFileSync(canonicalIconPath);
  assert.equal(pngHeader(canonical).width, 512);
  assert.equal(pngHeader(canonical).height, 512);
  assert.ok([2, 3, 6].includes(pngHeader(canonical).colorType), 'canonical icon must be a supported PNG type');

  const converted = createRgbaPng(canonical);
  assert.deepEqual(pngHeader(converted), {
    width: 512,
    height: 512,
    bitDepth: 8,
    colorType: 6,
  });

  const decoded = PNG.sync.read(converted);
  const canonicalPixels = PNG.sync.read(canonical);
  assert.equal(decoded.width, 512);
  assert.equal(decoded.height, 512);
  assert.equal(
    sha256(decoded.data),
    sha256(canonicalPixels.data),
    'RGBA conversion must preserve the canonical icon pixels',
  );
});

test('Linux app and tray resolve to the shared brand icon, without pet artwork coupling', () => {
  assert.equal(
    path.relative(repositoryRoot, canonicalIconPath),
    path.join('dashboard', 'public', 'icon-512.png'),
  );
  assert.equal(
    path.relative(linuxDir, tauriIconPath),
    path.join('src-tauri', 'icons', 'icon.png'),
  );

  const tauriConfigPath = new URL('../src-tauri/tauri.conf.json', import.meta.url);
  const tauriConfig = JSON.parse(fs.readFileSync(tauriConfigPath, 'utf8'));
  assert.deepEqual(tauriConfig.bundle.icon, ['icons/icon.png']);

  const traySource = fs.readFileSync(new URL('../src-tauri/src/tray.rs', import.meta.url), 'utf8');
  assert.match(traySource, /\.default_window_icon\(\)/);
  assert.match(traySource, /include_bytes!\("\.\.\/icons\/icon\.png"\)/);
  assert.doesNotMatch(traySource, /pet|mascot/i);
});

test('icon sync reads the destination directly without an exists-then-read race', () => {
  const script = fs.readFileSync(new URL('../scripts/sync-tauri-icon.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(script, /existsSync\s*\(/);
  assert.match(script, /error\.code !== ['"]ENOENT['"]/);
  assert.match(script, /writeFileSync\(temporaryPath/);
  assert.match(script, /renameSync\(temporaryPath, destinationPath\)/);
});

test('sync writes a deterministic RGBA Tauri icon', () => {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'tokentracker-icon-'));
  const destination = path.join(temporaryDirectory, 'icons', 'icon.png');

  try {
    syncTauriIcon(canonicalIconPath, destination);
    const first = fs.readFileSync(destination);
    const sourcePixels = PNG.sync.read(fs.readFileSync(canonicalIconPath));
    const syncedPixels = PNG.sync.read(first);
    syncTauriIcon(canonicalIconPath, destination);
    const second = fs.readFileSync(destination);

    assert.deepEqual(first, second);
    assert.equal(pngHeader(first).colorType, 6);
    assert.equal(sha256(syncedPixels.data), sha256(sourcePixels.data));
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

test('icon sync replaces a destination symlink without writing through it', () => {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'tokentracker-icon-link-'));
  const sentinel = path.join(temporaryDirectory, 'sentinel.txt');
  const destination = path.join(temporaryDirectory, 'icon.png');

  try {
    fs.writeFileSync(sentinel, 'do not replace');
    fs.symlinkSync(sentinel, destination);

    syncTauriIcon(canonicalIconPath, destination);

    assert.equal(fs.readFileSync(sentinel, 'utf8'), 'do not replace');
    // O_NOFOLLOW: throws if the destination is still a symlink, and the same
    // open serves the content read — no check-then-use race.
    const fd = fs.openSync(destination, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
    try {
      assert.equal(pngHeader(fs.readFileSync(fd)).colorType, 6);
    } finally {
      fs.closeSync(fd);
    }
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});
