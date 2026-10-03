"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { validateReleaseClientConfig } = require("../prepare-release-client-config.cjs");

function walk(root) {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(root, entry.name);
    return entry.isDirectory() ? walk(file) : entry.isFile() ? [file] : [];
  });
}
function verifyRuntime(root, nativeBinary, platform) {
  const expected = validateReleaseClientConfig();
  const version = require("../../package.json").version;
  const tracker = path.join(root, "tokentracker");
  const required = ["bin/tracker.js", "package.json", "src/lib/runtime-config.js",
    "src/lib/release-client-config.json", "dashboard/dist/index.html", "dashboard/dist/quota.html"];
  if (platform === "windows") required.push("dashboard/dist/pet.html");
  for (const file of required) {
    if (!fs.statSync(path.join(tracker, file)).isFile()) throw new Error(`Missing runtime payload: ${file}`);
  }
  if (JSON.parse(fs.readFileSync(path.join(tracker, "package.json"))).version !== version)
    throw new Error("Packaged tracker version mismatch.");
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
  console.log(`PACKAGE PASS ${platform}: actual runtime, version ${version}, own backend and updater ownership`);
}
if (require.main === module) {
  try { verifyRuntime(...process.argv.slice(2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { verifyRuntime };
