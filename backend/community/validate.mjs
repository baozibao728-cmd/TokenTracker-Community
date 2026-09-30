// Real isolated PG15 only. No project link, network DB URL, dotenv or credentials.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { createPg15Database } from '../bootstrap/pg15-runtime.mjs';
import { checkMigration as foundationMigration } from '../deploy/build-migration.mjs';
import { checkEdges } from '../bootstrap/lib.mjs';
import { checkMigration, dir } from './build-migration.mjs';
import { readCommunityLimits } from './config.mjs';
const db=await createPg15Database();
const uid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const [a,b,c,d,e]=[1,2,3,4,5].map(uid);
const defaults=readCommunityLimits(()=>undefined);
const small=readCommunityLimits(k=>({COMMUNITY_MAX_OWNED:'1',COMMUNITY_MAX_JOINED:'2',COMMUNITY_MAX_MEMBERS:'2'})[k]);
const roomy=readCommunityLimits(k=>({COMMUNITY_MAX_OWNED:'3',COMMUNITY_MAX_JOINED:'4',COMMUNITY_MAX_MEMBERS:'5'})[k]);
const rpcNames=['community_create','community_join','community_leave','community_create_transfer','community_accept_transfer',
  'community_reject_transfer','community_delete','community_read','community_leaderboard'];
