"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const zlib = require("node:zlib");

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function readRange(buffer, offset, size, label) {
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(size) || offset < 0 || size < 0 || offset + size > buffer.length)
    throw new Error(`Invalid ${label} bounds.`);
  return buffer.subarray(offset, offset + size);
}

function parsePng(buffer, label = "PNG") {
  if (buffer.length < 33 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error(`${label} is not a PNG image.`);
  let offset = 8;
  let header;
  let palette;
  let transparency;
  const idat = [];
  let ended = false;
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const data = readRange(buffer, offset + 8, length, `${label} ${type} chunk`);
    readRange(buffer, offset, length + 12, `${label} ${type} chunk`);
    if (type === "IHDR") {
      if (header || length !== 13) throw new Error(`${label} has an invalid IHDR chunk.`);
      header = {
        width: data.readUInt32BE(0), height: data.readUInt32BE(4), bitDepth: data[8], colorType: data[9],
        compression: data[10], filter: data[11], interlace: data[12],
      };
    } else if (type === "PLTE") palette = Buffer.from(data);
    else if (type === "tRNS") transparency = Buffer.from(data);
    else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") { ended = true; break; }
    offset += length + 12;
  }
  if (!header || !ended || !header.width || !header.height || header.bitDepth !== 8 || header.compression !== 0 || header.filter !== 0 || header.interlace !== 0)
    throw new Error(`${label} uses an unsupported or incomplete PNG encoding.`);
  const channelsByType = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
  const channels = channelsByType[header.colorType];
  if (!channels || !idat.length || (header.colorType === 3 && (!palette || palette.length % 3 !== 0)))
    throw new Error(`${label} has an unsupported PNG color type.`);
  const rowBytes = header.width * channels;
  const inflated = zlib.inflateSync(Buffer.concat(idat));
  if (inflated.length !== header.height * (rowBytes + 1)) throw new Error(`${label} scanline size is invalid.`);
  const raw = Buffer.alloc(header.height * rowBytes);
  let inputOffset = 0;
  for (let y = 0; y < header.height; y++) {
    const filter = inflated[inputOffset++];
    const row = y * rowBytes;
    for (let x = 0; x < rowBytes; x++) {
      const value = inflated[inputOffset++];
      const left = x >= channels ? raw[row + x - channels] : 0;
      const above = y > 0 ? raw[row - rowBytes + x] : 0;
      const upperLeft = y > 0 && x >= channels ? raw[row - rowBytes + x - channels] : 0;
      let predictor;
      if (filter === 0) predictor = 0;
      else if (filter === 1) predictor = left;
      else if (filter === 2) predictor = above;
      else if (filter === 3) predictor = Math.floor((left + above) / 2);
      else if (filter === 4) {
        const p = left + above - upperLeft;
        const pa = Math.abs(p - left), pb = Math.abs(p - above), pc = Math.abs(p - upperLeft);
        predictor = pa <= pb && pa <= pc ? left : pb <= pc ? above : upperLeft;
      } else throw new Error(`${label} uses invalid PNG filter ${filter}.`);
      raw[row + x] = (value + predictor) & 0xff;
    }
  }
  const rgba = Buffer.alloc(header.width * header.height * 4);
  for (let pixel = 0; pixel < header.width * header.height; pixel++) {
    const src = pixel * channels;
    const dst = pixel * 4;
    if (header.colorType === 0) {
      rgba[dst] = rgba[dst + 1] = rgba[dst + 2] = raw[src];
      rgba[dst + 3] = transparency?.length >= 2 && raw[src] === transparency.readUInt16BE(0) ? 0 : 255;
    } else if (header.colorType === 2) {
      raw.copy(rgba, dst, src, src + 3);
      rgba[dst + 3] = transparency?.length >= 6 && raw[src] === transparency.readUInt16BE(0) && raw[src + 1] === transparency.readUInt16BE(2) && raw[src + 2] === transparency.readUInt16BE(4) ? 0 : 255;
    } else if (header.colorType === 3) {
      const index = raw[src];
      const color = index * 3;
      if (color + 2 >= palette.length) throw new Error(`${label} palette index is out of range.`);
      rgba[dst] = palette[color]; rgba[dst + 1] = palette[color + 1]; rgba[dst + 2] = palette[color + 2];
      rgba[dst + 3] = transparency && index < transparency.length ? transparency[index] : 255;
    } else if (header.colorType === 4) {
      rgba[dst] = rgba[dst + 1] = rgba[dst + 2] = raw[src]; rgba[dst + 3] = raw[src + 1];
    } else raw.copy(rgba, dst, src, src + 4);
  }
  return { width: header.width, height: header.height, rgba };
}

