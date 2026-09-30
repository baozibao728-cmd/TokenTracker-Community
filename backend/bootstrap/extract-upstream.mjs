// Local-only extraction of FINAL upstream definitions, never historical DML.
// Run deliberately after reviewing an upstream merge; tests verify provenance.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dir, '../..');
const provenance = [];
const read = name => fs.readFileSync(path.join(root, 'migrations', name), 'utf8').replace(/\r\n/g, '\n');
function take(file, name, kind = 'function', rename = name) {
  const source = read(file);
  let sql;
  if (kind === 'function') {
    const start = source.search(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${name}\\(`));
    if (start < 0) throw new Error(`Missing ${name}`);
    const tail = source.slice(start);
    const delimiter = tail.match(/\bAS\s+(\$\w*\$)/i);
    if (!delimiter) throw new Error(`No body for ${name}`);
    const end = tail.indexOf(delimiter[1] + ';', delimiter.index + delimiter[0].length);
    if (end < 0) throw new Error(`No end for ${name}`);
    sql = tail.slice(0, end + delimiter[1].length + 1);
  } else {
    const pattern = kind === 'table' ? `CREATE (?:UNLOGGED )?TABLE (?:IF NOT EXISTS )?(?:public\\.)?${name}\\s*\\(` : `CREATE (?:UNIQUE )?${kind.toUpperCase()} (?:IF NOT EXISTS )?${name}\\b`;
    const start = source.search(new RegExp(pattern));
    if (start < 0) throw new Error(`Missing ${kind} ${name}`);
    sql = source.slice(start, source.indexOf(';', start) + 1);
  }
  if (rename !== name) sql = sql.replace(`public.${name}(`, `public.${rename}(`);
  provenance.push({file: `migrations/${file}`, name, kind, installedName: rename, sha256: createHash('sha256').update(sql).digest('hex')});
  return `-- UPSTREAM: migrations/${file} :: ${name}${rename !== name ? ` (promoted as ${rename})` : ''}\n${sql}\n`;
}
function write(name, parts) { fs.writeFileSync(path.join(dir, name), '-- Final upstream definitions only; provenance.json records exact extracted hashes.\n\n' + parts.join('\n')); }
write('002_device_identity.sql', [take('20260719152022_harden-backend-concurrency.sql', 'refresh_tokentracker_device_identity')]);
const sessions = '20260817120000_account-session-states.sql';
write('003_account_session_states.sql', [take(sessions, 'tokentracker_account_session_states', 'table'), take(sessions, 'tokentracker_account_session_states_bucket_idx', 'index'), take(sessions, 'tokentracker_upsert_account_session_states')]);
write('004_account_usage_rpc.sql', [
  take('20260718071507_add-shared-account-usage-cache.sql', 'tokentracker_account_usage_cache', 'table'),
  take('20260718071507_add-shared-account-usage-cache.sql', 'tokentracker_account_usage_cache_fetched_at_idx', 'index'),
  take('20260904083630_add-single-scan-account-usage-candidate.sql', 'account_usage_grouped_single_scan_candidate', 'function', 'account_usage_grouped'),
  take('20260904090000_promote-single-scan-account-usage.sql', 'account_usage_grouped_v2'),
  take('20260821173500_deepseek-v4-time-pricing.sql', 'account_usage_grouped_cached'),
  take('20260918041500_fold-account-summary-and-heatmap-aggregation.sql', 'account_summary_compact'),
  take('20260918041500_fold-account-summary-and-heatmap-aggregation.sql', 'account_heatmap_compact'),
  take('20260918043000_fold-account-model-breakdown-aggregation.sql', 'account_model_breakdown_compact'),
  take('20260918050000_fold-account-daily-aggregation.sql', 'account_daily_compact'),
]);
const totals = '20260904064000_cache-leaderboard-total-rollup.sql';
write('006a_leaderboard_upstream.sql', [
  take('20260804043427_align-leaderboard-machine-clusters.sql', 'tokentracker_leaderboard_rollup_meta_v2', 'table'),
  take(totals, 'tokentracker_leaderboard_rollup_total_v2', 'table'),
  take(sessions, 'leaderboard_hourly_dedup_v2'),
  ...['insert', 'delete', 'update'].map(op => take(totals, `leaderboard_rollup_total_v2_after_${op}`)),
  ...['insert', 'delete', 'update'].map(op => take(totals, `tokentracker_leaderboard_rollup_daily_v2_total_${op}`, 'trigger')),
]);
write('007a_leaderboard_rpc.sql', [
  take(sessions, 'leaderboard_rollup_daily_advance_v2'),
  take(totals, 'leaderboard_usage_grouped'),
  take('20260904064500_shard-leaderboard-total-read.sql', 'leaderboard_usage_grouped_total_shard'),
  take('20260717013000_harden-backend-hot-paths.sql', 'leaderboard_user_metadata'),
]);
fs.writeFileSync(path.join(dir, 'provenance.json'), JSON.stringify({upstreamCommit: '619acd46208f5b5da0cd03dd05208ea656588e43', objects: provenance}, null, 2) + '\n');
