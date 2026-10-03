"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const { validateReleaseClientConfig, OWN_BASE_URL } = require("../scripts/prepare-release-client-config.cjs");

test("release client configuration rejects missing or foreign backend targets", () => {
  for (const target of [undefined, "", "https://srctyff5.us-east.insforge.app", "https://example.com"]) {
    assert.throws(() => validateReleaseClientConfig({ VITE_INSFORGE_BASE_URL: target,
      VITE_INSFORGE_ANON_KEY: "public-client-fixture" }), /Community InsForge project/);
  }
});

test("release client configuration rejects missing and management credentials", () => {
  for (const credential of [undefined, "", "ik_fixture", "uak_fixture", "sk_fixture", "service_role_fixture"]) {
    assert.throws(() => validateReleaseClientConfig({ VITE_INSFORGE_BASE_URL: OWN_BASE_URL,
      VITE_INSFORGE_ANON_KEY: credential }), /public client credential/);
  }
});

test("release accepts the explicit project public credential without assuming it is a JWT", () => {
  const config = validateReleaseClientConfig({ VITE_INSFORGE_BASE_URL: `${OWN_BASE_URL}/`,
    VITE_INSFORGE_ANON_KEY: "public-client-fixture" });
  assert.equal(config.baseUrl, OWN_BASE_URL);
  assert.equal(config.anonKey, "public-client-fixture");
});

function withPackagedRuntime(config, action) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "community-release-config-"));
  const modulePath = path.join(directory, "runtime-config.js");
  try {
    fs.copyFileSync(path.resolve(__dirname, "../src/lib/runtime-config.js"), modulePath);
    fs.writeFileSync(path.join(directory, "release-client-config.json"), JSON.stringify(config));
    return action(modulePath);
  } finally {
    delete require.cache[modulePath];
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

test("packaged client ignores persisted, CLI and environment backend overrides", () => {
  withPackagedRuntime({ baseUrl: OWN_BASE_URL, anonKey: "public-client-fixture" }, modulePath => {
    const { resolveRuntimeConfig } = require(modulePath);
    const foreign = { baseUrl: "https://srctyff5.us-east.insforge.app", anonKey: "foreign-fixture" };
    const runtime = resolveRuntimeConfig({ cli: foreign, config: foreign,
      env: { TOKENTRACKER_INSFORGE_BASE_URL: foreign.baseUrl, TOKENTRACKER_INSFORGE_ANON_KEY: foreign.anonKey } });
    assert.equal(runtime.baseUrl, OWN_BASE_URL);
    assert.equal(runtime.anonKey, "public-client-fixture");
    assert.equal(runtime.sources.baseUrl, "release");
  });
});

test("invalid packaged configuration fails instead of falling back to persisted credentials", () => {
  withPackagedRuntime({ baseUrl: "https://srctyff5.us-east.insforge.app", anonKey: "public-client-fixture" }, modulePath => {
    assert.throws(() => require(modulePath), /Invalid Community release client configuration/);
  });
});

test("source runtime has no official backend or credential fallback", () => {
  const { resolveRuntimeConfig } = require("../src/lib/runtime-config");
  const runtime = resolveRuntimeConfig({ config: { baseUrl: "https://srctyff5.us-east.insforge.app" }, env: {} });
  assert.equal(runtime.baseUrl, null);
  assert.equal(runtime.anonKey, null);
});