function comparePngPixels(expectedBytes, actualBytes, expectedLabel, actualLabel) {
  const expected = parsePng(expectedBytes, expectedLabel);
  const actual = parsePng(actualBytes, actualLabel);
  if (expected.width !== actual.width || expected.height !== actual.height || !expected.rgba.equals(actual.rgba))
    throw new Error(`${actualLabel} pixels do not match ${expectedLabel} (${actual.width}x${actual.height} vs ${expected.width}x${expected.height}).`);
  return { width: actual.width, height: actual.height };
}

function parseIco(icoBytes) {
  if (icoBytes.length < 6 || icoBytes.readUInt16LE(0) !== 0 || icoBytes.readUInt16LE(2) !== 1)
    throw new Error("Canonical Windows icon is not an ICO file.");
  const count = icoBytes.readUInt16LE(4);
  if (!count || icoBytes.length < 6 + count * 16) throw new Error("Canonical Windows ICO has an invalid directory.");
  const images = [];
  for (let index = 0; index < count; index++) {
    const entry = 6 + index * 16;
    const width = icoBytes[entry] || 256;
    const height = icoBytes[entry + 1] || 256;
    const length = icoBytes.readUInt32LE(entry + 8);
    const start = icoBytes.readUInt32LE(entry + 12);
    const payload = Buffer.from(readRange(icoBytes, start, length, "ICO image"));
    if (!payload.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error(`Canonical ICO image ${width}x${height} is not a PNG payload.`);
    const png = parsePng(payload, `Canonical ICO image ${width}x${height}`);
    if (png.width !== width || png.height !== height) throw new Error("Canonical ICO directory dimensions do not match its PNG payload.");
    images.push({ width, height, payload });
  }
  return images;
}

function peResourceReader(pe) {
  readRange(pe, 0, 64, "DOS header");
  if (pe.toString("ascii", 0, 2) !== "MZ") throw new Error("Native executable is not a PE file (missing MZ header).");
  const peOffset = pe.readUInt32LE(0x3c);
  if (pe.toString("ascii", peOffset, peOffset + 4) !== "PE\0\0") throw new Error("Native executable has an invalid PE signature.");
  const sectionsCount = pe.readUInt16LE(peOffset + 6);
  const optionalSize = pe.readUInt16LE(peOffset + 20);
  const optionalOffset = peOffset + 24;
  const optionalMagic = pe.readUInt16LE(optionalOffset);
  const is64 = optionalMagic === 0x20b;
  if (!is64 && optionalMagic !== 0x10b) throw new Error("Native executable has an unsupported PE optional header.");
  const directoryBase = optionalOffset + (is64 ? 112 : 96);
  const directoryCountOffset = optionalOffset + (is64 ? 108 : 92);
  if (pe.readUInt32LE(directoryCountOffset) < 3) throw new Error("Native executable has no PE resource directory.");
  const resourceRva = pe.readUInt32LE(directoryBase + 2 * 8);
  const resourceSize = pe.readUInt32LE(directoryBase + 2 * 8 + 4);
  if (!resourceRva || !resourceSize) throw new Error("Native executable has no PE resources.");
  const sectionOffset = optionalOffset + optionalSize;
  const sections = [];
  for (let i = 0; i < sectionsCount; i++) {
    const at = sectionOffset + i * 40;
    readRange(pe, at, 40, "PE section header");
    sections.push({
      virtualSize: pe.readUInt32LE(at + 8), virtualAddress: pe.readUInt32LE(at + 12),
      rawSize: pe.readUInt32LE(at + 16), rawPointer: pe.readUInt32LE(at + 20),
    });
  }
  const sizeOfHeaders = pe.readUInt32LE(optionalOffset + 60);
  function rvaToOffset(rva, size) {
    if (rva < sizeOfHeaders) { readRange(pe, rva, size, "PE header RVA"); return rva; }
    const section = sections.find(s => rva >= s.virtualAddress && rva < s.virtualAddress + Math.max(s.virtualSize, s.rawSize));
    if (!section) throw new Error(`PE resource RVA 0x${rva.toString(16)} is outside every section.`);
    const offset = section.rawPointer + (rva - section.virtualAddress);
    if (rva - section.virtualAddress + size > section.rawSize) throw new Error("PE resource extends beyond its section data.");
    readRange(pe, offset, size, "PE resource data");
    return offset;
  }
  const rootOffset = rvaToOffset(resourceRva, 16);
  function children(directoryRelative) {
    const absolute = rootOffset + directoryRelative;
    readRange(pe, absolute, 16, "PE resource directory");
    const count = pe.readUInt16LE(absolute + 12) + pe.readUInt16LE(absolute + 14);
    readRange(pe, absolute + 16, count * 8, "PE resource entries");
    return Array.from({ length: count }, (_, i) => {
      const at = absolute + 16 + i * 8;
      const name = pe.readUInt32LE(at);
      const target = pe.readUInt32LE(at + 4);
      return { id: name & 0x7fffffff, named: Boolean(name & 0x80000000), directory: Boolean(target & 0x80000000), target: target & 0x7fffffff };
    });
  }
  function leaves(directoryRelative, idPath = [], depth = 0) {
    if (depth > 5) throw new Error("PE resource directory is nested too deeply.");
    return children(directoryRelative).flatMap(entry => {
      const nextPath = [...idPath, entry.named ? null : entry.id];
      if (entry.directory) return leaves(entry.target, nextPath, depth + 1);
      const dataEntry = rootOffset + entry.target;
      readRange(pe, dataEntry, 16, "PE resource data entry");
      const dataRva = pe.readUInt32LE(dataEntry);
      const size = pe.readUInt32LE(dataEntry + 4);
      const dataOffset = rvaToOffset(dataRva, size);
      return [{ idPath: nextPath, bytes: Buffer.from(pe.subarray(dataOffset, dataOffset + size)) }];
    });
  }
  const rootTypes = children(0);
  return { leaves, rootTypes, resourceRva, resourceSize };
}

function verifyPeIconBuffer(peBytes, icoBytes, executableLabel = "Native executable") {
  const expectedImages = parseIco(icoBytes);
  const reader = peResourceReader(peBytes);
  const iconType = reader.rootTypes.find(entry => !entry.named && entry.id === 3 && entry.directory);
  const groupType = reader.rootTypes.find(entry => !entry.named && entry.id === 14 && entry.directory);
  if (!iconType || !groupType) throw new Error(`${executableLabel} is missing RT_ICON or RT_GROUP_ICON resources.`);
  const icons = reader.leaves(iconType.target).filter(resource => resource.idPath[0] !== null);
  const groups = reader.leaves(groupType.target);
  if (!groups.length) throw new Error(`${executableLabel} contains no icon groups.`);
  const iconById = new Map();
  for (const icon of icons) {
    const id = icon.idPath[0];
    if (!iconById.has(id)) iconById.set(id, []);
    iconById.get(id).push({ bytes: icon.bytes, lang: icon.idPath[1] });
  }
  let bestError;
  for (const group of groups) {
    const bytes = group.bytes;
    if (bytes.length < 6 || bytes.readUInt16LE(0) !== 0 || bytes.readUInt16LE(2) !== 1) continue;
    const count = bytes.readUInt16LE(4);
    if (!count || bytes.length < 6 + count * 14) continue;
    try {
      const foundImages = [];
      for (let i = 0; i < count; i++) {
        const at = 6 + i * 14;
        const width = bytes[at] || 256;
        const height = bytes[at + 1] || 256;
        const byteCount = bytes.readUInt32LE(at + 8);
        const iconId = bytes.readUInt16LE(at + 12);
        const expected = expectedImages.find(image => image.width === width && image.height === height);
        if (!expected) throw new Error(`group has unexpected ${width}x${height} image`);
        const candidates = iconById.get(iconId) || [];
        const candidate = candidates.find(value => value.lang === group.idPath[1]) || candidates[0];
        if (!candidate || candidate.bytes.length !== byteCount || !candidate.bytes.equals(expected.payload))
          throw new Error(`RT_ICON ${iconId} (${width}x${height}) does not match the canonical ICO PNG payload`);
        foundImages.push(`${width}x${height}`);
      }
      if (foundImages.length !== expectedImages.length) throw new Error("group has an incomplete canonical icon size set");
      return { groupId: group.idPath[0], images: foundImages };
    } catch (error) { bestError = error; }
  }
  throw new Error(`${executableLabel} icon resource does not match TokenTrackerWin/assets/trayicon.ico: ${bestError?.message || "no canonical icon group found"}.`);
}

function verifyWindows({ canonicalSvg, ico, executables }) {
  const sourceHash = sha256(canonicalSvg);
  const icoBytes = fs.readFileSync(ico);
  parseIco(icoBytes);
  for (const executable of executables) {
    const result = verifyPeIconBuffer(fs.readFileSync(executable), icoBytes, path.basename(executable));
    console.log(`BRAND ICON PASS Windows ${path.basename(executable)}: PE icon group ${result.groupId}, ${result.images.join(", ")}`);
  }
  console.log(`BRAND ICON SOURCE SHA-256 ${sourceHash} (${path.relative(process.cwd(), canonicalSvg)})`);
}

function verifyWindowsTray({ canonicalAssets, roots }) {
  for (const theme of ['Dark', 'Light']) {
    const filename = `tray-mascot-on${theme}.ico`;
    const expected = fs.readFileSync(path.join(canonicalAssets, filename));
    const frames = parseIco(expected);
    if (frames.map(frame => frame.width).join(',') !== '32,24,20,16') throw new Error('Static tray size set is incomplete.');
    for (const root of roots) {
      const actual = fs.readFileSync(path.join(root, 'assets', filename));
      if (!actual.equals(expected)) throw new Error(`Packaged static tray ${filename} differs from the canonical orbit resource.`);
    }
  }
  console.log(`BRAND TRAY PASS Windows: both transparent theme resources exact in ${roots.length} payload(s)`);
}

function listLinuxIcons(root) {
  const found = [];
  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (entry.isFile() && file.split(path.sep).join("/").includes("/icons/hicolor/") && file.toLowerCase().endsWith(".png")) found.push(file);
    }
  }
  walk(root);
  return found;
}

