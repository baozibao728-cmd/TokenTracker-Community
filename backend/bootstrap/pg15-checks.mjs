import assert from 'node:assert/strict';
import { createPg15Database } from './pg15-runtime.mjs';
import { read, sqlFiles, checkEdges } from './lib.mjs';
import { checkMigration } from '../deploy/build-migration.mjs';
const db=await createPg15Database();
let passed=0;
async function test(name,fn) {await fn();passed++;console.log(`PASS PG15 ${name}`);}
const rows=async sql=>(await db.query(sql)).rows;
const catalog=async()=>({
  relations:await rows("SELECT c.relname,c.relkind,c.relpersistence,c.relrowsecurity,c.relacl::text AS acl,pg_get_userbyid(c.relowner) AS owner FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relkind IN ('r','v') ORDER BY c.relname"),
  columns:await rows("SELECT table_name,column_name,data_type,is_nullable,column_default,is_generated,generation_expression FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position"),
  functions:await rows("SELECT proname,pg_get_functiondef(oid) AS definition,proacl::text AS acl FROM pg_proc WHERE pronamespace='public'::regnamespace ORDER BY proname"),
  constraints:await rows("SELECT c.relname,co.conname,pg_get_constraintdef(co.oid) AS definition FROM pg_constraint co JOIN pg_class c ON c.oid=co.conrelid WHERE c.relnamespace='public'::regnamespace ORDER BY c.relname,co.conname"),
  indexes:await rows("SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY indexname"),
  triggers:await rows("SELECT tgname,tgenabled,pg_get_triggerdef(t.oid) AS definition FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='public'::regnamespace AND NOT tgisinternal ORDER BY tgname"),
  views:await rows("SELECT viewname,definition FROM pg_views WHERE schemaname='public' ORDER BY viewname"),
});
try {
  await db.exec(read('test-platform.sql'));
  const migration=checkMigration();
  await test('failure midway through single migration rolls back ALL application objects',async()=>{
    const marker='-- BEGIN SOURCE: backend/bootstrap/003_account_session_states.sql';
    assert.ok(migration.includes(marker));
    await db.exec('BEGIN; SET LOCAL ROLE project_admin');
    await assert.rejects(()=>db.exec(migration.replace(marker,'SELECT 1/0;\n'+marker)),/division by zero/);
    await db.exec('ROLLBACK');
    const empty=await catalog();
    assert.ok(Object.values(empty).every(items=>items.length===0));
    assert.equal((await rows("SELECT to_regclass('auth.users') IS NOT NULL AS preserved"))[0].preserved,true);
  });
  let sourceCatalog;
  await test('original 12 files execute entirely as project_admin on PostgreSQL 15.18',async()=>{
    await db.exec('BEGIN; SET LOCAL ROLE project_admin');
    for(const name of sqlFiles) await db.exec(read(name));
    sourceCatalog=await catalog();
    await db.exec('ROLLBACK');
  });
  await test('single release migration is catalog-equivalent including RPC bodies/ACL/indexes/triggers',async()=>{
    await db.exec('BEGIN; SET LOCAL ROLE project_admin');
    await db.exec(migration);
    assert.deepEqual(await catalog(),sourceCatalog);
    await db.exec('COMMIT; SET ROLE project_admin');
    const objects=await catalog();
    assert.equal(objects.relations.filter(r=>r.relkind==='r').length,12);
    assert.equal(objects.views.length,1);
    assert.equal(objects.functions.length,21);
    assert.equal(objects.triggers.length,4);
    assert.equal(objects.indexes.length,23);
    console.log('PG15 objects: 12 tables, 1 view, 21 functions, 4 triggers, 23 indexes');
    // No generated columns or expression indexes are introduced by this baseline.
    // The real CREATE/index definitions above are executed, not substituted probes.
    console.log(`PG15 baseline generated columns=${objects.columns.filter(c=>c.is_generated!=='NEVER').length}; expression indexes=${(await rows("SELECT count(*)::int AS n FROM pg_index i JOIN pg_class c ON c.oid=i.indrelid WHERE c.relnamespace='public'::regnamespace AND i.indexprs IS NOT NULL"))[0].n}`);
  });
  await test('13 actual MVP Edge database dependencies close on PG15',async()=>{
    const checks=await checkEdges(db);
    assert.equal(checks.length,13);
    assert.deepEqual(checks.filter(r=>!r.satisfied),[]);
  });
  await test('generated column and partial expression index syntax works in an isolated TEMP probe',async()=>{
    // Baseline has neither feature. This explicitly labelled syntax probe is NOT
    // a substitute for any missing business object and is never in the migration.
    await db.exec('BEGIN');
    try {
      await db.exec('CREATE TEMP TABLE pg15_syntax_probe (label text, input_tokens bigint, output_tokens bigint, total_tokens bigint GENERATED ALWAYS AS (input_tokens+output_tokens) STORED)');
      await db.exec('CREATE INDEX pg15_expression_probe ON pg15_syntax_probe (lower(label)) WHERE total_tokens > 0');
      const value=await rows("INSERT INTO pg15_syntax_probe(label,input_tokens,output_tokens) VALUES('MODEL',7,4) RETURNING total_tokens::int AS total");
      assert.equal(value[0].total,11);
      assert.equal((await rows("SELECT indexprs IS NOT NULL AND indpred IS NOT NULL AS covered FROM pg_index WHERE indexrelid='pg15_expression_probe'::regclass"))[0].covered,true);
    } finally {await db.exec('ROLLBACK');}
    assert.equal((await rows("SELECT to_regclass('pg15_syntax_probe') IS NULL AS absent"))[0].absent,true);
  });
  console.log(`Real PostgreSQL 15.18 release checks passed: ${passed}`);
} finally {await db.close();}
