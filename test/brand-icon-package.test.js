"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const zlib = require("node:zlib");
const { comparePngPixels, verifyLinux, verifyMacos, verifyPeIconBuffer } = require("../scripts/rc/verify-brand-icon.cjs");

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let value = n;
  for (let bit = 0; bit < 8; bit++) value = (value & 1) ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
function crc32(buffer) {
  let value = 0xffffffff;
  for (const byte of buffer) value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}
function pngChunk(type, data) {
  const name = Buffer.from(type);
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  name.copy(out, 4);
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([name, data])), 8 + data.length);
  return out;
}
function tinyPng(rgba, colorType = 6) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(1, 0); header.writeUInt32BE(1, 4);
  header[8] = 8; header[9] = colorType;
  const channels = colorType === 6 ? 4 : 3;
  const row = Buffer.from([0, ...rgba.slice(0, channels)]);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", header), pngChunk("IDAT", zlib.deflateSync(row)), pngChunk("IEND", Buffer.alloc(0)),
  ]);
}
function makeIco(png) {
  const header = Buffer.alloc(22);
  header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4);
  header[6] = 1; header[7] = 1; header.writeUInt16LE(1, 10); header.writeUInt16LE(32, 12);
  header.writeUInt32LE(png.length, 14); header.writeUInt32LE(22, 18);
  return Buffer.concat([header, png]);
}
function resourceDirectory(pe, relative, entries) {
  const at = 0x200 + relative;
  pe.writeUInt16LE(0, at + 12); pe.writeUInt16LE(entries.length, at + 14);
  entries.forEach(({ id, target, directory }, index) => {
    const entry = at + 16 + index * 8;
    pe.writeUInt32LE(id, entry);
    pe.writeUInt32LE((directory ? 0x80000000 : 0) + target, entry + 4);
  });
}
function dataEntry(pe, relative, payloadRelative, payload) {
  const at = 0x200 + relative;
  pe.writeUInt32LE(0x1000 + payloadRelative, at);
  pe.writeUInt32LE(payload.length, at + 4);
  payload.copy(pe, 0x200 + payloadRelative);
}
function peWithIcons(iconPng) {
  const pe = Buffer.alloc(0x800);
  pe.write("MZ", 0, "ascii"); pe.writeUInt32LE(0x80, 0x3c);
  pe.write("PE\0\0", 0x80, "binary");
  pe.writeUInt16LE(0x8664, 0x84); pe.writeUInt16LE(1, 0x86); pe.writeUInt16LE(0xf0, 0x94);
  const optional = 0x98;
  pe.writeUInt16LE(0x20b, optional);
  pe.writeUInt32LE(0x200, optional + 60);
  pe.writeUInt32LE(16, optional + 108);
  pe.writeUInt32LE(0x1000, optional + 112 + 2 * 8);
  pe.writeUInt32LE(0x300, optional + 112 + 2 * 8 + 4);
  const section = optional + 0xf0;
  pe.write(".rsrc", section, "ascii");
  pe.writeUInt32LE(0x300, section + 8); pe.writeUInt32LE(0x1000, section + 12);
  pe.writeUInt32LE(0x300, section + 16); pe.writeUInt32LE(0x200, section + 20);

  const group = Buffer.alloc(20);
  group.writeUInt16LE(1, 2); group.writeUInt16LE(1, 4);
  group[6] = 1; group[7] = 1; group.writeUInt16LE(1, 10); group.writeUInt16LE(32, 12);
  group.writeUInt32LE(iconPng.length, 14); group.writeUInt16LE(100, 18);
  resourceDirectory(pe, 0, [{ id: 3, target: 0x20, directory: true }, { id: 14, target: 0x40, directory: true }]);
  resourceDirectory(pe, 0x20, [{ id: 100, target: 0x60, directory: true }]);
  resourceDirectory(pe, 0x40, [{ id: 1, target: 0x80, directory: true }]);
  resourceDirectory(pe, 0x60, [{ id: 1033, target: 0xa0, directory: false }]);
  resourceDirectory(pe, 0x80, [{ id: 1033, target: 0xb0, directory: false }]);
  dataEntry(pe, 0xa0, 0x140, iconPng);
  dataEntry(pe, 0xb0, 0x120, group);
  return pe;
}
function temporaryDirectory(prefix) { return fs.mkdtempSync(path.join(os.tmpdir(), prefix)); }