const tables=['communities','community_members','community_transfer_requests'];
const q=async(sql,args=[]) => (await db.query(sql,args)).rows;
const scalar=async(sql,args=[]) => Object.values((await q(sql,args))[0])[0];
const call=async(name,args,connection=db) => {
  assert.ok(rpcNames.includes(name));
  return (await connection.query(`SELECT public.${name}(${args.map((_,i)=>`$${i+1}`).join(',')}) AS value`,args)).rows[0].value;
};
const create=async(user=a,name='Fixture',limits=defaults)=>{
  const r=await call('community_create',[user,name,null,limits]); assert.equal(r.ok,true,JSON.stringify(r)); return r.community;
};
const join=async(user,community,limits=defaults)=>call('community_join',[user,community.invite_code,limits]);
const fail=(result,code)=>{assert.equal(result.ok,false);assert.equal(result.error.code,code);};
let passed=0;
async function test(name,action,reset=true) {
  if(reset) await db.exec('TRUNCATE public.communities CASCADE');
  await action(); passed++; console.log(`PASS ${name}`);
}
async function foundationCatalog() {
  return q(`SELECT 'relation' AS kind,relname AS name,to_jsonb(c)-'oid'-'relfilenode'-'relpages'-'reltuples'-'relallvisible' AS definition
    FROM pg_class c WHERE relnamespace='public'::regnamespace AND relname NOT LIKE 'communit%'
    UNION ALL SELECT 'function',proname,to_jsonb(p)-'oid' FROM pg_proc p
      WHERE pronamespace='public'::regnamespace AND proname NOT LIKE 'community_%'
    ORDER BY kind,name`);
}
// The first transaction deliberately retains its locks. The second must really
// wait on another PostgreSQL connection before the first is allowed to commit.
async function competing(one,two,holdMs=0) {
  const x=await db.createConnection(), y=await db.createConnection();
  let pending;
  try {
    await x.query("SET ROLE project_admin; SET statement_timeout='8s'; BEGIN");
    const first=await one(x);
    await y.query("SET ROLE project_admin; SET statement_timeout='8s'; BEGIN");
    pending=two(y).then(value=>({value}),error=>({error}));
    let waiting=false;
    for(let i=0;i<100;i++) {
      waiting=await scalar('SELECT EXISTS(SELECT 1 FROM pg_locks WHERE pid=$1 AND NOT granted)',[y.processID]);
      if(waiting) break;
      await new Promise(resolve=>setTimeout(resolve,10));
    }
    assert.equal(waiting,true,'Second real backend must wait for the first transaction');
    if(holdMs) await new Promise(resolve=>setTimeout(resolve,holdMs));
    await x.query('COMMIT');
    const second=await pending;
    if(second.error) throw second.error;
    await y.query('COMMIT');
    return [first,second.value];
  } finally {
    await x.query('ROLLBACK');
    if(pending) await pending;
    await y.query('ROLLBACK');
    // Runtime owns cleanup of all additional clients, even on a failed test.
  }
}
try {
  await db.exec(fs.readFileSync(path.resolve(dir,'../bootstrap/test-platform.sql'),'utf8'));
  await db.exec('SET ROLE project_admin; BEGIN');
  await db.exec(foundationMigration());
  await db.exec('COMMIT');
  const baseline=await foundationCatalog();
  const migration=checkMigration();
  await db.exec('CREATE TABLE public.community_transfer_requests(id integer)');
  await db.exec('BEGIN');
  await assert.rejects(()=>db.exec(migration),/already exists/);
  await db.exec('ROLLBACK');
  assert.equal(await scalar("SELECT to_regclass('public.communities')"),null);
  assert.equal(await scalar("SELECT to_regclass('public.community_members')"),null);
  await db.exec('DROP TABLE public.community_transfer_requests');
  await db.exec('BEGIN');
  await db.exec(migration);
  await assert.rejects(()=>db.exec('SELECT 1/0'),/division by zero/);
  await db.exec('ROLLBACK');
  assert.equal(await scalar("SELECT count(*)::int FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname LIKE 'community_%'"),0);
  assert.equal(await scalar("SELECT to_regclass('public.communities')"),null);
  await db.exec('BEGIN');
  await db.exec(migration);
  await db.exec('COMMIT');
  console.log('PASS failed single migration rolls back all newly created objects'); passed++;
  assert.deepEqual(await foundationCatalog(),baseline);
  console.log('PASS foundation catalog and permissions unchanged'); passed++;
  // Nullable real-platform profile/metadata and synthetic emails: local only.
  await db.exec(`RESET ROLE;
    INSERT INTO auth.users(id,email,profile,metadata)
    SELECT ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
      'community-fixture-'||n||'@example.invalid',NULL,NULL FROM generate_series(1,2005) n;
    SET ROLE project_admin`);
  await test('three RLS tables, nine named RPCs, four private helpers, nine indexes',async()=>{
    assert.equal(await scalar("SELECT current_setting('server_version_num')"),'150018');
    const rels=await q("SELECT relname,relrowsecurity FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r' AND relname LIKE 'communit%'");
    assert.deepEqual(rels.map(r=>r.relname).sort(),tables.slice().sort()); assert.ok(rels.every(r=>r.relrowsecurity));
    const functions=await q("SELECT proname,prosecdef,proconfig FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname LIKE 'community_%'");
    assert.equal(functions.length,13);
    for(const name of rpcNames) assert.ok(functions.some(r=>r.proname===name),name);
    assert.ok(functions.every(r=>!r.prosecdef && r.proconfig.some(c=>c.startsWith('search_path='))));
    assert.equal(await scalar("SELECT count(*)::int FROM pg_indexes WHERE schemaname='public' AND tablename=ANY($1)",[tables]),9);
    assert.equal(await scalar("SELECT count(*)::int FROM pg_indexes WHERE tablename='communities' AND indexdef LIKE 'CREATE UNIQUE INDEX%owner_id%'"),0);
    for(const role of ['anon','authenticated']) {
      assert.equal(await scalar("SELECT count(*)::int FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname LIKE 'community_%' AND has_function_privilege($1,oid,'EXECUTE')",[role]),0);
      for(const table of tables) assert.equal(await scalar("SELECT has_table_privilege($1,$2,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')",[role,table]),false);
      await db.exec(`SET ROLE ${role}`);
      await assert.rejects(()=>db.query('SELECT * FROM public.communities'),/permission denied/);
      await assert.rejects(()=>call('community_read',[a,defaults]),/permission denied/);
      await db.exec('RESET ROLE; SET ROLE project_admin');
    }
    assert.equal(await scalar("SELECT has_function_privilege('project_admin','community_create(uuid,text,text,jsonb)','EXECUTE')"),true);
  });
  await test('create atomically installs owner membership and independent random invites',async()=>{
    const first=await create(a,'  Trimmed  '), second=await create(a,'Second');
    assert.equal(first.name,'Trimmed'); assert.notEqual(first.id,second.id);assert.notEqual(first.invite_code,second.invite_code);
    assert.match(first.invite_code,/^[A-F0-9]{32}$/);
    assert.equal(await scalar('SELECT count(*)::int FROM community_members WHERE user_id=$1',[a]),2);
    fail(await call('community_create',[a,' ',null,defaults]),'INVALID_INPUT');
    fail(await call('community_create',[a,'x','x'.repeat(2001),defaults]),'INVALID_INPUT');
    await assert.rejects(()=>call('community_create',[null,'x',null,defaults]),/INVALID_ACTOR/);
    await assert.rejects(()=>call('community_create',[uid(9999),'x',null,defaults]),/INVALID_ACTOR/);
  });
  await test('invalid RPC quotas fail before writes; no SQL quota defaults',async()=>{
    for(const limits of [null,{}, {...defaults,max_owned:0},{...defaults,max_members:1.5},{...defaults,max_joined:'20'},
      {...defaults,max_owned:'bad'}, {...defaults,extra:1}, {...defaults,max_owned:2147483648}]) {
      await assert.rejects(()=>call('community_create',[a,'Invalid',null,limits]),/INVALID_LIMITS/);
    }
    assert.equal(await scalar('SELECT count(*)::int FROM communities'),0);
  });
  await test('configured owned/joined/member quotas and idempotent join after lowering limits',async()=>{
    const first=await create(a,'One',small);
    fail(await call('community_create',[a,'Two',null,small]),'OWNED_LIMIT');
    assert.equal((await join(b,first,small)).ok,true);
    fail(await join(c,first,small),'MEMBER_LIMIT');
    const lowered={max_owned:1,max_joined:1,max_members:1};
    assert.equal((await join(b,first,lowered)).already_member,true);
    const other=await create(c,'Other'); await join(b,other,small);
    fail(await call('community_create',[b,'Over joined',null,small]),'JOINED_LIMIT');
    fail(await join(b,await create(d,'Third'),small),'JOINED_LIMIT');
    fail(await call('community_join',[b,'NOT-A-CODE',defaults]),'COMMUNITY_UNAVAILABLE');
  });
  await test('default ten owned and twenty joined are enforced from supplied configuration',async()=>{
    for(let i=0;i<defaults.max_owned;i++) await create(a,`Owned ${i}`);
    fail(await call('community_create',[a,'Eleventh',null,defaults]),'OWNED_LIMIT');
    for(let i=0;i<defaults.max_joined;i++) await join(b,await create(uid(10+i),`Join ${i}`));
    fail(await join(b,await create(c,'Twenty first')),'JOINED_LIMIT');
  });
  await test('real concurrent creates cannot exceed owned quota',async()=>{
    const results=await competing(x=>call('community_create',[a,'First',null,small],x),y=>call('community_create',[a,'Second',null,small],y));
    assert.equal(results[0].ok,true); fail(results[1],'OWNED_LIMIT');
    assert.equal(await scalar('SELECT count(*)::int FROM communities WHERE owner_id=$1',[a]),1);
  });
  await test('real concurrent creates cannot exceed joined quota',async()=>{
    const limits={...roomy,max_joined:1};
    const results=await competing(x=>call('community_create',[a,'First',null,limits],x),y=>call('community_create',[a,'Second',null,limits],y));
    assert.equal(results[0].ok,true);fail(results[1],'JOINED_LIMIT');
  });
  await test('real concurrent joins cannot exceed community capacity',async()=>{
    const first=await create(a);
    const results=await competing(x=>call('community_join',[b,first.invite_code,small],x),y=>call('community_join',[c,first.invite_code,small],y));
    assert.equal(results[0].ok,true);fail(results[1],'MEMBER_LIMIT');
    assert.equal(await scalar('SELECT count(*)::int FROM community_members WHERE community_id=$1',[first.id]),2);
  });
  await test('real concurrent joins to different communities enforce user joined quota',async()=>{
    const one=await create(a),two=await create(c),limits={...roomy,max_joined:1};
    const results=await competing(x=>call('community_join',[b,one.invite_code,limits],x),y=>call('community_join',[b,two.invite_code,limits],y));
    assert.equal(results[0].ok,true);fail(results[1],'JOINED_LIMIT');
  });
  await test('concurrent duplicate join is idempotent and inserts exactly one relationship',async()=>{
    const one=await create(a);
    const results=await competing(x=>call('community_join',[b,one.invite_code,small],x),y=>call('community_join',[b,one.invite_code,small],y));
    assert.equal(results[0].already_member,false);assert.equal(results[1].already_member,true);
    assert.equal(await scalar('SELECT count(*)::int FROM community_members WHERE community_id=$1 AND user_id=$2',[one.id,b]),1);
  });
  await test('owner cannot leave; deferred owner-member FK rejects accidental direct removal',async()=>{
    const one=await create(a);await join(b,one);
    fail(await call('community_leave',[a,one.id]),'OWNER_CANNOT_LEAVE');
    await assert.rejects(()=>db.query('DELETE FROM community_members WHERE community_id=$1 AND user_id=$2',[one.id,a]),/communities_owner_member_fk/);
    assert.equal((await call('community_leave',[b,one.id])).ok,true);
    fail(await call('community_leave',[b,one.id]),'COMMUNITY_UNAVAILABLE');
  });
  await test('unsupported transaction isolation is explicitly rejected',async()=>{
    await db.exec('BEGIN ISOLATION LEVEL REPEATABLE READ');
    await assert.rejects(()=>call('community_create',[a,'Wrong isolation',null,defaults]),/READ_COMMITTED/);
    await db.exec('ROLLBACK');
  });
  await test('transfer permissions, target membership, pending uniqueness and seven-day expiry',async()=>{
    const one=await create(a);await join(b,one);await join(c,one);
    fail(await call('community_create_transfer',[b,one.id,c]),'COMMUNITY_UNAVAILABLE');
    fail(await call('community_create_transfer',[a,one.id,a]),'INVALID_TARGET');
    fail(await call('community_create_transfer',[a,one.id,d]),'TARGET_NOT_MEMBER');
    const r=await call('community_create_transfer',[a,one.id,b]);assert.equal(r.ok,true);
    assert.equal(new Date(r.transfer.expires_at)-new Date(r.transfer.created_at),7*24*60*60*1000);
    fail(await call('community_create_transfer',[a,one.id,c]),'TRANSFER_PENDING');
    fail(await call('community_accept_transfer',[c,r.transfer.id,defaults]),'TRANSFER_UNAVAILABLE');
    fail(await call('community_reject_transfer',[a,r.transfer.id]),'TRANSFER_UNAVAILABLE');
  });
  await test('transfer accept changes owner, retains both memberships and counts against owned quota',async()=>{
    const one=await create(a);await join(b,one);await create(b,'Already owns');
    const r=(await call('community_create_transfer',[a,one.id,b])).transfer;
    fail(await call('community_accept_transfer',[b,r.id,small]),'OWNED_LIMIT');
    assert.equal(await scalar('SELECT status FROM community_transfer_requests WHERE id=$1',[r.id]),'pending');
    assert.equal((await call('community_accept_transfer',[b,r.id,roomy])).ok,true);
    assert.equal(await scalar('SELECT owner_id FROM communities WHERE id=$1',[one.id]),b);
    assert.equal(await scalar('SELECT count(*)::int FROM community_members WHERE community_id=$1',[one.id]),2);
    assert.equal((await call('community_accept_transfer',[b,r.id,small])).already_accepted,true);
    assert.equal((await call('community_leave',[a,one.id])).ok,true);
    fail(await call('community_delete',[a,one.id,one.name]),'COMMUNITY_UNAVAILABLE');
  });
  await test('real concurrent accepts of same request have one transition and idempotent replay',async()=>{
    const one=await create(a);await join(b,one);const r=(await call('community_create_transfer',[a,one.id,b])).transfer;
    const results=await competing(x=>call('community_accept_transfer',[b,r.id,defaults],x),y=>call('community_accept_transfer',[b,r.id,defaults],y));
    assert.equal(results[0].already_accepted,false);assert.equal(results[1].already_accepted,true);
  });
  await test('real concurrent transfers from distinct communities cannot exceed target owned quota',async()=>{
    const one=await create(a),two=await create(c);await join(b,one);await join(b,two);
    const r1=(await call('community_create_transfer',[a,one.id,b])).transfer;
    const r2=(await call('community_create_transfer',[c,two.id,b])).transfer;
    const results=await competing(x=>call('community_accept_transfer',[b,r1.id,small],x),y=>call('community_accept_transfer',[b,r2.id,small],y));
    assert.equal(results[0].ok,true);fail(results[1],'OWNED_LIMIT');
    assert.equal(await scalar('SELECT count(*)::int FROM communities WHERE owner_id=$1',[b]),1);
  });
  await test('concurrent transfer creation cannot create two pending requests',async()=>{
    const one=await create(a);await join(b,one);await join(c,one);
    const results=await competing(x=>call('community_create_transfer',[a,one.id,b],x),y=>call('community_create_transfer',[a,one.id,c],y));
    assert.equal(results[0].ok,true);fail(results[1],'TRANSFER_PENDING');
  });
  await test('concurrent rejection and acceptance cannot both change a request',async()=>{
    const one=await create(a);await join(b,one);const r=(await call('community_create_transfer',[a,one.id,b])).transfer;
    const results=await competing(x=>call('community_reject_transfer',[b,r.id],x),y=>call('community_accept_transfer',[b,r.id,defaults],y));
    assert.equal(results[0].ok,true);fail(results[1],'TRANSFER_NOT_PENDING');
    assert.equal(await scalar('SELECT owner_id FROM communities WHERE id=$1',[one.id]),a);
  });
  await test('reject and expiry commit status, and allow a replacement pending request',async()=>{
    const one=await create(a);await join(b,one);await join(c,one);
    const r=(await call('community_create_transfer',[a,one.id,b])).transfer;
    assert.equal((await call('community_reject_transfer',[b,r.id])).ok,true);
    assert.equal((await call('community_reject_transfer',[b,r.id])).already_rejected,true);
    const old=(await call('community_create_transfer',[a,one.id,c])).transfer;
    await db.query("UPDATE community_transfer_requests SET created_at=now()-interval '8 days',expires_at=now()-interval '1 day' WHERE id=$1",[old.id]);
    fail(await call('community_accept_transfer',[c,old.id,defaults]),'TRANSFER_EXPIRED');
    assert.equal(await scalar('SELECT status FROM community_transfer_requests WHERE id=$1',[old.id]),'expired');
    assert.equal((await call('community_create_transfer',[a,one.id,b])).ok,true);
  });
  await test('expiry is checked after acquiring a waiting lock, using wall clock',async()=>{
    const one=await create(a);await join(b,one);const r=(await call('community_create_transfer',[a,one.id,b])).transfer;
    const results=await competing(async x=>{
      await x.query("UPDATE community_transfer_requests SET expires_at=clock_timestamp()+interval '250 milliseconds' WHERE id=$1",[r.id]);
      return {ok:true};
    },y=>call('community_accept_transfer',[b,r.id,defaults],y),350);
    fail(results[1],'TRANSFER_EXPIRED');
    assert.equal(await scalar('SELECT status FROM community_transfer_requests WHERE id=$1',[r.id]),'expired');
  });
  await test('stale from-owner is rechecked and expires without changing current owner',async()=>{
    const one=await create(a);await join(b,one);await join(c,one);
    const r=(await call('community_create_transfer',[a,one.id,b])).transfer;
    await db.query('UPDATE communities SET owner_id=$1 WHERE id=$2',[c,one.id]);
    fail(await call('community_accept_transfer',[b,r.id,defaults]),'TRANSFER_EXPIRED');
    assert.equal(await scalar('SELECT owner_id FROM communities WHERE id=$1',[one.id]),c);
  });
  await test('member leaving invalidates their pending transfer; concurrent accept cannot revive it',async()=>{
    const one=await create(a);await join(b,one);const r=(await call('community_create_transfer',[a,one.id,b])).transfer;
    const results=await competing(x=>call('community_leave',[b,one.id],x),y=>call('community_accept_transfer',[b,r.id,defaults],y));
    assert.equal(results[0].ok,true);fail(results[1],'TRANSFER_NOT_PENDING');
    assert.equal(await scalar('SELECT status FROM community_transfer_requests WHERE id=$1',[r.id]),'expired');
  });
  await test('private reads, list quotas, transfer inbox and member pagination',async()=>{
    const one=await create(a);await join(b,one);await join(c,one);
    const request=(await call('community_create_transfer',[a,one.id,b])).transfer;
    const list=await call('community_read',[b,small]);
    assert.equal(list.joined_count,1);assert.equal(list.owned_count,0);assert.deepEqual(list.limits,small);
    assert.equal(list.communities.length,1);assert.equal(list.incoming_transfers[0].id,request.id);
    assert.equal(list.communities[0].invite_code,undefined);
    const owner=await call('community_read',[a,defaults,one.id,1,0]);
    assert.equal(owner.community.invite_code,one.invite_code);assert.equal(owner.member_count,3);assert.equal(owner.members.length,1);
    const next=await call('community_read',[a,defaults,one.id,1,1]);
    assert.notEqual(owner.members[0].user_id,next.members[0].user_id);
    assert.ok(owner.members.every(m=>m.display_name==='Member' && !JSON.stringify(m).includes('@')));
    fail(await call('community_read',[d,defaults,one.id]),'COMMUNITY_UNAVAILABLE');
    fail(await call('community_read',[a,defaults,one.id,0,0]),'INVALID_PAGINATION');
    assert.equal((await call('community_read',[d,defaults])).communities.length,0);
  });
  await test('delete requires owner/name and preserves foundation usage, snapshots and other communities',async()=>{
    const one=await create(a),other=await create(c);await join(b,one);
    await call('community_create_transfer',[a,one.id,b]);
    const before=await scalar('SELECT count(*) FROM auth.users');
    fail(await call('community_delete',[b,one.id,one.name]),'COMMUNITY_UNAVAILABLE');
    fail(await call('community_delete',[a,one.id,'wrong']),'CONFIRMATION_REQUIRED');
    assert.equal((await call('community_delete',[a,one.id,one.name])).ok,true);
    assert.equal(await scalar('SELECT count(*)::int FROM community_members WHERE community_id=$1',[one.id]),0);
    assert.equal(await scalar('SELECT count(*)::int FROM community_transfer_requests WHERE community_id=$1',[one.id]),0);
    assert.equal(await scalar('SELECT count(*) FROM auth.users'),before);
    assert.equal(await scalar('SELECT count(*)::int FROM communities WHERE id=$1',[other.id]),1);
  });
  await test('concurrent delete prevents an outstanding acceptance from resurrecting community',async()=>{
    const one=await create(a);await join(b,one);const r=(await call('community_create_transfer',[a,one.id,b])).transfer;
    const results=await competing(x=>call('community_delete',[a,one.id,one.name],x),y=>call('community_accept_transfer',[b,r.id,defaults],y));
    assert.equal(results[0].ok,true);fail(results[1],'TRANSFER_UNAVAILABLE');
  });
  // Foundation fixtures are confined to this ephemeral database.
  for(const [i,user] of [a,b,c,d].entries()) await db.query(
    "INSERT INTO tokentracker_devices(id,user_id,device_name,platform) VALUES($1,$2,$3,'local-test')",[uid(9000+i),user,`fixture-${i}`]);
  async function bucket(user,tokens,time='2026-10-01T10:00:00Z',model='gpt-4o') {
    await db.query(`INSERT INTO tokentracker_hourly(user_id,device_id,hour_start,source,model,input_tokens,total_tokens)
      VALUES($1,$2,$3,'codex',$4,$5,$5)`,[user,uid(9000+[a,b,c,d].indexOf(user)),time,model,String(tokens)]);
  }
  const leaderboard=(user,community,period='week',limit=50,offset=0,excluded=[])=>call('community_leaderboard',
    [user,community.id,period,limit,offset,excluded,'2026-10-01T12:00:00Z']);
  await test('all members including zero, dense rank, stable ties, me and pagination',async()=>{
    const one=await create(a);await join(b,one);await join(c,one);
    await bucket(a,130);await bucket(b,130);await bucket(d,999);
    const result=await leaderboard(a,one);
    assert.equal(result.basis,'client_reported_tokens');assert.equal(result.automatic_anticheat,false);
    assert.deepEqual(result.rows.map(r=>[r.user_id,r.total_tokens,r.rank]),[[a,'130',1],[b,'130',1],[c,'0',2]]);
    assert.equal(result.me.user_id,a);
    const page=await leaderboard(a,one,'week',1,1);
    assert.equal(page.rows[0].user_id,b);assert.equal(page.me.user_id,a);assert.equal(page.ranked_count,3);
    assert.deepEqual((await leaderboard(a,one,'week',1,100)).rows,[]);
    fail(await leaderboard(d,one),'COMMUNITY_UNAVAILABLE');
    fail(await leaderboard(a,one,'day'),'INVALID_PERIOD');
    fail(await leaderboard(a,one,'week',101),'INVALID_PAGINATION');
    const excluded=await leaderboard(a,one,'week',50,0,[b]);
    assert.equal(excluded.excluded_member_count,1);assert.equal(excluded.rows.length,2);
    assert.equal((await leaderboard(b,one,'week',50,0,[b])).me,null);
    assert.equal((await leaderboard(a,one,'week',50,0,[null])).ranked_count,3);
  });
  await test('UTC week/month/total boundaries and pre-join history use canonical aggregation',async()=>{
    const one=await create(a);await join(b,one);
    await bucket(a,7,'2026-09-28T00:00:00Z'); await bucket(a,20,'2026-09-30T23:30:00Z');
    await bucket(a,50,'2026-09-20T10:00:00Z'); await bucket(a,1000,'2025-01-01T10:00:00Z');
    await bucket(a,999,'2026-10-05T00:00:00Z'); await bucket(a,11,'2026-10-31T23:30:00Z');await bucket(a,9999,'2026-11-01T00:00:00Z');
    const week=await leaderboard(a,one),month=await leaderboard(a,one,'month'),total=await leaderboard(a,one,'total');
    assert.equal(week.from_day,'2026-09-28');assert.equal(week.to_day,'2026-10-04');assert.equal(week.me.total_tokens,'157');
    assert.equal(month.from_day,'2026-10-01');assert.equal(month.to_day,'2026-10-31');assert.equal(month.me.total_tokens,'1140');
    assert.equal(total.from_day,'1970-01-01');assert.equal(total.to_day,'2026-10-01');assert.equal(total.me.total_tokens,'1207');
    for(const r of [week,month,total]) {
      const grouped=await scalar('SELECT leaderboard_usage_grouped($1,$2)',[r.from,r.to_exclusive]);
      assert.equal(r.me.total_tokens,grouped.filter(x=>x.user_id===a).reduce((n,x)=>n+BigInt(x.total_tokens),0n).toString());
    }
    await db.exec("SET timezone='America/New_York'");
    assert.equal((await leaderboard(a,one)).from_day,'2026-09-28');await db.exec("SET timezone='UTC'");
    await db.exec('SELECT leaderboard_rollup_daily_advance_v2()');
    assert.equal((await leaderboard(a,one,'total')).me.total_tokens,total.me.total_tokens);
  });
  await test('bigint token result is serialized exactly beyond JavaScript safe integers',async()=>{
    const one=await create(c);await join(b,one);
    await bucket(c,'9007199254740993','2026-10-01T11:00:00Z');
    const result=await leaderboard(c,one);
    assert.equal(result.rows[0].total_tokens,'9007199254740993');assert.equal(result.rows[0].rank,1);
  });
  await test('two-thousand member capacity and paginated ranking',async()=>{
    const one=await create(a);
    await db.query(`INSERT INTO community_members(community_id,user_id)
      SELECT $1,('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid FROM generate_series(2,2000) n`,[one.id]);
    fail(await join(uid(2001),one),'MEMBER_LIMIT');
    const started=performance.now(), result=await leaderboard(a,one,'week',100,1900);
    assert.equal(result.member_count,2000);assert.equal(result.ranked_count,2000);assert.equal(result.rows.length,100);
    assert.ok(result.me);console.log(`INFO 2000-member local fixture query: ${Math.round(performance.now()-started)} ms (not a cloud SLA)`);
    const before=await q('SELECT * FROM tokentracker_hourly ORDER BY user_id,hour_start');
    const snapshots=await q('SELECT * FROM tokentracker_leaderboard_snapshots');
    assert.equal((await call('community_delete',[a,one.id,one.name])).ok,true);
    assert.deepEqual(await q('SELECT * FROM tokentracker_hourly ORDER BY user_id,hour_start'),before);
    assert.deepEqual(await q('SELECT * FROM tokentracker_leaderboard_snapshots'),snapshots);
  });
  await test('original thirteen MVP Edge DB contracts remain satisfied',async()=>{
    const results=await checkEdges(db);assert.equal(results.length,13);
    assert.deepEqual(results.filter(r=>!r.satisfied),[]);
  });
  // Catalog structure, function definitions and ACLs stay unchanged. Statistics
  // may change after fixtures, so compare only immutable catalog fields here.
  console.log(`PASS ${passed} Community PG15 checks; no cloud resources touched`);
} finally {await db.close();}
