// Local-only, reproducible MVP patches. No deploy, credentials or SQL writes.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { edges, root } from '../bootstrap/lib.mjs';
const dir = path.dirname(fileURLToPath(import.meta.url));
const adapted = new Set(['tokentracker-public-visibility','tokentracker-leaderboard',
  'tokentracker-leaderboard-profile','tokentracker-leaderboard-refresh']);
const typeOnly = new Set(['tokentracker-account-devices','tokentracker-account-summary']);
const hash = text => createHash('sha256').update(text).digest('hex');
function once(source, old, replacement) {
  if (source.split(old).length !== 2) throw new Error(`Upstream patch anchor changed: ${old.slice(0,80)}`);
  return source.replace(old, replacement);
}
function cut(source, start, end, replacement = '') {
  const a = source.indexOf(start), b = source.indexOf(end, a + start.length);
  if (a < 0 || b < 0 || source.indexOf(start, a+1) >= 0) throw new Error(`Upstream range changed: ${start}`);
  return source.slice(0,a) + replacement + source.slice(b);
}
const policy = `
// Explicit MVP contract: omitted capabilities are not simulated in the database.
const MVP_CAPABILITIES = {
  badges: false, likes: false, share: false, automatic_anticheat: false,
  quarantine: false, telemetry: false, community: false, subscription_value: false,
} as const;
function mvpPayload(data: unknown) {
  return {
    ...(data as Record<string, unknown>), capabilities: MVP_CAPABILITIES,
    ranking_policy: {
      basis: "client_reported_tokens", automatic_exclusion: false,
      manual_blocklist_configured: typeof Deno.env.get("LEADERBOARD_BLOCKED_USER_IDS") === "string",
    },
  };
}
`;
export function adapt(name, original) {
  let source = original;
  if (typeOnly.has(name)) {
    if (name === 'tokentracker-account-devices')
      source = once(source, 'function b64urlToBytes(s: string): Uint8Array {', 'function b64urlToBytes(s: string): Uint8Array<ArrayBuffer> {');
    if (name === 'tokentracker-account-summary')
      // The baseline source/model columns and aggregation dimensions are NOT NULL.
      source = once(source, 'cost_dims: [string | null, string | null, string | null,', 'cost_dims: [string, string, string | null,');
    return '// GENERATED TYPE-ONLY ADAPTER. Runtime JavaScript must equal upstream.\n' + source;
  }
  if (!adapted.has(name)) return source;
  source = once(source, 'import { createClient } from "npm:@insforge/sdk";',
    'import { createClient } from "npm:@insforge/sdk";\n' + policy);
  source = once(source, 'JSON.stringify(data)', 'JSON.stringify(mvpPayload(data))');
  if (name === 'tokentracker-public-visibility') {
    source = cut(source, '    const { data: pv } = await client.database', '    const { data: profile } = await client.database');
    source = once(source, 'share_token: pv?.token_hash || null,', 'share_token: null, // MVP share capability is explicitly false.');
    source = once(source, 'function b64urlToBytes(s: string): Uint8Array {', 'function b64urlToBytes(s: string): Uint8Array<ArrayBuffer> {');
    // Core settings/profile failures must not masquerade as disabled visibility.
    source = once(source, 'const { data } = await client.database', 'const { data, error: settingsError } = await client.database');
    source = once(source, 'const { data: profile } = await client.database', 'const { data: profile, error: profileError } = await client.database');
    source = once(source, '    return json({\n      enabled:', '    if (settingsError || profileError) return json({ error: "Failed to read visibility settings" }, 500);\n    return json({\n      enabled:');
  }
  if (name === 'tokentracker-leaderboard') {
    source = cut(source, '  // Achievement badges:', '  // `generated_at` belongs');
    source = once(source, '      ...badgesFor(e),\n', '');
    source = once(source, 'me: visibleMe ? { ...(visibleMe as Record<string, unknown>), ...badgesFor(visibleMe as { user_id?: string }) } : null,',
      'me: visibleMe ? { ...(visibleMe as Record<string, unknown>) } : null,');
  }
  if (name === 'tokentracker-leaderboard-profile') {
    source = cut(source, '  // Achievements only need', '  // Privacy gate.',
      '  // Reject the removed route explicitly; no badge RPC or fabricated results.\n  if (url.searchParams.get("view") === "badges") {\n    return json({ error: "unsupported_capability", capability: "badges" }, 501);\n  }\n\n');
    source = cut(source, '  // Hero/identity row:', '  const settings = ', `  // Core profile/settings only. Errors remain errors, not empty optional data.
  const [settingsRes, profileRes] = await Promise.all([
    client.database.from("tokentracker_user_settings")
      .select("leaderboard_anonymous, github_url, show_github_url").eq("user_id", userId).maybeSingle(),
    client.database.from("tokentracker_user_profiles")
      .select("display_name, avatar_url").eq("user_id", userId).maybeSingle(),
  ]);
  if (settingsRes.error || profileRes.error) return json({ error: "Failed to read leaderboard profile" }, 500);
`);
    source = once(source, '    badges,\n    badges_include_unearned: isSelf,\n', '');
  }
  if (name === 'tokentracker-leaderboard-refresh') {
    source = once(source, 'type RefreshAuthorization = "privileged" | "signed-in" | "public";', 'type RefreshAuthorization = "privileged" | "signed-in";');
    source = cut(source, '/**\n * Whether the block list was configured at all.', 'const BLOCKED_LEADERBOARD_USER_IDS');
    source = cut(source, '/**\n * GET ?anomalies=1', 'export default async function');
    source = cut(source, '  const wantsAnomalySummary =', '  const requestStartedAt =', `  if (requestParams.has("anomalies") || requestParams.has("quarantine_audit")) {
    return json({ error: "unsupported_capability", capability: "automatic_anticheat_or_quarantine" }, 501);
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const authorization = await authorizeRefresh(req);
  if (!authorization) return json({ error: "unauthorized" }, 401);
`);
    source = cut(source, '    // The protected anomaly RPC', '    timeout: 25_000,', '    // Keep the upstream timeout budget for the supported aggregation RPCs.\n');
    source = cut(source, '  if (authorization === "public")', '  const requestSource =', `  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  if (Object.hasOwn(body, "anti_cheat_reconcile_at") || Object.hasOwn(body, "scan_anomalies")) {
    return json({ error: "unsupported_capability", capability: "automatic_anticheat" }, 501);
  }
  const forceRefresh = body.force_refresh === true;
  if (forceRefresh && authorization !== "privileged")
    return json({ error: "privileged refresh operation required" }, 403);
  if (authorization === "signed-in" && body.period !== "week")
    return json({ error: "signed-in users may only refresh week" }, 403);

`);
    source = cut(source, '    // Soft exclusion from the automated anti-cheat detector', '    if (aggMap.size === 0)',
      '    // MVP: manual blocklist above remains active. Automated anomaly exclusion\n    // is unsupported and disclosed in every JSON response; uploads are not audited.\n\n');
    source = once(source, 'return json({ ok: true, results, ...(anomalyScan ? { scan: anomalyScan } : {}) });', 'return json({ ok: true, results });');
    source = once(source, '// If every user disappeared (for example, all were soft-excluded), clear', '// If every user disappeared (for example, all were manually blocked), clear');
    source = once(source, '(blocked accounts, anti-cheat exclusions, or accounts with no remaining', '(blocked accounts or accounts with no remaining');
    source = cut(source, '// "public" covers only the read-only anomaly-queue summary', 'type RefreshAuthorization');
  }
  return '// GENERATED MVP ADAPTER. Edit build-adapters.mjs; run it locally after reviewing upstream changes.\n' + source;
}
const manifest = {upstreamCommit: '619acd46208f5b5da0cd03dd05208ea656588e43', functions: []};
const outputs = new Map();
for (const name of edges) {
  const upstream = `dashboard/edge-patches/${name}.ts`;
  const original = fs.readFileSync(path.join(root, upstream), 'utf8').replace(/\r\n/g,'\n');
  const source = adapt(name, original);
  const changed = adapted.has(name) || typeOnly.has(name);
  const entry = changed ? `backend/edge/${name}.ts` : upstream;
  manifest.functions.push({name, entry, upstream, upstreamSha256: hash(original), entrySha256: hash(source), adapted: changed,
    adapterKind: adapted.has(name) ? 'mvp-capability' : typeOnly.has(name) ? 'type-compatibility' : null});
  if (changed) outputs.set(path.join(dir, `${name}.ts`), source);
}
outputs.set(path.join(dir,'manifest.json'), JSON.stringify(manifest,null,2)+'\n');
if (process.argv.includes('--check')) {
  for (const [filename,expected] of outputs) {
    if (!fs.existsSync(filename) || fs.readFileSync(filename,'utf8').replace(/\r\n/g,'\n') !== expected) throw new Error(`Adapter drift: ${path.basename(filename)}. Review upstream changes and regenerate.`);
  }
  console.log('PASS 4 MVP capability adapters, 2 type-only adapters and 13 source hashes match their reviewed patches');
} else {
  for (const [filename,source] of outputs) fs.writeFileSync(filename,source);
  console.log('Generated 4 MVP capability adapters, 2 type-only adapters and 13-function manifest; nothing deployed.');
}