test("Windows PE RT_GROUP_ICON references RT_ICON PNG payloads from the canonical ICO", () => {
  const canonical = tinyPng([12, 34, 56, 255]);
  const ico = makeIco(canonical);
  assert.doesNotThrow(() => verifyPeIconBuffer(peWithIcons(canonical), ico, "synthetic app.exe"));
  assert.throws(() => verifyPeIconBuffer(peWithIcons(tinyPng([12, 34, 57, 255])), ico, "synthetic app.exe"), /does not match the canonical ICO PNG payload/);
});

test("PNG brand checks compare decoded pixels rather than PNG byte encoding", () => {
  const rgbaPng = tinyPng([20, 40, 60, 255], 6);
  const rgbPng = tinyPng([20, 40, 60, 255], 2);
  assert.deepEqual(comparePngPixels(rgbaPng, rgbPng, "source", "packaged"), { width: 1, height: 1 });
  assert.throws(() => comparePngPixels(rgbaPng, tinyPng([20, 40, 61, 255], 2), "source", "packaged"), /pixels do not match/);
});

test("Linux verifier inspects extracted hicolor icon paths", () => {
  const root = temporaryDirectory("community-brand-icon-");
  try {
    const svg = path.join(root, "icon.svg");
    const sourcePng = path.join(root, "canonical.png");
    const payloadRoot = path.join(root, "package");
    const iconPath = path.join(payloadRoot, "usr", "share", "icons", "hicolor", "1x1", "apps", "tokentracker-community.png");
    const encoded = tinyPng([80, 90, 100, 255]);
    fs.writeFileSync(svg, "<svg/>"); fs.writeFileSync(sourcePng, encoded);
    fs.mkdirSync(path.dirname(iconPath), { recursive: true }); fs.writeFileSync(iconPath, tinyPng([80, 90, 100, 255], 2));
    assert.doesNotThrow(() => verifyLinux({ canonicalSvg: svg, canonicalPng: sourcePng, roots: [payloadRoot] }));
    fs.writeFileSync(iconPath, tinyPng([80, 90, 101, 255], 2));
    assert.throws(() => verifyLinux({ canonicalSvg: svg, canonicalPng: sourcePng, roots: [payloadRoot] }), /pixels do not match/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("macOS verifier checks the packaged fallback ICNS bytes and asset catalog", () => {
  const root = temporaryDirectory("community-brand-macos-");
  try {
    const svg = path.join(root, "icon.svg");
    const fallbackIcns = path.join(root, "AppIcon.icns");
    const app = path.join(root, "TokenTracker Community.app");
    const resources = path.join(app, "Contents", "Resources");
    fs.writeFileSync(svg, "<svg/>"); fs.writeFileSync(fallbackIcns, "synthetic ICNS bytes");
    fs.mkdirSync(resources, { recursive: true });
    fs.writeFileSync(path.join(resources, "AppIcon.icns"), fs.readFileSync(fallbackIcns));
    fs.writeFileSync(path.join(resources, "Assets.car"), "synthetic asset catalog");
    assert.doesNotThrow(() => verifyMacos({ canonicalSvg: svg, fallbackIcns, app }));
    fs.writeFileSync(path.join(resources, "AppIcon.icns"), "stale ICNS bytes");
    assert.throws(() => verifyMacos({ canonicalSvg: svg, fallbackIcns, app }), /differs from the canonical fallback file/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
