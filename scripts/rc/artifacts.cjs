"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const names = {
  windows: ["TokenTracker-Community-win-x64.zip", "TokenTracker-Community-Setup.exe"],
  macos: ["TokenTrackerCommunity.dmg"],
  linux: ["TokenTracker-Community-linux-x86_64.AppImage", "TokenTracker-Community-linux-x86_64.deb", "TokenTracker-Community-linux-x86_64.rpm"],
};
async function hash(file) {
  const h = crypto.createHash("sha256");
  for await (const chunk of fs.createReadStream(file)) h.update(chunk);
  return h.digest("hex");
}
function validateSha(sha) {
  if (!/^[0-9a-f]{40}$/.test(sha || "")) throw new Error("A full 40-character source SHA is required.");
}
function sums(packages) { return packages.map(p => `${p.sha256}  ${p.filename}\n`).join(""); }
async function record(dir, platform, sha) {
  validateSha(sha);
  if (!names[platform]) throw new Error("Unknown platform.");
  const packages = [];
  for (const filename of names[platform]) {
    const file = path.join(dir, filename);
    packages.push({ filename, size: fs.statSync(file).size, sha256: await hash(file),
      architecture: platform === "macos" ? "arm64+x86_64" : "x86_64", platform });
  }
  const data = { version: require("../../package.json").version, source_sha: sha, checkout_sha: sha, packages };
  fs.writeFileSync(path.join(dir, `${platform}.json`), JSON.stringify(data, null, 2) + "\n");
  fs.writeFileSync(path.join(dir, `${platform}.SHA256SUMS`), sums(packages));
}
async function verifyPackages(dir, metadata, expectedNames, sha) {
  validateSha(sha);
  if (metadata.source_sha !== sha || metadata.checkout_sha !== sha || metadata.version !== require("../../package.json").version)
    throw new Error("Artifact source/checkout/version mismatch.");
  if (!Array.isArray(metadata.packages) || metadata.packages.length !== expectedNames.length ||
    new Set(metadata.packages.map(p => p.filename)).size !== expectedNames.length ||
    metadata.packages.some(p => !expectedNames.includes(p.filename))) throw new Error("Artifact package inventory mismatch.");
  for (const p of metadata.packages) {
    const file = path.join(dir, p.filename);
    if (!/^[a-f0-9]{64}$/.test(p.sha256) || !Number.isSafeInteger(p.size) || p.size <= 0 ||
      fs.statSync(file).size !== p.size || await hash(file) !== p.sha256)
      throw new Error(`Artifact bytes/checksum mismatch: ${p.filename}`);
  }
}
async function assemble(input, output, sha) {
  const packages = [];
  fs.mkdirSync(output, { recursive: true });
  for (const [platform, expectedNames] of Object.entries(names)) {
    const dir = path.join(input, `rc-${platform}-${sha}`);
    const data = JSON.parse(fs.readFileSync(path.join(dir, `${platform}.json`)));
    await verifyPackages(dir, data, expectedNames, sha);
    if (fs.readFileSync(path.join(dir, `${platform}.SHA256SUMS`), "utf8") !== sums(data.packages))
      throw new Error("Platform checksum file mismatch.");
    for (const p of data.packages) fs.copyFileSync(path.join(dir, p.filename), path.join(output, p.filename));
    packages.push(...data.packages);
  }
  const metadata = { version: require("../../package.json").version, source_sha: sha, checkout_sha: sha, packages };
  fs.writeFileSync(path.join(output, "RC_MANIFEST.json"), JSON.stringify(metadata, null, 2) + "\n");
  fs.writeFileSync(path.join(output, "SHA256SUMS"), sums(packages));
  await verify(output, sha);
}
async function verify(dir, sha) {
  const data = JSON.parse(fs.readFileSync(path.join(dir, "RC_MANIFEST.json")));
  await verifyPackages(dir, data, Object.values(names).flat(), sha);
  if (fs.readFileSync(path.join(dir, "SHA256SUMS"), "utf8") !== sums(data.packages))
    throw new Error("Final checksum file mismatch.");
  console.log(`ARTIFACT PASS: six actual package byte checksums, source_sha=${sha}`);
  return data;
}
if (require.main === module) {
  const commands = { record, assemble, verify };
  const action = commands[process.argv[2]];
  (action ? action(...process.argv.slice(3)) : Promise.reject(new Error("Unknown artifact command.")))
    .catch(e => { console.error(e.message); process.exitCode = 1; });
}
module.exports = { names, record, assemble, verify, verifyPackages };
