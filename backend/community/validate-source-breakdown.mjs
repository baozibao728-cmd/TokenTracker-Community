// Real isolated PostgreSQL 15 upgrade/rollback regression. No URLs or credentials.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPg15Database } from '../bootstrap/pg15-runtime.mjs';
import { checkMigration as checkFoundationMigration, buildMigration as foundationMigration } from '../deploy/build-migration.mjs';
import { buildMigration as communityMigration, checkMigration as checkCommunityMigration } from './build-migration.mjs';
import { buildMigration as sourceBreakdownMigration, buildRollback, checkArtifacts } from './build-source-breakdown-migration.mjs';

const db = await createPg15Database();
const dir = path.dirname(fileURLToPath(import.meta.url));
const uid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const [a, b, c, zero, outsider] = [1, 2, 3, 4, 5].map(uid);
const query = async (sql, args = []) => (await db.query(sql, args)).rows;
const scalar = async (sql, args = []) => Object.values((await query(sql, args))[0])[0];
const rpc = async (name, args, connection = db) => (await connection.query(
  `SELECT public.${name}(${args.map((_, i) => `$${i + 1}`).join(',')}) AS value`, args,
)).rows[0].value;
const samePublicFields = result => Object.fromEntries(Object.entries(result).filter(([key]) => key !== 'rows' && key !== 'me'));
const sourceFields = [
  'gpt_tokens', 'claude_tokens', 'gemini_tokens', 'cursor_tokens', 'kiro_tokens',
  'copilot_tokens', 'kimi_tokens', 'opencode_tokens', 'openclaw_tokens', 'hermes_tokens', 'other_tokens',
];

async function foundationCatalog() {
  return query(`SELECT 'relation' AS kind,relname AS name,to_jsonb(c)-'oid'-'relfilenode'-'relpages'-'reltuples'-'relallvisible' AS definition
    FROM pg_class c WHERE relnamespace='public'::regnamespace AND relname NOT LIKE 'communit%'
    UNION ALL SELECT 'function',proname,to_jsonb(p)-'oid' FROM pg_proc p
      WHERE pronamespace='public'::regnamespace AND proname NOT LIKE 'community_%'
    ORDER BY kind,name`);
}

async function foundationDataFingerprint() {
  const relations = await query(`SELECT 'public' AS schema_name,tablename AS relation_name FROM pg_tables
      WHERE schemaname='public' AND tablename NOT LIKE 'communit%'
    UNION ALL SELECT 'public',viewname FROM pg_views
      WHERE schemaname='public' AND viewname NOT LIKE 'communit%'
    UNION ALL SELECT 'auth','users'
    ORDER BY schema_name,relation_name`);
  const fingerprints = [];
  for (const relation of relations) {
    const schema = relation.schema_name === 'auth' ? 'auth' : 'public';
    const table = relation.relation_name.replaceAll('"', '""');
    const fingerprint = await query(`SELECT count(*)::text AS row_count,
      md5(coalesce(string_agg(to_jsonb(t)::text,chr(10) ORDER BY to_jsonb(t)::text),'')) AS digest
      FROM ${schema}."${table}" t`);
    fingerprints.push({ ...relation, ...fingerprint[0] });
  }
  return fingerprints;
}

async function communityRpcContract() {
  return query(`SELECT pg_get_userbyid(p.proowner) AS owner,
      p.proargtypes::regtype[]::text AS argument_types,p.proargnames,
      pg_get_expr(p.proargdefaults,0) AS argument_defaults,
      p.provolatile,p.prosecdef,p.proconfig,p.proacl::text AS acl,
      pg_get_function_identity_arguments(p.oid) AS identity_arguments
    FROM pg_proc p WHERE p.oid='public.community_leaderboard(uuid,uuid,text,integer,integer,uuid[],timestamp with time zone)'::regprocedure`);
}

