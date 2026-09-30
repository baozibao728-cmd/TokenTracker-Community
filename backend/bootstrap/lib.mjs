import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { inspectEdge } from './edge-contracts.mjs';
export const dir = path.dirname(fileURLToPath(import.meta.url));
export const root = path.resolve(dir, '../..');
export const sqlFiles = fs.readdirSync(dir).filter(n => /^\d{3}[a-z]?_.*\.sql$/.test(n)).sort();
export const read = name => fs.readFileSync(path.join(dir, name), 'utf8');
export async function createTestDatabase() {
  // No connection URL accepted; never reads .insforge, .env or credentials.
  const db = new PGlite();
  try {
    await db.exec(read('test-platform.sql'));
    await db.exec('SET ROLE project_admin; BEGIN;');
    for (const file of sqlFiles) {
      try { await db.exec(read(file)); }
      catch (error) { throw new Error(`${file}: ${error.message}`, {cause: error}); }
    }
    await db.exec('COMMIT;');
    return db;
  } catch (error) { await db.close(); throw error; }
}
export const edges = [
  'device-token-issue', 'ingest', 'account-summary', 'account-daily',
  'account-hourly', 'account-monthly', 'account-heatmap', 'account-model-breakdown',
  'account-devices', 'public-visibility', 'leaderboard-refresh', 'leaderboard', 'leaderboard-profile',
].map(n => `tokentracker-${n}`);
export function edgeEntries(mode = 'mvp') {
  if (mode === 'upstream') return edges.map(name=>({name,entry:`dashboard/edge-patches/${name}.ts`}));
  if (mode !== 'mvp') throw new Error(`Unknown Edge mode: ${mode}`);
  const manifest = JSON.parse(fs.readFileSync(path.join(root,'backend/edge/manifest.json'),'utf8'));
  if (manifest.functions.length !== edges.length || new Set(manifest.functions.map(f=>f.name)).size !== edges.length) throw new Error('MVP manifest must contain all 13 functions exactly once');
  for (const row of manifest.functions) {
    if (!edges.includes(row.name) || ![`backend/edge/${row.name}.ts`,`dashboard/edge-patches/${row.name}.ts`].includes(row.entry)
      || row.upstream !== `dashboard/edge-patches/${row.name}.ts`) throw new Error('Invalid MVP manifest entry');
    for (const [filename,expected] of [[row.upstream,row.upstreamSha256],[row.entry,row.entrySha256]]) {
      const source = fs.readFileSync(path.join(root,filename),'utf8').replace(/\r\n/g,'\n');
      if (createHash('sha256').update(source).digest('hex') !== expected) throw new Error(`Source drift: ${filename}; review before regenerating adapters`);
    }
  }
  return manifest.functions;
}
export async function checkEdges(db, mode = 'mvp') {
  const relations = new Set((await db.query("SELECT relname FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind IN ('r','v')")).rows.map(r => r.relname));
  const functions = (await db.query("SELECT proname,proargnames,pronargs,pronargdefaults FROM pg_proc WHERE pronamespace='public'::regnamespace")).rows;
  const columns = (await db.query("SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public'")).rows;
  return edgeEntries(mode).map(({name:edge,entry}) => {
    const source = fs.readFileSync(path.join(root,entry), 'utf8');
    const actual = inspectEdge(source, edge);
    const tables = [...actual.tables.keys()], rpcs = [...new Set(actual.rpcs.map(r=>r.name))];
    const missing = tables.filter(n => !relations.has(n));
    for (const [table, fields] of actual.tables) {
      if (relations.has(table)) for (const field of fields) {
        if (!columns.some(c=>c.table_name === table && c.column_name === field)) missing.push(`${table}.${field}`);
      }
    }
    for (const rpc of actual.rpcs) {
      const candidates = functions.filter(f=>f.proname === rpc.name);
      if (!candidates.length) { missing.push(rpc.name); continue; }
      const compatible = candidates.some(f => {
        const args = f.proargnames || [];
        return rpc.args.every(a=>args.includes(a)) && args.slice(0,f.pronargs-f.pronargdefaults).every(a=>rpc.args.includes(a));
      });
      if (!compatible) missing.push(`${rpc.name}(${rpc.args.join(',')}) signature mismatch`);
    }
    return {edge, entry, tables, rpcs, missing:[...new Set(missing)], satisfied: missing.length === 0};
  });
}
