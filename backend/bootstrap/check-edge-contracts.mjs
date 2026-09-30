import { createTestDatabase, checkEdges } from './lib.mjs';
const db = await createTestDatabase();
try {
  const mode = process.argv.includes('--upstream') ? 'upstream' : 'mvp';
  const result = await checkEdges(db,mode);
  for (const row of result) console.log(`${row.satisfied ? 'PASS' : 'FAIL'} ${row.edge}${row.missing.length ? `: missing ${row.missing.join(', ')}` : ''}`);
  const failed = result.filter(r => !r.satisfied).length;
  console.log(`${result.length - failed}/${result.length} complete ${mode} Edge dependency sets; ${failed} blocked. No exclusions are suppressed.`);
  if (failed) process.exitCode = 1;
} finally { await db.close(); }
