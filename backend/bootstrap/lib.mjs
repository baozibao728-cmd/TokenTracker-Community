import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
export async function checkEdges(db) {
  const relations = new Set((await db.query("SELECT relname FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind IN ('r','v')")).rows.map(r => r.relname));
  const functions = (await db.query("SELECT proname,proargnames,pronargs,pronargdefaults FROM pg_proc WHERE pronamespace='public'::regnamespace")).rows;
  const columns = (await db.query("SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public'")).rows;
  return edges.map(edge => {
    const source = fs.readFileSync(path.join(root, 'dashboard/edge-patches', `${edge}.ts`), 'utf8');
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
    return {edge, tables, rpcs, missing:[...new Set(missing)], satisfied: missing.length === 0};
  });
}