function verifyLinux({ canonicalSvg, canonicalPng, roots }) {
  const expectedBytes = fs.readFileSync(canonicalPng);
  const expectedPixels = parsePng(expectedBytes, canonicalPng);
  const sourceHash = sha256(canonicalSvg);
  for (const root of roots) {
    const icons = listLinuxIcons(root);
    if (!icons.length) throw new Error(`${root} contains no extracted hicolor PNG app icon.`);
    for (const file of icons) comparePngPixels(expectedBytes, fs.readFileSync(file), canonicalPng, file);
    console.log(`BRAND ICON PASS Linux ${path.basename(root)}: ${icons.length} extracted PNG icon(s), ${expectedPixels.width}x${expectedPixels.height} pixels`);
  }
  console.log(`BRAND ICON SOURCE SHA-256 ${sourceHash} (${path.relative(process.cwd(), canonicalSvg)})`);
}

function verifyMacos({ canonicalSvg, fallbackIcns, app }) {
  const sourceHash = sha256(canonicalSvg);
  const packagedIcns = path.join(app, "Contents", "Resources", "AppIcon.icns");
  if (!fs.statSync(packagedIcns).isFile()) throw new Error(`Built .app is missing ${path.relative(app, packagedIcns)}.`);
  if (!fs.readFileSync(packagedIcns).equals(fs.readFileSync(fallbackIcns)))
    throw new Error("Built .app fallback AppIcon.icns differs from the canonical fallback file.");
  const assetsCar = path.join(app, "Contents", "Resources", "Assets.car");
  if (!fs.statSync(assetsCar).isFile()) throw new Error("Built .app is missing Assets.car.");
  console.log("BRAND ICON PASS macOS fallback AppIcon.icns matches canonical bytes; Assets.car is present");
  console.log(`BRAND ICON SOURCE SHA-256 ${sourceHash} (${path.relative(process.cwd(), canonicalSvg)})`);
}

