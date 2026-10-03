"use strict";

const fs = require("node:fs");
const path = require("node:path");

const OWN_BASE_URL = "https://tc79bxhm.ap-southeast.insforge.app";
const repoRoot = path.resolve(__dirname, "..");
const output = path.join(repoRoot, ".tmp", "release-client-config.json");

function validateReleaseClientConfig(env = process.env) {
  const baseUrl = String(env.VITE_INSFORGE_BASE_URL || "").trim().replace(/\/$/, "");
  const anonKey = String(env.VITE_INSFORGE_ANON_KEY || "").trim();
  if (baseUrl !== OWN_BASE_URL) {
    throw new Error("Release backend must be the TokenTracker-Community InsForge project.");
  }
  if (!anonKey || /^(?:ik_|uak_|sk_|service[_-]?role)/i.test(anonKey)) {
    throw new Error("Release requires a public client credential, never a server or user API key.");
  }
  return { baseUrl, anonKey };
}

function prepareReleaseClientConfig(env = process.env) {
  // Invalid input must not leave an older configuration available to packaging.
  let config;
  try {
    config = validateReleaseClientConfig(env);
  } catch (error) {
    fs.rmSync(output, { force: true });
    throw error;
  }
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(config) + "\n", { mode: 0o600 });
  return output;
}

if (require.main === module) {
  try {
    prepareReleaseClientConfig();
    process.stdout.write("Release client configuration validated and staged locally.\n");
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { validateReleaseClientConfig, prepareReleaseClientConfig, OWN_BASE_URL };
