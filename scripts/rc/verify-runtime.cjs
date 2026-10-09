"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { validateReleaseClientConfig } = require("../prepare-release-client-config.cjs");

const WEB_BRAND_ASSETS = [
  "icon.svg", "app-icon.png", "apple-touch-icon.png", "favicon-16.png",
  "favicon-32.png", "favicon.ico", "icon-192.png", "icon-512.png",
];

function verifyBrandCacheReferences(dist, hashes) {
  const urls = require('../../dashboard/src/lib/brand-assets.json');
  for (const file of WEB_BRAND_ASSETS) {
    if (urls[file] !== `/${file}?sha256=${hashes[file]}`) throw new Error(`Brand cache key does not match package bytes: ${file}`);
  }
  for (const filename of ['index.html','share.html']) {
    const html = fs.readFileSync(path.join(dist, filename), 'utf8');
    for (const file of ['icon.svg','favicon.ico','favicon-32.png','favicon-16.png','apple-touch-icon.png']) {
      if (!html.includes(`href="${urls[file]}"`)) throw new Error(`Packaged ${filename} has an unkeyed or stale brand link: ${file}`);
    }
    if (filename === 'index.html' && !html.includes(`https://www.tokentracker.cc${urls['icon-512.png']}`)) {
      throw new Error('Packaged index.html has an unkeyed or stale schema logo.');
    }
  }
  const javascript = walk(dist).filter(file => file.endsWith('.js')).map(file => fs.readFileSync(file,'utf8')).join('\n');
  if (!javascript.includes(urls['app-icon.png'])) throw new Error('Packaged application brand URL is not content-keyed.');
  console.log('BRAND CACHE PASS actual HTML and application bundle use content SHA-256 URLs');
}

function walk(root) {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(root, entry.name);
    return entry.isDirectory() ? walk(file) : entry.isFile() ? [file] : [];
  });
}
function requiredRuntimeFiles(platform) {
  if (!["windows", "macos", "linux"].includes(platform)) throw new Error("Unknown runtime platform.");
  const required = ["bin/tracker.js", "package.json", "src/lib/runtime-config.js",
    "src/lib/release-client-config.json", "dashboard/dist/index.html", "dashboard/dist/share.html",
    ...WEB_BRAND_ASSETS.map(file => path.join("dashboard/dist", file))];
  // Vite's pet/quota entries are opt-in for Windows only; neither macOS nor
  // Linux uses these standalone surfaces. Require the actual build inputs.
  if (platform === "windows") required.push("dashboard/dist/pet.html", "dashboard/dist/quota.html");
  return required;
}
function verifyDisplayNames(dist) {
  for (const file of ['index.html', 'share.html']) {
    const html = fs.readFileSync(path.join(dist, file), 'utf8');
    const title = /<title>([^<]*)<\/title>/i.exec(html)?.[1] || '';
    if (!title.includes('TokenOrbit') || /Token ?Tracker/.test(title))
      throw new Error(`Packaged ${file} does not use the TokenOrbit display name.`);
  }
}
function verifyRuntime(root, nativeBinary, platform) {
  const expected = validateReleaseClientConfig();
  const version = require("../../package.json").version;
  const tracker = path.join(root, "tokentracker");
  const required = requiredRuntimeFiles(platform);
  for (const file of required) {
    if (!fs.statSync(path.join(tracker, file)).isFile()) throw new Error(`Missing runtime payload: ${file}`);
  }
  if (JSON.parse(fs.readFileSync(path.join(tracker, "package.json"))).version !== version)
    throw new Error("Packaged tracker version mismatch.");
  const crypto = require("node:crypto");
  const brandSourceHashes = {};
  for (const file of WEB_BRAND_ASSETS) {
    const sourceBytes = fs.readFileSync(path.resolve(__dirname, "../../dashboard/public", file));
    const packagedBytes = fs.readFileSync(path.join(tracker, "dashboard/dist", file));
    if (!packagedBytes.equals(sourceBytes))
      throw new Error(`Packaged dashboard brand asset differs from the canonical public asset: ${file}`);
    brandSourceHashes[file] = crypto.createHash("sha256").update(sourceBytes).digest("hex");
  }
  verifyBrandCacheReferences(path.join(tracker, 'dashboard/dist'), brandSourceHashes);
  verifyDisplayNames(path.join(tracker, 'dashboard/dist'));
  const config = JSON.parse(fs.readFileSync(path.join(tracker, "src/lib/release-client-config.json")));
  // Compare without printing either public client credential. Never accept a management credential.
  if (config.baseUrl !== expected.baseUrl || config.anonKey !== expected.anonKey)
    throw new Error("Packaged backend/client credential mismatch.");
  const runtime = require(path.join(tracker, "src/lib/runtime-config.js"));
  const resolved = runtime.resolveRuntimeConfig({ env: {}, config: {} });
  if (resolved.baseUrl !== expected.baseUrl || resolved.anonKey !== expected.anonKey || resolved.sources.baseUrl !== "release")
    throw new Error("Packaged backend resolution mismatch.");
  const scripts = walk(path.join(tracker, "dashboard/dist")).filter(p => p.endsWith(".js"));
  const dashboard = scripts.map(p => fs.readFileSync(p, "utf8")).join("\n");
  if (!dashboard.includes(expected.baseUrl) || !dashboard.includes(expected.anonKey))
    throw new Error("Dashboard does not contain the validated own client configuration.");
  if (/srctyff5\.us-east\.insforge\.app/.test(dashboard))
    throw new Error("Official backend present in dashboard payload.");
  const node = path.join(root, platform === "windows" ? "node.exe" : "node");
  if (execFileSync(node, ["--version"], { encoding: "utf8" }).trim() !== "v22.22.2")
    throw new Error("Unexpected embedded Node version.");
  const binary = fs.readFileSync(nativeBinary);
  const strings = binary.toString("latin1") + binary.toString("utf16le");
  if (/xiufengsun\/TokenTracker|srctyff5\.us-east\.insforge\.app/.test(strings))
    throw new Error("Official backend/update repository present in native binary.");
  if (platform !== "linux" && !strings.includes("baozibao728-cmd/TokenTracker-Community"))
    throw new Error("Own update repository missing from native binary.");
  console.log(`PACKAGE PASS ${platform}: actual runtime, version ${version}, own backend and updater ownership, all ${WEB_BRAND_ASSETS.length} public brand assets exact`);
  console.log(`BRAND WEB SOURCE SHA-256 ${JSON.stringify(brandSourceHashes)}`);
}
if (require.main === module) {
  try { verifyRuntime(...process.argv.slice(2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { verifyRuntime, requiredRuntimeFiles, WEB_BRAND_ASSETS, verifyBrandCacheReferences, verifyDisplayNames };