function run(args) {
  const [platform, ...rest] = args;
  if (platform === "windows") {
    if (rest.length < 3) throw new Error("Usage: windows <canonical-svg> <canonical-ico> <exe-or-setup.exe> [more PE files...]");
    verifyWindows({ canonicalSvg: rest[0], ico: rest[1], executables: rest.slice(2) });
  } else if (platform === "windows-tray") {
    if (rest.length < 2) throw new Error('Usage: windows-tray <canonical-assets-dir> <payload-root> [more roots...]');
    verifyWindowsTray({canonicalAssets:rest[0], roots:rest.slice(1)});
  } else if (platform === "linux") {
    if (rest.length < 3) throw new Error("Usage: linux <canonical-svg> <canonical-png> <extracted-package-root> [more roots...]");
    verifyLinux({ canonicalSvg: rest[0], canonicalPng: rest[1], roots: rest.slice(2) });
  } else if (platform === "macos") {
    if (rest.length !== 3) throw new Error("Usage: macos <canonical-svg> <canonical-fallback-icns> <app>");
    verifyMacos({ canonicalSvg: rest[0], fallbackIcns: rest[1], app: rest[2] });
  } else throw new Error("Usage: verify-brand-icon.cjs <windows|macos|linux> ...");
}

if (require.main === module) {
  try { run(process.argv.slice(2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = {
  comparePngPixels, parsePng, parseIco, verifyPeIconBuffer,
  verifyWindows, verifyWindowsTray, verifyLinux, verifyMacos, listLinuxIcons, run,
};
