import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { webcrypto,randomUUID } from 'node:crypto';
import { createTestDatabase,edgeEntries,checkEdges,root } from '../bootstrap/lib.mjs';
import { inspectEdge } from '../bootstrap/edge-contracts.mjs';
import { localTransport } from './test-transport.mjs';
const require = createRequire(new URL('../bootstrap/package.json',import.meta.url));
const ts = require('typescript');
const {createClient} = await import(pathToFileURL(path.join(path.dirname(require.resolve('@insforge/sdk')),'index.mjs')).href);
const db = await createTestDatabase();
const env = new Map([
  ['INSFORGE_BASE_URL','https://bootstrap.test'],['INSFORGE_SERVICE_ROLE_KEY',randomUUID()],
  ['JWT_SECRET',randomUUID()],['LEADERBOARD_BLOCKED_USER_IDS','22222222-2222-4222-8222-222222222222'],
]);
const transport = await localTransport(db,env.get('INSFORGE_SERVICE_ROLE_KEY'));
const functions = new Map();
const now = new Date();
// Freeze JS time only; PG uses its real local clock for cache/rollup semantics.
class TestDate extends Date { constructor(...args) { super(...(args.length ? args : [now.getTime()])); } static now(){return now.getTime();} }
const user='11111111-1111-4111-8111-111111111111', blocked='22222222-2222-4222-8222-222222222222';
let passed = 0;
async function test(name,fn) { await fn();passed++;console.log(`PASS ${name}`); }
async function jwt(sub,role='authenticated',expires=3600) {
  const header=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
  const payload=Buffer.from(JSON.stringify({sub,role,exp:Math.floor(now.getTime()/1000)+expires})).toString('base64url');
  const key=await webcrypto.subtle.importKey('raw',new TextEncoder().encode(env.get('JWT_SECRET')),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const signature=await webcrypto.subtle.sign('HMAC',key,new TextEncoder().encode(`${header}.${payload}`));
  return `${header}.${payload}.${Buffer.from(signature).toString('base64url')}`;
}
async function call(name,{query='',body,token,method}={}) {
  const headers = {'Content-Type':'application/json'};
  if (token) headers.Authorization=`Bearer ${token}`;
  const request = new Request(`https://edge.test/${name}${query ? '?'+query : ''}`,{
    method:method || (body===undefined ? 'GET' : 'POST'), headers,
    ...(body===undefined ? {} : {body:JSON.stringify(body)}),
  });
  const response = await functions.get(`tokentracker-${name}`)(request);
  return {status:response.status,data:response.status===204 ? null : await response.json()};
}
try {
  const entries=edgeEntries();
  await test('all 13 manifest entries load with actual InsForge SDK; no network access',async()=>{
    for (const entry of entries) {
      const source=fs.readFileSync(path.join(root,entry.entry),'utf8');
      const output=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},reportDiagnostics:true});
      assert.equal(output.diagnostics.filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
      const module={exports:{}};
      const context=vm.createContext({module,exports:module.exports,
        require:specifier=>{assert.equal(specifier,'npm:@insforge/sdk');return {createClient:options=>createClient({...options,fetch:transport.fetch})};},
        Deno:{env:{get:name=>env.get(name)}},crypto:webcrypto,Request,Response,Headers,URL,TextEncoder,TextDecoder,
        Uint8Array,ArrayBuffer,atob,btoa,Date:TestDate,console:{log(){},error(){}},
        fetch:()=>{throw new Error('External fetch forbidden');},setTimeout,clearTimeout,
      });
      vm.runInContext(output.outputText,context,{filename:entry.entry});
      assert.equal(typeof module.exports.default,'function');
      functions.set(entry.name,module.exports.default);
    }
  });
  await test('MVP has zero missing dependencies; original upstream still reports its four gaps',async()=>{
    assert.equal((await checkEdges(db)).filter(r=>!r.satisfied).length,0);
    assert.deepEqual((await checkEdges(db,'upstream')).filter(r=>!r.satisfied).map(r=>r.edge).sort(),[
      'tokentracker-leaderboard','tokentracker-leaderboard-profile','tokentracker-leaderboard-refresh','tokentracker-public-visibility',
    ]);
  });
  await test('type-only adapters emit identical JavaScript; adapted pricing functions equal upstream',async()=>{
    const compile = source => ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,removeComments:true}}).outputText;
    for (const entry of entries.filter(row=>row.adapted)) {
      const original=fs.readFileSync(path.join(root,entry.upstream),'utf8');
      const current=fs.readFileSync(path.join(root,entry.entry),'utf8');
      if (entry.adapterKind==='type-compatibility') assert.equal(compile(current),compile(original),entry.name);
      // Compare actual AST declarations, including row-cost logic and source rules.
      const pricing = source => {
        const file=ts.createSourceFile('edge.ts',source,ts.ScriptTarget.Latest,true);
        return file.statements.filter(node=>
          ts.isFunctionDeclaration(node) && ['getModelPricing','getRowPricing','computeRowCost'].includes(node.name?.text)
          || ts.isVariableStatement(node) && node.declarationList.declarations.some(d=>['MODEL_PRICING','ZERO_PRICING','SOURCES_WITH_AUTHORITATIVE_COST'].includes(d.name.getText(file)))
        ).map(node=>node.getText(file).replace(/\r\n/g,'\n'));
      };
      assert.deepEqual(pricing(current),pricing(original),entry.name);
    }
  });
  await test('removed capability objects are absent from both SQL and every MVP dependency graph',async()=>{
    const forbidden=['tokentracker_public_views','tokentracker_leaderboard_anomaly_flags','tokentracker_anticheat_run_state',
      'leaderboard_quarantine_audit','reconcile_anticheat_snapshot_exclusions','detect_leaderboard_anomalies','user_badges_full','user_badges_compact'];
    for (const entry of entries) {
      const actual=inspectEdge(fs.readFileSync(path.join(root,entry.entry),'utf8'),entry.name);
      for (const name of [...actual.tables.keys(),...actual.rpcs.map(r=>r.name)]) assert.ok(!forbidden.includes(name));
    }
    for (const name of forbidden) {
      const result=await db.query('SELECT to_regclass($1) IS NULL AS table_absent, NOT EXISTS(SELECT 1 FROM pg_proc WHERE proname=$2) AS rpc_absent',[`public.${name}`,name]);
      assert.ok(result.rows[0].table_absent && result.rows[0].rpc_absent);
    }
  });
  await test('fresh empty baseline refreshes all periods and serves an empty real leaderboard',async()=>{
    const result=await call('leaderboard-refresh',{token:env.get('INSFORGE_SERVICE_ROLE_KEY'),body:{force_refresh:true}});
    assert.equal(result.status,200,JSON.stringify(result.data));
    for (const period of ['week','month','total']) {
      assert.equal(result.data.results[period].upserted,0);
      const list=await call('leaderboard',{query:`period=${period}`});
      assert.equal(list.status,200,JSON.stringify(list.data));assert.equal(list.data.entries.length,0);
      assert.equal(list.data.total_entries,0);
    }
    // Reset just the real rate-limit state so the later claim test starts fresh.
    await db.exec('DELETE FROM tokentracker_leaderboard_refresh_state');
  });
  await db.exec('RESET ROLE');
  await db.query("INSERT INTO auth.users VALUES($1,'alice@example.test','{\"name\":\"Alice\"}'),($2,'blocked@example.test','{}')",[user,blocked]);
  await db.exec('SET ROLE project_admin');
  const token=await jwt(user), otherToken=await jwt(blocked), admin=env.get('INSFORGE_SERVICE_ROLE_KEY');
  let deviceToken,deviceId;
  await test('RS256 signed user reaches verification; forged RSA token fails',async()=>{
    const keys=await webcrypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
    const publicDer=await webcrypto.subtle.exportKey('spki',keys.publicKey);
    env.set('JWT_PUBLIC_KEY',`-----BEGIN PUBLIC KEY-----\n${Buffer.from(publicDer).toString('base64')}\n-----END PUBLIC KEY-----`);
    const header=Buffer.from(JSON.stringify({alg:'RS256',typ:'JWT'})).toString('base64url');
    const payload=Buffer.from(JSON.stringify({sub:blocked,role:'authenticated',exp:Math.floor(now.getTime()/1000)+3600})).toString('base64url');
    const signature=await webcrypto.subtle.sign('RSASSA-PKCS1-v1_5',keys.privateKey,new TextEncoder().encode(`${header}.${payload}`));
    // The real signed token reaches the retained manual blocklist; forged does not.
    assert.equal((await call('device-token-issue',{body:{},token:`${header}.${payload}.${Buffer.from(signature).toString('base64url')}`})).status,403);
    assert.equal((await call('device-token-issue',{body:{},token:`${header}.${payload}.AAAA`})).status,401);
  });
  await test('device issuance rejects unsigned/expired JWTs and manual blocklisted users',async()=>{
    for (const bad of ['invalid',await jwt(user,'authenticated',-1)]) assert.equal((await call('device-token-issue',{body:{},token:bad})).status,401);
    assert.equal((await call('device-token-issue',{body:{},token:otherToken})).status,403);
  });
  await test('signed user obtains actual opaque device token; repeated machine uses same identity',async()=>{
    const body={device_name:'Test laptop',platform:'windows',machine_id:'test-machine-123456'};
    const first=await call('device-token-issue',{body,token});
    assert.equal(first.status,200,JSON.stringify(first.data));
    deviceToken=first.data.token;deviceId=first.data.device_id;
    assert.equal(deviceToken.length,64);
    const next=await call('device-token-issue',{body,token});
    assert.equal(next.status,200,JSON.stringify(next.data));assert.equal(next.data.device_id,deviceId);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM tokentracker_devices')).rows[0].n,1);
  });
  const day=now.toISOString().slice(0,10),hour=`${day}T00:00:00Z`;
  const upload={buckets:[{hour_start:hour,source:'codex',model:'gpt-5',input_tokens:100,output_tokens:20,cached_input_tokens:10,
    cache_creation_input_tokens:0,reasoning_output_tokens:5,total_tokens:130,conversation_count:1}]};
  await test('opaque token ingest writes PostgreSQL and repeat upload is idempotent',async()=>{
    assert.equal((await call('ingest',{body:upload,token:'invalid'})).status,401);
    for(let i=0;i<2;i++) {
      const result=await call('ingest',{body:upload,token:deviceToken});
      assert.equal(result.status,200,JSON.stringify(result.data));
    }
    assert.equal((await db.query('SELECT count(*)::int AS n FROM tokentracker_hourly')).rows[0].n,1);
  });
  await test('all seven actual Account Usage handlers respond from baseline RPCs',async()=>{
    for(const name of ['summary','daily','hourly','monthly','heatmap','model-breakdown','devices']) {
      const result=await call(`account-${name}`,{token,query:`from=${day}&to=${day}&day=${day}&tz=UTC`});
      assert.equal(result.status,200,`${name}: ${JSON.stringify(result.data)}`);
      if(name==='summary') assert.equal(result.data.totals.total_tokens,130);
    }
  });
  await test('visibility GET/POST preserves settings and advertises share unsupported',async()=>{
    assert.equal((await call('public-visibility')).status,401);
    const saved=await call('public-visibility',{token,body:{enabled:true,display_name:'MVP Alice',anonymous:false}});
    assert.equal(saved.status,200,JSON.stringify(saved.data));
    const result=await call('public-visibility',{token});
    assert.equal(result.status,200,JSON.stringify(result.data));
    assert.equal(result.data.enabled,true);assert.equal(result.data.display_name,'MVP Alice');
    assert.equal(result.data.share_token,null);assert.equal(result.data.capabilities.share,false);
  });
  await test('refresh auth restricts anonymous writes, signed-in month and signed-in force',async()=>{
    assert.equal((await call('leaderboard-refresh',{body:{period:'week'}})).status,401);
    assert.equal((await call('leaderboard-refresh',{token:await jwt(user,'anon'),body:{period:'week'}})).status,401);
    assert.equal((await call('leaderboard-refresh',{token,body:{period:'month'}})).status,403);
    assert.equal((await call('leaderboard-refresh',{token,body:{period:'week',force_refresh:true}})).status,403);
  });
  await test('signed-in week refresh succeeds and its second call respects the actual claim window',async()=>{
    const first=await call('leaderboard-refresh',{token,body:{period:'week'}});
    assert.equal(first.status,200,JSON.stringify(first.data));assert.equal(first.data.results.week.upserted,1);
    const second=await call('leaderboard-refresh',{token,body:{period:'week'}});
    assert.equal(second.status,200,JSON.stringify(second.data));assert.equal(second.data.results.week.skipped,true);
  });
  await test('unsupported badge/anti-cheat/quarantine routes return 501 without any DB request',async()=>{
    for(const query of ['anomalies=1','quarantine_audit=1']) {
      const before=transport.trace.length,result=await call('leaderboard-refresh',{query});
      assert.equal(result.status,501);assert.equal(result.data.error,'unsupported_capability');assert.equal(transport.trace.length,before);
    }
    for(const body of [{scan_anomalies:true},{scan_anomalies:false},{anti_cheat_reconcile_at:now.toISOString()}]) {
      const before=transport.trace.length,result=await call('leaderboard-refresh',{token:admin,body});
      assert.equal(result.status,501);assert.equal(transport.trace.length,before);
    }
    const before=transport.trace.length,result=await call('leaderboard-profile',{token,query:`user_id=${user}&view=badges`});
    assert.equal(result.status,501);assert.equal(transport.trace.length,before);
  });
  await test('refresh builds week/month/total, manual exclusions remain, no automatic audit is claimed',async()=>{
    const foreign='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    await db.query("INSERT INTO tokentracker_devices(id,user_id,device_name,platform) VALUES($1,$2,'Blocked','linux')",[foreign,blocked]);
    await db.query("INSERT INTO tokentracker_hourly(user_id,device_id,hour_start,source,model,input_tokens,total_tokens) VALUES($1,$2,$3,'codex','gpt-5',99999,99999)",[blocked,foreign,hour]);
    const result=await call('leaderboard-refresh',{token:admin,body:{force_refresh:true}});
    assert.equal(result.status,200,JSON.stringify(result.data));
    for(const period of ['week','month','total']) assert.equal(result.data.results[period].upserted,1);
    assert.equal(result.data.capabilities.automatic_anticheat,false);
    assert.equal(result.data.ranking_policy.automatic_exclusion,false);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM tokentracker_leaderboard_snapshots WHERE user_id=$1',[blocked])).rows[0].n,0);
  });
  await test('public list and profile preserve real totals, anonymous privacy and no badges',async()=>{
    for(const period of ['week','month','total']) {
      const list=await call('leaderboard',{query:`period=${period}&user_id=${user}`});
      assert.equal(list.status,200,JSON.stringify(list.data));
      assert.equal(list.data.entries.length,1);assert.equal(list.data.entries[0].total_tokens,130);
      assert.equal(list.data.entries[0].rank,1);assert.equal(list.data.total_entries,1);
      assert.equal(list.data.capabilities.badges,false);assert.ok(!Object.hasOwn(list.data.entries[0],'badges'));
      const profile=await call('leaderboard-profile',{query:`period=${period}&user_id=${user}&tz=UTC`});
      assert.equal(profile.status,200,JSON.stringify(profile.data));assert.equal(profile.data.totals.total_tokens,130);
      assert.equal(profile.data.capabilities.badges,false);assert.ok(!Object.hasOwn(profile.data,'badges'));
    }
    await call('public-visibility',{token,body:{anonymous:true}});
    const profile=await call('leaderboard-profile',{query:`user_id=${user}&tz=UTC`});
    assert.equal(profile.data.user.display_name,'Anonymous');assert.equal(profile.data.user.avatar_url,null);
  });
  await test('core RPC/settings errors surface as 500 instead of optional-feature success',async()=>{
    for(const [object,name,options] of [
      ['tokentracker_user_settings','public-visibility',{token}],
      ['tokentracker_user_profiles','leaderboard-profile',{query:`user_id=${user}`}],
      ['leaderboard_usage_grouped','leaderboard-refresh',{token:admin,body:{period:'week',force_refresh:true}}],
    ]) {
      transport.failures.set(object,'Injected core failure');
      try { assert.equal((await call(name,options)).status,500,object); }
      finally { transport.failures.delete(object); }
    }
  });
  await test('actual trace has no removed objects and all calls stayed on local test host',async()=>{
    assert.ok(transport.trace.length>30);
    for(const call of transport.trace) assert.ok(!/badge|anomal|anticheat|quarantine|public_views/.test(call.name),call.name);
  });
  console.log(`MVP Edge request checks passed: ${passed}; executed ${transport.trace.length} actual local database requests`);
} finally { await db.close(); }
