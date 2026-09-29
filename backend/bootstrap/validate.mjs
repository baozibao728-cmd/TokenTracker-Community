import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createTestDatabase, read, sqlFiles, root } from './lib.mjs';
const db = await createTestDatabase();
let passed = 0;
async function test(name, action) {
  await action();
  passed++;
  console.log(`PASS ${name}`);
}
const query = async (sql, args = []) => (await db.query(sql, args)).rows;
const scalar = async (sql, args = []) => Object.values((await query(sql, args))[0])[0];
const user = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const empty = '33333333-3333-4333-8333-333333333333';
const device = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const second = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const foreign = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const from = '2026-09-07T00:00:00Z', to = '2026-09-09T00:00:00Z';
const total = rows => rows.reduce((sum, r) => sum + Number(r.total_tokens), 0);
const grouped = (uid = user, trunc = 'day', tz = 'UTC', offset = 0) => scalar(
  'SELECT account_usage_grouped_v2($1,NULL,$2,$3,$4,$5,$6)', [uid, from, to, trunc, tz, offset]);
const cached = () => scalar('SELECT account_usage_grouped_cached($1,NULL,$2,$3,\'day\',\'UTC\',0)', [user, from, to]);
const compact = fn => scalar(`SELECT ${fn}($1,NULL,$2,$3,'UTC',0,'2026-09-07','2026-09-08')`, [user, from, to]);
async function bucket(uid, did, source, model, tokens, time = '2026-09-07T10:00:00Z') {
  return db.query(`INSERT INTO tokentracker_hourly(user_id,device_id,hour_start,source,model,input_tokens,total_tokens,conversations)
    VALUES ($1,$2,$3,$4,$5,$6,$6,1) ON CONFLICT(user_id,device_id,hour_start,source,model)
    DO UPDATE SET input_tokens=EXCLUDED.input_tokens,total_tokens=EXCLUDED.total_tokens`, [uid,did,time,source,model,tokens]);
}
function session(tokens, stamp = '2026-09-07T12:00:00Z', model = 'trae-test', time = '2026-09-07T10:00:00Z') {
  return [{source:'trae-cn',session_id:'session-1',model,bucket_start:time,input_tokens:tokens,output_tokens:0,
    cached_input_tokens:0,cache_creation_input_tokens:0,reasoning_output_tokens:0,total_tokens:tokens,snapshot_verified_at:stamp}];
}
const upsertState = states => scalar('SELECT tokentracker_upsert_account_session_states($1,$2)', [user, JSON.stringify(states)]);
const leaderboard = (start = from, end = to) => scalar('SELECT leaderboard_usage_grouped($1,$2)', [start,end]);
try {
  console.log(`Engine: ${await scalar('SELECT version()')}`);
  await test('all ordered SQL applies as non-superuser project_admin', async () => {
    assert.equal(await scalar('SELECT current_user'), 'project_admin');
    assert.equal(await scalar("SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname=current_user"), false);
  });
  await test('baseline refuses to overwrite an existing backend', async () => {
    await assert.rejects(() => db.exec(read('000_preflight.sql')), /Existing TokenTracker objects/);
  });
  await test('upstream extracts retain exact definition hashes', async () => {
    const all = sqlFiles.map(read).join('\n');
    const manifest = JSON.parse(read('provenance.json'));
    for (const o of manifest.objects) {
      const start = all.indexOf(`-- UPSTREAM: ${o.file} :: ${o.name}`);
      assert.ok(start >= 0, o.name);
      const tail = all.slice(all.indexOf('\n', start) + 1);
      let end;
      if (o.kind === 'function') {
        const tag = tail.match(/\bAS\s+(\$\w*\$)/i);
        end = tail.indexOf(tag[1] + ';', tag.index + tag[0].length) + tag[1].length + 1;
      } else end = tail.indexOf(';') + 1;
      const sql = tail.slice(0, end);
      assert.equal(createHash('sha256').update(sql).digest('hex'), o.sha256, o.name);
      const upstream = fs.readFileSync(path.join(root, o.file), 'utf8').replace(/\r\n/g, '\n');
      assert.ok(upstream.includes(sql.replace(`public.${o.installedName}(`, `public.${o.name}(`)), `upstream drift: ${o.name}`);
    }
  });
  await test('all tables enable RLS; view stays service-only', async () => {
    const rows = await query("SELECT relname,relrowsecurity FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r' AND relname LIKE 'tokentracker_%'");
    assert.ok(rows.length >= 10);
    assert.ok(rows.every(r => r.relrowsecurity));
    assert.equal(await scalar("SELECT has_table_privilege('anon','tokentracker_user_profiles','SELECT')"), false);
  });
  await test('all RPCs revoke client execution including SECURITY DEFINER', async () => {
    for (const role of ['anon','authenticated']) {
      assert.deepEqual(await query("SELECT proname FROM pg_proc WHERE pronamespace='public'::regnamespace AND has_function_privilege($1,oid,'EXECUTE')", [role]), []);
      assert.deepEqual(await query("SELECT relname FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind IN ('r','v') AND has_table_privilege($1,oid,'SELECT,INSERT,UPDATE,DELETE')", [role]), []);
    }
  });
  await test('expected indexes and all statement transition triggers exist and are enabled', async () => {
    const indexes = new Set((await query("SELECT indexname FROM pg_indexes WHERE schemaname='public'")).map(r => r.indexname));
    for (const n of ['tokentracker_devices_active_unique','tokentracker_devices_active_machine_unique',
      'tokentracker_device_tokens_token_hash_key','tokentracker_hourly_pkey','tokentracker_hourly_user_time_idx',
      'tokentracker_hourly_time_idx','tokentracker_account_session_states_bucket_idx',
      'tokentracker_account_usage_cache_fetched_at_idx','tokentracker_leaderboard_snapshots_pkey',
      'tokentracker_leaderboard_rollup_daily_v2_pkey','tokentracker_leaderboard_rollup_total_v2_pkey']) assert.ok(indexes.has(n), n);
    const triggers = await query("SELECT tgname,tgenabled,tgnewtable,tgoldtable FROM pg_trigger WHERE NOT tgisinternal ORDER BY tgname");
    assert.equal(triggers.length,4);
    assert.ok(triggers.every(t => t.tgenabled === 'O'));
    assert.ok(triggers.some(t => t.tgnewtable === 'new_rows' && t.tgoldtable === 'old_rows'));
  });
  await test('RPC named argument contracts match Edge callers', async () => {
    const contracts = {
      refresh_tokentracker_device_identity:['p_user_id','p_device_id','p_device_name','p_platform'],
      tokentracker_upsert_account_session_states:['p_user_id','p_states'],
      account_usage_grouped:['p_user_id','p_device_ids','p_from','p_to','p_trunc','p_tz','p_offset_min'],
      account_usage_grouped_cached:['p_user_id','p_device_id','p_from','p_to','p_trunc','p_tz','p_offset_min'],
      leaderboard_usage_grouped:['p_from','p_to'],leaderboard_usage_grouped_total_shard:['p_to','p_user_from','p_user_to'],
      leaderboard_user_metadata:['p_user_ids'],leaderboard_refresh_try_claim:['p_period','p_min_interval_s'],
    };
    for (const fn of ['account_summary_compact','account_daily_compact','account_heatmap_compact','account_model_breakdown_compact']) {
      contracts[fn] = ['p_user_id','p_device_id','p_from','p_to','p_tz','p_offset_min','p_range_from','p_range_to'];
    }
    for (const [fn,args] of Object.entries(contracts)) {
      const rows = await query("SELECT proargnames FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname=$1", [fn]);
      assert.equal(rows.length,1,fn); assert.deepEqual(rows[0].proargnames,args,fn);
    }
  });
  await test('completely empty backend supports refresh advance and all leaderboard readers', async () => {
    await db.exec('SELECT leaderboard_rollup_daily_advance_v2()');
    assert.deepEqual(await leaderboard(),[]);
    assert.deepEqual(await leaderboard('1970-01-01T00:00:00Z','2100-01-01T00:00:00Z'),[]);
    assert.deepEqual(await scalar('SELECT leaderboard_usage_grouped_total_shard($1,$2,$3)',['2100-01-01T00:00:00Z',user,other]),[]);
    // Keep later fixtures independent of this empty-database initialization.
    await db.exec('DELETE FROM tokentracker_leaderboard_rollup_meta_v2');
  });
  await test('seed only the local platform fixture, then issue device identities/tokens', async () => {
    await db.exec('RESET ROLE');
    await db.query("INSERT INTO auth.users VALUES($1,'alice@example.test','{\"name\":\"Alice\",\"avatar_url\":\"https://example.test/avatar.png\"}'),($2,'bob@example.test','{}'),($3,'empty@example.test','{}')",[user,other,empty]);
    await db.exec('SET ROLE project_admin');
    await db.query("INSERT INTO tokentracker_devices(id,user_id,device_name,platform,machine_id) VALUES($1,$2,'Laptop','windows','machine-1'),($3,$2,'Desktop','windows','machine-2'),($4,$5,'Other','linux','machine-1')",[device,user,second,foreign,other]);
    await db.query("INSERT INTO tokentracker_device_tokens(user_id,device_id,token_hash) VALUES($1,$2,$3)",[user,device,'a'.repeat(64)]);
    assert.equal(await scalar('SELECT user_id FROM tokentracker_device_tokens WHERE token_hash=$1 AND revoked_at IS NULL',['a'.repeat(64)]),user);
  });
  await test('active machine and legacy-name identities enforce uniqueness', async () => {
    await assert.rejects(() => db.query("INSERT INTO tokentracker_devices(user_id,device_name,platform,machine_id) VALUES($1,'Different','linux','machine-1')",[user]), /duplicate key/);
    await assert.rejects(() => db.query("INSERT INTO tokentracker_devices(user_id,device_name,platform) VALUES($1,'Laptop','windows')",[user]), /duplicate key/);
  });
  await test('token hash and user/device ownership reject invalid writes', async () => {
    await assert.rejects(() => db.query("INSERT INTO tokentracker_device_tokens(user_id,device_id,token_hash) VALUES($1,$2,$3)",[other,device,'b'.repeat(64)]), /foreign key/);
    await assert.rejects(() => db.query("INSERT INTO tokentracker_device_tokens(user_id,device_id,token_hash) VALUES($1,$2,'raw-token')",[user,device]), /check constraint/);
    await assert.rejects(() => bucket(other,device,'codex','gpt-test',1), /foreign key/);
  });
  await test('ingest conflict key is idempotent and refreshes updated_at', async () => {
    await bucket(user,device,'codex','gpt-test',100);
    await db.query("UPDATE tokentracker_hourly SET updated_at='2026-01-01' WHERE device_id=$1",[device]);
    await bucket(user,device,'codex','gpt-test',100);
    assert.equal(Number(await scalar('SELECT count(*) FROM tokentracker_hourly')),1);
    assert.equal(await scalar("SELECT updated_at > '2026-01-01' FROM tokentracker_hourly"),true);
    await assert.rejects(() => bucket(user,device,'codex','bad-negative',-1), /check constraint/);
  });
  await test('distinct machines sum, cursor cross-device copies deduplicate, accounts remain isolated', async () => {
    await bucket(user,second,'codex','gpt-test',150);
    await bucket(user,device,'cursor','cursor-test',80);
    await bucket(user,second,'cursor','cursor-test',80);
    await bucket(other,foreign,'codex','gpt-test',500);
    assert.equal(total(await grouped()),330);
    assert.equal(total(await grouped(other)),500);
    assert.deepEqual(await grouped(empty),[]);
  });
  await test('sparse machine alias mappings actually deduplicate replayed identities', async () => {
    await db.query("INSERT INTO tokentracker_device_machine VALUES($1,'same-machine'),($2,'same-machine')",[device,second]);
    assert.equal(total(await grouped()),230);
    assert.equal(total((await leaderboard()).filter(r => r.user_id === user)),230);
    await db.exec('DELETE FROM tokentracker_device_machine');
    assert.equal(total(await grouped()),330);
  });
  await test('session-state writes are canonical across devices; stale and equal replay is ignored', async () => {
    assert.equal(await upsertState(session(40)),1);
    assert.equal(await upsertState(session(999)),0);
    assert.equal(await upsertState(session(999,'2026-09-06T12:00:00Z')),0);
    await bucket(user,device,'trae-cn','stale-hourly',9000);
    assert.equal(total(await grouped()),370);
  });
  await test('newer session correction replaces amount/model/bucket rather than appending', async () => {
    assert.equal(await upsertState(session(20,'2026-09-08T12:00:00Z','trae-corrected','2026-09-08T10:00:00Z')),1);
    const rows = (await grouped()).filter(r => r.source === 'trae-cn');
    assert.equal(rows.length,1); assert.equal(rows[0].model,'trae-corrected');
    assert.equal(rows[0].bucket,'2026-09-08'); assert.equal(rows[0].total_tokens,20);
    const invalid = session(20,'2026-09-09T12:00:00Z'); invalid[0].total_tokens = 99;
    await assert.rejects(() => upsertState(invalid), /check constraint/);
  });
  await test('pricing tiers preserve promoted upstream account semantics for all UTC hours', async () => {
    for (let hour=0;hour<24;hour++) {
      const stamp = `2026-09-07T${String(hour).padStart(2,'0')}:00:00Z`;
      const expected = (hour>=1 && hour<4)||(hour>=6 && hour<10) ? 'peak' : 'off_peak';
      for (const model of ['deepseek-v4-pro','deepseek-v4-flash','DEEPSEEK-V4-PRO']) assert.equal(await scalar('SELECT leaderboard_pricing_tier($1,$2)',[model,stamp]),expected);
      assert.equal(await scalar('SELECT leaderboard_pricing_tier(\'gpt-test\',$1)',[stamp]),'peak');
    }
    await bucket(user,device,'claude','deepseek-v4-pro',120,'2026-09-07T00:00:00Z');
    await bucket(user,device,'claude','deepseek-v4-pro',130,'2026-09-07T02:00:00Z');
    const dims = (await grouped()).filter(r => r.model === 'deepseek-v4-pro');
    assert.deepEqual(dims.map(r => [r.pricing_tier,r.total_tokens]).sort(),[['off_peak',120],['peak',130]]);
  });
  await test('hour/day/month buckets and named timezone/offset are exercised', async () => {
    for (const trunc of ['hour','day','month']) assert.equal(total(await grouped(user,trunc)),600);
    assert.ok((await grouped(user,'day','America/Los_Angeles')).some(r => r.bucket==='2026-09-06'));
    assert.deepEqual(await grouped(user,'day','Invalid/Timezone',480),await grouped(user,'day',null,480));
  });
  await test('shared cache populates, hits, and expires using real cached RPC', async () => {
    const first = await cached(); assert.equal(total(first),600);
    assert.deepEqual(await cached(),first);
    await bucket(user,device,'codex','gpt-test',101);
    assert.deepEqual(await cached(),first);
    await db.exec("UPDATE tokentracker_account_usage_cache SET fetched_at=clock_timestamp()-interval '31 seconds'");
    assert.equal(total(await cached()),601);
  });
  await test('all compact account RPCs return matching totals and pricing dimensions', async () => {
    const summary = await compact('account_summary_compact');
    assert.equal(summary.range_totals.total_tokens,601);
    assert.equal(summary.day_rollup.reduce((sum,r)=>sum+r[1],0),601);
    const daily = await compact('account_daily_compact');
    assert.equal(daily.days.reduce((sum,r)=>sum+r[1],0),601);
    const models = await compact('account_model_breakdown_compact');
    assert.equal(models.reduce((sum,r)=>sum+r[3],0),601);
    const heatmap = await compact('account_heatmap_compact');
    assert.equal(heatmap.reduce((sum,row)=>sum+row[1],0),601);
    for (const row of heatmap) assert.equal(Object.values(row[2]).reduce((a,b)=>a+b,0),row[1]);
    // Daily tuples prefix the same dimensions with a day; summary folds days.
    assert.deepEqual(daily.cost_dims.map(row => row.slice(1)),summary.cost_dims);
  });
  await test('device selection and revocation scope machine logs; account snapshots retain upstream semantics', async () => {
    const selected = await scalar("SELECT account_usage_grouped_v2($1,$2,$3,$4,'day','UTC',0)",[user,device,from,to]);
    assert.equal(total(selected),451);
    await db.query('UPDATE tokentracker_devices SET revoked_at=now() WHERE id=$1',[second]);
    assert.equal(total(await grouped()),451);
    await db.query('UPDATE tokentracker_devices SET revoked_at=NULL WHERE id=$1',[second]);
  });
  await test('public settings defaults and profile view/metadata projection', async () => {
    const initial = await scalar('SELECT leaderboard_user_metadata(ARRAY[$1]::uuid[])',[user]);
    assert.equal(initial[0].leaderboard_public,false); assert.equal(initial[0].display_name,'Alice');
    await db.query("INSERT INTO tokentracker_user_settings(user_id,display_name,leaderboard_public) VALUES($1,'Custom',true)",[user]);
    assert.equal(await scalar('SELECT display_name FROM tokentracker_user_profiles WHERE user_id=$1',[user]),'Custom');
    assert.equal((await scalar('SELECT leaderboard_user_metadata(ARRAY[$1]::uuid[])',[user]))[0].leaderboard_public,true);
  });
  await test('history catch-up advance initializes actual rollup metadata', async () => {
    // Existing fixture history is closed; final upstream advance processes up to 7 days.
    await db.exec('SELECT leaderboard_rollup_daily_advance_v2()');
    assert.equal(Number(await scalar('SELECT count(*) FROM tokentracker_leaderboard_rollup_meta_v2')),1);
    assert.ok(Number(await scalar('SELECT count(*) FROM tokentracker_leaderboard_rollup_daily_v2'))>0);
  });
  await test('daily replacement is idempotent and retains both pricing tiers', async () => {
    await db.query('SELECT leaderboard_rollup_daily_replace_v2($1,$2)',[from,to]);
    const before = await query('SELECT * FROM tokentracker_leaderboard_rollup_total_v2 ORDER BY user_id,source,model,pricing_tier');
    await db.query('SELECT leaderboard_rollup_daily_replace_v2($1,$2)',[from,to]);
    assert.deepEqual(await query('SELECT * FROM tokentracker_leaderboard_rollup_total_v2 ORDER BY user_id,source,model,pricing_tier'),before);
    assert.equal(Number(await scalar("SELECT count(*) FROM tokentracker_leaderboard_rollup_daily_v2 WHERE model='deepseek-v4-pro'")),2);
    await assert.rejects(()=>db.query('SELECT leaderboard_rollup_daily_replace_v2($1,$2)',['2026-09-07T01:00:00Z',to]),/UTC midnight/);
  });
  await test('transition UPDATE/DELETE keeps total rollup exactly equal to daily sums', async () => {
    const parity = async () => assert.deepEqual(await query(`SELECT user_id,source,model,pricing_tier,sum(total_tokens)::text AS t FROM tokentracker_leaderboard_rollup_daily_v2 GROUP BY 1,2,3,4 ORDER BY 1,2,3,4`),
      await query('SELECT user_id,source,model,pricing_tier,total_tokens::text AS t FROM tokentracker_leaderboard_rollup_total_v2 ORDER BY 1,2,3,4'));
    await parity();
    await db.exec("UPDATE tokentracker_leaderboard_rollup_daily_v2 SET total_tokens=total_tokens+1,input_tokens=input_tokens+1 WHERE source='codex'");
    await parity();
    await db.exec("DELETE FROM tokentracker_leaderboard_rollup_daily_v2 WHERE source='cursor'");
    await parity();
    await db.query('SELECT leaderboard_rollup_daily_replace_v2($1,$2)',[from,to]);
    await parity();
  });
  await test('week/month/total readers and sharded total agree with account totals', async () => {
    for (const [start,end] of [[from,'2026-09-14T00:00:00Z'],['2026-09-01T00:00:00Z','2026-10-01T00:00:00Z'],['1970-01-01T00:00:00Z','2026-10-01T00:00:00Z']]) {
      assert.equal(total((await leaderboard(start,end)).filter(r=>r.user_id===user)),601);
    }
    const sharded = await scalar('SELECT leaderboard_usage_grouped_total_shard($1,$2,$3)',['2026-10-01T00:00:00Z',user,other]);
    assert.equal(total(sharded),601); assert.ok(sharded.every(r=>r.user_id===user));
  });
  await test('late correction repairs daily and all-time values without double counting', async () => {
    await bucket(user,device,'codex','gpt-test',81);
    await db.query('SELECT leaderboard_rollup_daily_replace_v2($1,$2)',[from,to]);
    assert.equal(total((await leaderboard('1970-01-01T00:00:00Z','2026-10-01T00:00:00Z')).filter(r=>r.user_id===user)),581);
  });
  await test('snapshot contract accepts every period, conflict updates and rank ordering', async () => {
    for (const period of ['week','month','total']) {
      await db.query(`INSERT INTO tokentracker_leaderboard_snapshots(user_id,period,from_day,to_day,rank,total_tokens,is_public)
        VALUES($1,$2,'2026-09-01','2026-09-30',1,581,true),($3,$2,'2026-09-01','2026-09-30',2,500,false)
        ON CONFLICT(user_id,period,from_day,to_day) DO UPDATE SET total_tokens=EXCLUDED.total_tokens`,[user,period,other]);
      assert.deepEqual((await query('SELECT total_tokens::int AS t FROM tokentracker_leaderboard_snapshots WHERE period=$1 ORDER BY rank',[period])).map(r=>r.t),[581,500]);
    }
  });
  await test('refresh claim throttles repeat, permits force and expires', async () => {
    assert.equal(await scalar("SELECT leaderboard_refresh_try_claim('week',30)"),true);
    assert.equal(await scalar("SELECT leaderboard_refresh_try_claim('week',30)"),false);
    assert.equal(await scalar("SELECT leaderboard_refresh_try_claim('week',0)"),true);
    await db.exec("UPDATE tokentracker_leaderboard_refresh_state SET last_attempt_at=now()-interval '31 seconds'");
    assert.equal(await scalar("SELECT leaderboard_refresh_try_claim('week',30)"),true);
    await assert.rejects(()=>db.exec("SELECT leaderboard_refresh_try_claim('invalid',30)"),/Invalid refresh/);
  });
  await test('identity merge moves tokens, selects max bucket and revokes legacy identity', async () => {
    const legacy = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    await db.query("INSERT INTO tokentracker_devices(id,user_id,device_name,platform) VALUES($1,$2,'Legacy','windows')",[legacy,user]);
    await db.query("INSERT INTO tokentracker_device_tokens(user_id,device_id,token_hash) VALUES($1,$2,$3)",[user,legacy,'c'.repeat(64)]);
    await bucket(user,legacy,'codex','gpt-test',90);
    assert.equal(await scalar("SELECT refresh_tokentracker_device_identity($1,$2,'Legacy','windows')",[user,device]),true);
    assert.equal(await scalar('SELECT revoked_at IS NOT NULL FROM tokentracker_devices WHERE id=$1',[legacy]),true);
    assert.equal(await scalar('SELECT device_id FROM tokentracker_device_tokens WHERE token_hash=$1',['c'.repeat(64)]),device);
    assert.equal(Number(await scalar("SELECT total_tokens FROM tokentracker_hourly WHERE device_id=$1 AND model='gpt-test'",[device])),90);
    assert.equal(Number(await scalar('SELECT count(*) FROM tokentracker_hourly WHERE device_id=$1',[legacy])),0);
  });
  await test('daily rollup remains UTC across a non-UTC session DST transition', async () => {
    await db.exec("BEGIN; SET LOCAL TIME ZONE 'America/New_York'");
    try {
      await bucket(user,device,'codex','dst-test',100,'2026-03-08T10:00:00Z');
      await bucket(user,device,'codex','dst-test',50,'2026-03-08T23:30:00Z');
      await db.exec("SELECT leaderboard_rollup_daily_replace_v2('2026-03-08T00:00:00Z','2026-03-09T00:00:00Z')");
      assert.equal(Number(await scalar("SELECT sum(total_tokens) FROM tokentracker_leaderboard_rollup_daily_v2 WHERE model='dst-test'")),150);
    } finally { await db.exec('ROLLBACK'); }
  });
  await test('actual anon/authenticated queries cannot read tokens, private profiles, usage or RPCs', async () => {
    for (const role of ['anon','authenticated']) {
      await db.exec(`SET ROLE ${role}`);
      for (const table of ['tokentracker_device_tokens','tokentracker_hourly','tokentracker_user_profiles','tokentracker_leaderboard_snapshots']) {
        await assert.rejects(()=>db.exec(`SELECT * FROM ${table}`),/permission denied/);
      }
      await assert.rejects(()=>db.query('SELECT tokentracker_upsert_account_session_states($1,\'[]\')',[user]),/permission denied/);
      await assert.rejects(()=>grouped(),/permission denied/);
      await db.exec('RESET ROLE; SET ROLE project_admin');
    }
  });
  console.log(`Local SQL checks passed: ${passed}`);
} finally { await db.close(); }
