const OWN_BASE_URL = "https://tc79bxhm.ap-southeast.insforge.app";
const LEGACY_INSFORGE_HOSTS = new Set([
  "b46ug8xu.us-east.insforge.app",
  "srctyff5.us-east.insforge.app",
]);
const DEFAULT_DASHBOARD_URL = "";
const DEFAULT_HTTP_TIMEOUT_MS = 20_000;

// Release packaging places this generated, gitignored client configuration in
// the embedded runtime. It is never sourced from an upstream default or CLI
// user credential. In a release it locks the backend even when an old config
// file is present on the machine.
let releaseClientConfig = null;
if (require("node:fs").existsSync(require("node:path").join(__dirname, "release-client-config.json"))) {
  const candidate = require("./release-client-config.json");
  if (candidate?.baseUrl !== OWN_BASE_URL || typeof candidate.anonKey !== "string" || !candidate.anonKey.trim()
    || /^(?:ik_|uak_|sk_|service[_-]?role)/i.test(candidate.anonKey)) {
    throw new Error("Invalid Community release client configuration");
  }
  releaseClientConfig = candidate;
}
const DEFAULT_BASE_URL = releaseClientConfig?.baseUrl || null;
const DEFAULT_ANON_KEY = releaseClientConfig?.anonKey || null;

function resolveRuntimeConfig({ cli = {}, config = {}, env = process.env, defaults = {} } = {}) {
  // Older Windows test runs could leak their fixture HOME and persist
  // https://example.invalid into the user's real config.json. The test
  // isolation bug is fixed, but existing installs must recover instead of
  // backing off cloud uploads forever against the reserved placeholder host.
  const persistedBaseUrl = normalizePersistedBaseUrl(config.baseUrl);
  const baseUrl = releaseClientConfig ? { value: OWN_BASE_URL, source: "release" } : pickString(
    cli.baseUrl,
    persistedBaseUrl,
    env?.TOKENTRACKER_INSFORGE_BASE_URL,
    defaults.baseUrl,
    DEFAULT_BASE_URL,
  );
  const anonKey = releaseClientConfig ? { value: releaseClientConfig.anonKey, source: "release" } : pickString(
    cli.anonKey,
    config.anonKey,
    env?.TOKENTRACKER_INSFORGE_ANON_KEY,
    defaults.anonKey,
    DEFAULT_ANON_KEY,
  );
  const dashboardUrl = pickString(
    cli.dashboardUrl,
    config.dashboardUrl,
    env?.TOKENTRACKER_DASHBOARD_URL,
    defaults.dashboardUrl,
    DEFAULT_DASHBOARD_URL,
  );
  const deviceToken = pickString(
    cli.deviceToken,
    config.deviceToken,
    env?.TOKENTRACKER_DEVICE_TOKEN,
    defaults.deviceToken,
    null,
  );
  const httpTimeoutMs = pickHttpTimeoutMs(
    cli.httpTimeoutMs,
    config.httpTimeoutMs,
    env?.TOKENTRACKER_HTTP_TIMEOUT_MS,
    defaults.httpTimeoutMs,
    DEFAULT_HTTP_TIMEOUT_MS,
  );
  const debug = pickBoolean(cli.debug, config.debug, env?.TOKENTRACKER_DEBUG, defaults.debug, false);
  const autoRetryNoSpawn = pickBoolean(
    cli.autoRetryNoSpawn,
    config.autoRetryNoSpawn,
    env?.TOKENTRACKER_AUTO_RETRY_NO_SPAWN,
    defaults.autoRetryNoSpawn,
    false,
  );

  return {
    baseUrl: baseUrl.value,
    anonKey: anonKey.value,
    dashboardUrl: dashboardUrl.value,
    deviceToken: deviceToken.value,
    httpTimeoutMs: httpTimeoutMs.value,
    debug: debug.value,
    autoRetryNoSpawn: autoRetryNoSpawn.value,
    sources: {
      baseUrl: baseUrl.source,
      anonKey: anonKey.source,
      dashboardUrl: dashboardUrl.source,
      deviceToken: deviceToken.source,
      httpTimeoutMs: httpTimeoutMs.source,
      debug: debug.source,
      autoRetryNoSpawn: autoRetryNoSpawn.source,
    },
  };
}

function pickString(...candidates) {
  return pickValue(candidates, normalizeString);
}

function pickBoolean(...candidates) {
  return pickValue(candidates, normalizeBoolean);
}

function pickHttpTimeoutMs(...candidates) {
  return pickValue(candidates, normalizeHttpTimeoutMs);
}

function pickValue(candidates, normalize) {
  const labels = ["cli", "config", "env", "default", "default"];
  for (let i = 0; i < candidates.length; i += 1) {
    const value = normalize(candidates[i]);
    if (value !== undefined) {
      return { value, source: labels[i] || "default" };
    }
  }
  return { value: null, source: "default" };
}

function normalizeString(value) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed;
}

function normalizePersistedBaseUrl(value) {
  const normalized = normalizeString(value);
  if (normalized === undefined) return undefined;
  try {
    const hostname = new URL(normalized).hostname.toLowerCase();
    if (hostname === "example.invalid") return undefined;
    if (LEGACY_INSFORGE_HOSTS.has(hostname)) return undefined;
  } catch {
    // Preserve the existing resolver behavior for arbitrary custom values.
  }
  return normalized;
}

// True when the value points at a retired InsForge project (dead backend).
// Callers use this to trigger the one-time config repair in sync.
function isLegacyInsforgeBaseUrl(value) {
  const normalized = normalizeString(value);
  if (normalized === undefined) return false;
  try {
    return LEGACY_INSFORGE_HOSTS.has(new URL(normalized).hostname.toLowerCase());
  } catch {
    return false;
  }
}

function normalizeBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) return undefined;
    if (trimmed === "1" || trimmed === "true") return true;
    if (trimmed === "0" || trimmed === "false") return false;
  }
  return undefined;
}

function normalizeHttpTimeoutMs(value) {
  if (value == null || value === "") return undefined;
  const n = Number(value);
  if (!Number.isFinite(n)) return undefined;
  if (n <= 0) return 0;
  return clampInt(n, 1000, 120_000);
}

function clampInt(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

module.exports = {
  DEFAULT_BASE_URL,
  DEFAULT_ANON_KEY,
  DEFAULT_DASHBOARD_URL,
  DEFAULT_HTTP_TIMEOUT_MS,
  resolveRuntimeConfig,
  isLegacyInsforgeBaseUrl,
};