async function publicHasExecute() {
  return scalar(`SELECT EXISTS(SELECT 1 FROM pg_proc p,
      LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
    WHERE p.oid='public.community_leaderboard(uuid,uuid,text,integer,integer,uuid[],timestamp with time zone)'::regprocedure
      AND acl.grantee=0 AND acl.privilege_type='EXECUTE')`);
}

async function leaderboard(actor, communityId, period = 'week', limit = 50, offset = 0, excluded = []) {
  return rpc('community_leaderboard', [actor, communityId, period, limit, offset, excluded, '2026-10-01T12:00:00Z']);
}

async function addBucket(user, device, source, model, tokens, time = '2026-10-01T10:00:00Z') {
  await db.query(`INSERT INTO public.tokentracker_hourly(user_id,device_id,hour_start,source,model,input_tokens,total_tokens,conversations)
    VALUES($1,$2,$3,$4,$5,$6,$6,1)`, [user, device, time, source, model, String(tokens)]);
}

let passed = 0;
async function test(name, action) {
  await action();
  passed++;
  console.log(`PASS ${name}`);
}

try {
  checkFoundationMigration();
  checkCommunityMigration();
  checkArtifacts();
  await db.exec(fs.readFileSync(path.resolve(dir, '../bootstrap/test-platform.sql'), 'utf8'));
  await db.exec('SET ROLE project_admin; BEGIN');
  await db.exec(foundationMigration());
  await db.exec('COMMIT');
  await db.exec('SET ROLE project_admin; BEGIN');
  await db.exec(communityMigration());
  await db.exec('COMMIT');

  const foundationBaseline = await foundationCatalog();
  const contractBefore = await communityRpcContract();
  const authRows = [a, b, c, zero, outsider].map((id, index) =>
    `('${id}','community-source-${index}@example.invalid',NULL,NULL)`).join(',');
  await db.exec(`RESET ROLE; INSERT INTO auth.users(id,email,profile,metadata) VALUES ${authRows}; SET ROLE project_admin`);
  const devices = [a, b, c, zero, outsider].map((id, index) =>
    `('${uid(10000 + index)}','${id}','source-fixture-${index}','local-test')`).join(',');
  await db.exec(`INSERT INTO public.tokentracker_devices(id,user_id,device_name,platform) VALUES ${devices}`);
  const deviceFor = new Map([a, b, c, zero, outsider].map((id, index) => [id, uid(10000 + index)]));
  const created = await rpc('community_create', [a, 'Source breakdown fixture', null, { max_owned: 2, max_joined: 4, max_members: 5 }]);
  assert.equal(created.ok, true, JSON.stringify(created));
  const communityId = created.community.id;
  for (const member of [b, c, zero]) {
    const joined = await rpc('community_join', [member, created.community.invite_code, { max_owned: 2, max_joined: 4, max_members: 5 }]);
    assert.equal(joined.ok, true, JSON.stringify(joined));
  }

  const sources = [
    ['codex', 'gpt-4.1', '9007199254740993'], ['codex', 'gpt-5.1', '9007199254740993'],
    ['claude', 'claude-sonnet', 10], ['pi-anthropic', 'claude-opus', 11], ['gemini', 'gemini-pro', 12],
    ['cursor', 'cursor-model', 13], ['kiro', 'kiro-model', 14],
    ['copilot', 'copilot-model', 15], ['pi-github-copilot', 'copilot-model', 16], ['pi-copilot', 'copilot-model', 17],
    ['kimi', 'kimi-model', 18], ['opencode', 'opencode-model', 19], ['openclaw', 'openclaw-model', 20],
    ['hermes', 'hermes-model', 21], ['unknown-provider', 'gpt-5.4', 22],
  ];
  for (const [source, model, tokens] of sources) await addBucket(a, deviceFor.get(a), source, model, tokens);
  await addBucket(a, deviceFor.get(a), 'gemini', 'pre-week', 7, '2026-09-27T23:30:00Z');
  await addBucket(a, deviceFor.get(a), 'cursor', 'october-end', 100, '2026-10-31T23:30:00Z');
  await addBucket(a, deviceFor.get(a), 'unknown-provider', 'november-boundary', 200, '2026-11-01T00:00:00Z');
  for (const member of [b, c]) {
    await addBucket(member, deviceFor.get(member), 'codex', 'tie-gpt', 10);
    await addBucket(member, deviceFor.get(member), 'claude', 'tie-claude', 20);
  }
  await addBucket(outsider, deviceFor.get(outsider), 'codex', 'outsider', 999999);

  const foundationDataBefore = await foundationDataFingerprint();
  const contractBeforeUpgrade = await communityRpcContract();
  const legacy = {};
  for (const period of ['week', 'month', 'total']) legacy[period] = await leaderboard(a, communityId, period);
  legacy.page = await leaderboard(a, communityId, 'week', 1, 1);
  const anonymousBefore = {};
  for (const role of ['anon', 'authenticated']) {
    anonymousBefore[role] = await scalar(`SELECT has_function_privilege($1,
      'public.community_leaderboard(uuid,uuid,text,integer,integer,uuid[],timestamp with time zone)'::regprocedure,'EXECUTE')`, [role]);
  }
  anonymousBefore.PUBLIC = await publicHasExecute();

  await test('upgrade preserves Foundation catalog/data fingerprints and Community RPC contract/ACL', async () => {
    await db.exec('BEGIN');
    await db.exec(sourceBreakdownMigration());
    await db.exec('COMMIT');
    assert.deepEqual(await foundationCatalog(), foundationBaseline);
    assert.deepEqual(await foundationDataFingerprint(), foundationDataBefore);
    assert.deepEqual(await communityRpcContract(), contractBeforeUpgrade);
    assert.deepEqual(await communityRpcContract(), contractBefore);
    for (const role of ['anon', 'authenticated']) {
      assert.equal(await scalar(`SELECT has_function_privilege($1,
        'public.community_leaderboard(uuid,uuid,text,integer,integer,uuid[],timestamp with time zone)'::regprocedure,'EXECUTE')`, [role]), anonymousBefore[role]);
    }
    assert.equal(await publicHasExecute(), anonymousBefore.PUBLIC);
    assert.equal(anonymousBefore.PUBLIC, false);
    assert.equal(anonymousBefore.anon, false);
    assert.equal(anonymousBefore.authenticated, false);
    assert.equal(await scalar(`SELECT provolatile='s' FROM pg_proc WHERE oid=
      'public.community_leaderboard(uuid,uuid,text,integer,integer,uuid[],timestamp with time zone)'::regprocedure`), true);
    assert.ok((await scalar(`SELECT proconfig FROM pg_proc WHERE oid=
      'public.community_leaderboard(uuid,uuid,text,integer,integer,uuid[],timestamp with time zone)'::regprocedure`))
      .some(value => value.startsWith('search_path=')));
  });

  const upgraded = {};
  for (const period of ['week', 'month', 'total']) upgraded[period] = await leaderboard(a, communityId, period);
  upgraded.page = await leaderboard(a, communityId, 'week', 1, 1);

  await test('source attribution is exact, source-only, zero-filled, and totals reconcile', async () => {
    const week = upgraded.week;
    const member = week.me;
    assert.equal(member.total_tokens, '18014398509482194');
    assert.deepEqual(sourceFields.map(key => member[key]), [
      '18014398509481986', '21', '12', '13', '14', '48', '18', '19', '20', '21', '22',
    ]);
    assert.equal(sourceFields.reduce((sum, key) => sum + BigInt(member[key]), 0n).toString(), member.total_tokens);
    assert.equal(member.other_tokens, '22');
    assert.equal(member.gpt_tokens, '18014398509481986');
    for (const report of Object.values(upgraded)) {
      for (const row of [...report.rows, ...(report.me ? [report.me] : [])]) {
        assert.equal(sourceFields.reduce((sum, key) => sum + BigInt(row[key]), 0n).toString(), row.total_tokens);
      }
    }
    assert.equal(week.rows.find(row => row.user_id === zero).total_tokens, '0');
    assert.deepEqual(sourceFields.map(key => week.rows.find(row => row.user_id === zero)[key]), Array(11).fill('0'));
    assert.deepEqual(week.rows.map(row => [row.user_id, row.rank]), [[a, 1], [b, 2], [c, 2], [zero, 3]]);
  });

  await test('week/month/total bounds, page and independent me retain legacy behavior', async () => {
    assert.deepEqual(samePublicFields(upgraded.week), samePublicFields(legacy.week));
    assert.deepEqual(samePublicFields(upgraded.month), samePublicFields(legacy.month));
    assert.deepEqual(samePublicFields(upgraded.total), samePublicFields(legacy.total));
    assert.equal(upgraded.week.from_day, '2026-09-28');
    assert.equal(upgraded.week.to_day, '2026-10-04');
    assert.equal(upgraded.week.me.total_tokens, '18014398509482194');
    assert.equal(upgraded.month.from_day, '2026-10-01');
    assert.equal(upgraded.month.to_day, '2026-10-31');
    assert.equal(upgraded.month.me.total_tokens, '18014398509482294');
    assert.equal(upgraded.total.from_day, '1970-01-01');
    assert.equal(upgraded.total.to_day, '2026-10-01');
    assert.equal(upgraded.total.me.total_tokens, '18014398509482201');
    assert.equal(upgraded.page.rows[0].user_id, b);
    assert.equal(upgraded.page.me.user_id, a);
    assert.equal(upgraded.page.me.total_tokens, legacy.page.me.total_tokens);
    assert.deepEqual(samePublicFields(upgraded.page), samePublicFields(legacy.page));
  });

  await test('exclusions, nonmembers, errors and public anonymous execution rules remain intact', async () => {
    const excludedActor = await leaderboard(a, communityId, 'week', 50, 0, [a]);
    assert.equal(excludedActor.me, null);
    assert.equal(excludedActor.ranked_count, 3);
    assert.equal((await leaderboard(outsider, communityId)).error.code, 'COMMUNITY_UNAVAILABLE');
    assert.equal((await leaderboard(a, communityId, 'day')).error.code, 'INVALID_PERIOD');
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`SET ROLE ${role}`);
      await assert.rejects(() => db.query(`SELECT public.community_leaderboard(
        '${a}'::uuid,'${communityId}'::uuid,'week',50,0,ARRAY[]::uuid[],'2026-10-01T12:00:00Z')`), /permission denied/);
      await db.exec('RESET ROLE');
    }
  });

  await test('generated rollback restores historical responses and leaves Foundation/ACL intact', async () => {
    await db.exec('BEGIN');
    await db.exec(buildRollback());
    await db.exec('COMMIT');
    for (const period of ['week', 'month', 'total']) assert.deepEqual(await leaderboard(a, communityId, period), legacy[period]);
    assert.deepEqual(await leaderboard(a, communityId, 'week', 1, 1), legacy.page);
    assert.deepEqual(await foundationCatalog(), foundationBaseline);
    assert.deepEqual(await foundationDataFingerprint(), foundationDataBefore);
    assert.deepEqual(await communityRpcContract(), contractBefore);
    for (const role of ['anon', 'authenticated']) {
      assert.equal(await scalar(`SELECT has_function_privilege($1,
        'public.community_leaderboard(uuid,uuid,text,integer,integer,uuid[],timestamp with time zone)'::regprocedure,'EXECUTE')`, [role]), anonymousBefore[role]);
    }
    assert.equal(await publicHasExecute(), anonymousBefore.PUBLIC);
  });

  console.log(`PASS ${passed} source-breakdown PostgreSQL 15 upgrade/rollback regressions; no cloud resources touched`);
} finally {
  await db.close();
}
