// Execute the generated publish entries using actual SDK + real isolated PG15.
// Tokens/keys stay in memory. No cloud URLs, linked project or credential files.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { webcrypto,randomUUID } from 'node:crypto';
import { createPg15Database } from '../bootstrap/pg15-runtime.mjs';
import { checkMigration as foundationMigration } from '../deploy/build-migration.mjs';
import { checkEdges as checkFoundation } from '../bootstrap/lib.mjs';
import { localTransport } from '../edge/test-transport.mjs';
import { checkMigration,dir } from './build-migration.mjs';
import { checkCommunityContracts } from './check-edge-contracts.mjs';
import { root } from './build-edges.mjs';
import { specs,sdkImport } from './edge-spec.mjs';
const require=createRequire(new URL('../bootstrap/package.json',import.meta.url)), ts=require('typescript');
const sdk=await import(pathToFileURL(path.join(path.dirname(require.resolve('@insforge/sdk')),'index.mjs')).href);
const db=await createPg15Database();
const user='11111111-1111-4111-8111-111111111111',member='22222222-2222-4222-8222-222222222222',stranger='33333333-3333-4333-8333-333333333333';
const missing='44444444-4444-4444-8444-444444444444';
const service=randomUUID(),legacy=randomUUID();
const env=new Map([['INSFORGE_BASE_URL','https://bootstrap.test'],['API_KEY',service]]);
const functions=new Map(),requests=[];
const pair=await webcrypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const publicDer=await webcrypto.subtle.exportKey('spki',pair.publicKey);
env.set('JWT_PUBLIC_KEY',`-----BEGIN PUBLIC KEY-----\n${Buffer.from(publicDer).toString('base64')}\n-----END PUBLIC KEY-----`);
const publicPem=env.get('JWT_PUBLIC_KEY');
const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
async function jwt(sub=user,claims={},header={alg:'RS256',typ:'JWT'},key=pair.privateKey) {
  const body=encode({sub,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600,...claims}),head=encode(header);
  const signature=await webcrypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(`${head}.${body}`));
  return `${head}.${body}.${Buffer.from(signature).toString('base64url')}`;
}
let passed=0,transport,legacyTransport;
async function test(name,action) {await action();passed++;console.log(`PASS ${name}`);}
async function call(op,{token,body,query='',method,raw,headers={}}={}) {
  const actualHeaders=new Headers(headers);
  if(token) actualHeaders.set('Authorization',`Bearer ${token}`);
  if(body!==undefined || raw!==undefined) actualHeaders.set('Content-Type','application/json');
  const req=new Request(`https://community-edge.test/${op}${query?'?'+query:''}`,{
    method:method || (body!==undefined || raw!==undefined ? 'POST':'GET'),headers:actualHeaders,
    ...(body!==undefined || raw!==undefined ? {body:raw??JSON.stringify(body)} : {}),
  });
  const response=await functions.get(`tokentracker-${op}`)(req);
  return {status:response.status,data:response.status===204?null:await response.json(),headers:response.headers};
}
const expect=(result,status,code)=>{
  assert.equal(result.status,status);
  if(code) assert.equal(result.data.error.code,code);
};
const payloads={
  'create-community':{name:'Fixture'},'join-community':{invite_code:'A'.repeat(32)},'leave-community':{community_id:missing},
  'create-community-transfer':{community_id:missing,to_user_id:member},'accept-community-transfer':{request_id:missing},
  'reject-community-transfer':{request_id:missing},'delete-community':{community_id:missing,confirmation_name:'Fixture'},
};
const validRequest=op=>specs.find(s=>s.operation===op).method==='GET'?{}:{body:payloads[op]};
const scalar=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
try {
  await db.exec(fs.readFileSync(path.resolve(dir,'../bootstrap/test-platform.sql'),'utf8'));
  await db.exec('SET ROLE project_admin; BEGIN');await db.exec(foundationMigration());await db.exec(checkMigration());await db.exec('COMMIT');
  await db.exec(`RESET ROLE; INSERT INTO auth.users(id,email,profile,metadata) VALUES
    ('${user}','community-runtime-1@example.invalid',NULL,NULL),
    ('${member}','community-runtime-2@example.invalid','{"name":"Runtime Member"}',NULL),
    ('${stranger}','community-runtime-3@example.invalid',NULL,NULL); SET ROLE project_admin`);
  transport=await localTransport(db,service);
  legacyTransport=await localTransport(db,legacy);
  await test('nine publish entries load with actual pinned admin SDK and close DB contracts',async()=>{
    const entries=await checkCommunityContracts(db);
    assert.equal(entries.length,9);
    for(const entry of entries) {
      const module={exports:{}};
      const compiled=ts.transpileModule(fs.readFileSync(path.join(root,entry.entry),'utf8'),{
        compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},reportDiagnostics:true});
      assert.equal(compiled.diagnostics.filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
      const context=vm.createContext({module,exports:module.exports,require:specifier=>{
        assert.equal(specifier,sdkImport);
        return {createAdminClient:options=>{
          const expected=env.get('INSFORGE_SERVICE_ROLE_KEY')?.trim() || env.get('API_KEY')?.trim();
          assert.ok(options.apiKey===expected,'Admin client must use resolved server credential');
          assert.ok(!['anonKey','accessToken','edgeFunctionToken','headers'].some(k=>Object.hasOwn(options,k)));
          return sdk.createAdminClient({...options,fetch:async(input,init)=>{
            const url=new URL(String(input));
            assert.equal(url.origin,'https://bootstrap.test');
            const secretHeader=new Headers(init.headers).get('Authorization');
            assert.ok(secretHeader===`Bearer ${expected}`,'Only server credential enters database transport');
            requests.push({rpc:url.pathname.split('/').at(-1),args:JSON.parse(init.body)});
            return (expected===legacy ? legacyTransport : transport).fetch(input,init);
          }});
        }};
      },Deno:{env:{get:key=>env.get(key)}},crypto:webcrypto,Request,Response,Headers,URL,TextEncoder,TextDecoder,
      Uint8Array,ArrayBuffer,atob,btoa,Date,console:{log(){throw new Error('Runtime must not log credentials');},error(){throw new Error('Runtime must not log exceptions');}},
      fetch(){throw new Error('External fetch forbidden');},setTimeout,clearTimeout});
      vm.runInContext(compiled.outputText,context,{filename:entry.entry});
      assert.equal(typeof module.exports.default,'function');functions.set(entry.name,module.exports.default);
    }
    assert.equal((await checkFoundation(db)).filter(r=>!r.satisfied).length,0);
  });
  const ownerJwt=await jwt(),memberJwt=await jwt(member),strangerJwt=await jwt(stranger);
  await test('all nine reject missing, expired, wrong-signature and service credentials before DB',async()=>{
    const wrong=await webcrypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
    const forged=await jwt(user,{},undefined,wrong.privateKey),expired=await jwt(user,{exp:Math.floor(Date.now()/1000)-1});
    const before=requests.length;
    for(const spec of specs) for(const token of [undefined,'invalid',service,legacy,expired,forged]) {
      expect(await call(spec.operation,{...validRequest(spec.operation),token}),401,'UNAUTHORIZED');
    }
    assert.equal(requests.length,before);
  });
  await test('JWT rejects missing exp/sub, future nbf/iat, non-user role and algorithm confusion',async()=>{
    const before=requests.length;
    const variants=[{exp:null},{exp:undefined},{exp:'9999999999'},{exp:1.5},{sub:undefined,user_id:user},{sub:'not-uuid'},
      {nbf:Math.floor(Date.now()/1000)+3600},{iat:Math.floor(Date.now()/1000)+3600},{nbf:'future'},{role:'anon'},{role:'project_admin'}];
    for(const claims of variants) expect(await call('community-detail',{token:await jwt(user,claims)}),401,'UNAUTHORIZED');
    for(const alg of ['none','HS256','RS512']) expect(await call('community-detail',{token:await jwt(user,{}, {alg})}),401,'UNAUTHORIZED');
    const parts=ownerJwt.split('.');parts[1]=encode({sub:member,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600});
    expect(await call('community-detail',{token:parts.join('.')}),401,'UNAUTHORIZED');
    assert.equal(requests.length,before);
  });
  await test('OPTIONS is side-effect-free; wrong authenticated methods return 405',async()=>{
    const before=requests.length;
    for(const spec of specs) {
      expect(await call(spec.operation,{method:'OPTIONS'}),204);
      expect(await call(spec.operation,{token:ownerJwt,method:spec.method==='GET'?'POST':'GET',...(spec.method==='GET'?{body:{}}:{})}),405,'METHOD_NOT_ALLOWED');
    }
    assert.equal(requests.length,before);
  });
  await test('all nine refuse missing service credentials, anon fallback and CLI user keys',async()=>{
    const before=requests.length;
    env.delete('API_KEY');env.set('ANON_KEY',randomUUID());
    for(const spec of specs) expect(await call(spec.operation,{...validRequest(spec.operation),token:ownerJwt}),500,'SERVER_MISCONFIGURED');
    env.set('API_KEY','uak_'+randomUUID());expect(await call('community-detail',{token:ownerJwt}),500,'SERVER_MISCONFIGURED');
    env.set('API_KEY',service);env.delete('ANON_KEY');assert.equal(requests.length,before);
  });
  await test('all nine validate quota environment centrally, including read/leave/delete',async()=>{
    const before=requests.length;env.set('COMMUNITY_MAX_OWNED','0');
    for(const spec of specs) expect(await call(spec.operation,{...validRequest(spec.operation),token:ownerJwt}),500,'SERVER_MISCONFIGURED');
    env.delete('COMMUNITY_MAX_OWNED');assert.equal(requests.length,before);
  });
  await test('missing/malformed public key or missing backend URL fails without DB',async()=>{
    const before=requests.length;
    env.delete('JWT_PUBLIC_KEY');expect(await call('community-detail',{token:ownerJwt}),500,'SERVER_MISCONFIGURED');
    env.set('JWT_PUBLIC_KEY','invalid');expect(await call('community-detail',{token:ownerJwt}),500,'SERVER_MISCONFIGURED');
    env.set('JWT_PUBLIC_KEY',publicPem);env.delete('INSFORGE_BASE_URL');expect(await call('community-detail',{token:ownerJwt}),500,'SERVER_MISCONFIGURED');
    env.set('INSFORGE_BASE_URL','https://bootstrap.test');assert.equal(requests.length,before);
  });
  await test('all nine reject client actor, quota, exclusion and time injection',async()=>{
    const before=requests.length;
    for(const spec of specs) {
      for(const key of ['user_id','actor','p_actor','p_limits','max_owned','p_as_of','excluded_user_ids']) {
        const extra=spec.method==='GET'?{query:`${key}=${member}`}:{body:{...payloads[spec.operation],[key]:member}};
        expect(await call(spec.operation,{...extra,token:ownerJwt}),400,'INVALID_INPUT');
      }
    }
    expect(await call('create-community',{body:{name:'x',data:{user_id:member}},token:ownerJwt}),400,'INVALID_INPUT');
    assert.equal(requests.length,before);
  });
  await test('strict request parsing rejects bad JSON, nonobjects, duplicate fields and oversized streams',async()=>{
    const before=requests.length;
    for(const raw of ['{','null','[]','"string"']) expect(await call('create-community',{raw,token:ownerJwt}),400,'INVALID_INPUT');
    expect(await call('create-community',{body:{name:'x'.repeat(20000)},token:ownerJwt}),413,'REQUEST_TOO_LARGE');
    expect(await call('community-detail',{query:'limit=1&limit=2',token:ownerJwt}),400,'INVALID_INPUT');
    expect(await call('community-detail',{query:'limit=0',token:ownerJwt}),400,'INVALID_INPUT');
    expect(await call('community-detail',{query:'limit=101',token:ownerJwt}),400,'INVALID_INPUT');
    expect(await call('community-detail',{query:'offset=-1',token:ownerJwt}),400,'INVALID_INPUT');
    expect(await call('community-detail',{query:'offset=2147483648',token:ownerJwt}),400,'INVALID_INPUT');
    expect(await call('community-detail',{query:'community_id=bad',token:ownerJwt}),400,'INVALID_INPUT');
    expect(await call('community-leaderboard',{query:`community_id=${missing}&period=day`,token:ownerJwt}),400,'INVALID_INPUT');
    assert.equal(requests.length,before);
  });
  await test('valid signature with no Auth user cannot become a database actor',async()=>{
    expect(await call('community-detail',{token:await jwt(missing)}),401,'AUTH_USER_UNAVAILABLE');
  });
  let community;
  await test('create uses API_KEY and JWT actor; defaults and credential priority are real',async()=>{
    const result=await call('create-community',{token:ownerJwt,body:{name:'Runtime fixture',description:'Small local fixture'}});
    expect(result,201);community=result.data.community;assert.equal(community.owner_id,user);
    assert.equal(await scalar('SELECT count(*)::int FROM community_members WHERE community_id=$1 AND user_id=$2',[community.id,user]),1);
    assert.deepEqual(requests.at(-1).args.p_limits,{max_owned:10,max_joined:20,max_members:2000});
    env.set('INSFORGE_SERVICE_ROLE_KEY',legacy);
    expect(await call('community-detail',{token:ownerJwt}),200);
    env.set('INSFORGE_SERVICE_ROLE_KEY',' ');expect(await call('community-detail',{token:ownerJwt}),200);
    env.delete('INSFORGE_SERVICE_ROLE_KEY');
  });
  await test('configured quotas reach PostgreSQL and cannot be overridden by clients',async()=>{
    env.set('COMMUNITY_MAX_OWNED','1');env.set('COMMUNITY_MAX_JOINED','1');env.set('COMMUNITY_MAX_MEMBERS','2');
    expect(await call('create-community',{token:ownerJwt,body:{name:'Second'}}),409,'OWNED_LIMIT');
    const detail=await call('community-detail',{token:ownerJwt});expect(detail,200);
    assert.deepEqual(detail.data.limits,{max_owned:1,max_joined:1,max_members:2});
    assert.equal(detail.data.owned_count,1);
  });
  await test('invite join and replay are idempotent; full community rejects another member',async()=>{
    const first=await call('join-community',{token:memberJwt,body:{invite_code:community.invite_code.toLowerCase()}});expect(first,200);
    assert.equal(first.data.already_member,false);
    const replay=await call('join-community',{token:memberJwt,body:{invite_code:community.invite_code}});expect(replay,200);assert.equal(replay.data.already_member,true);
    expect(await call('join-community',{token:strangerJwt,body:{invite_code:community.invite_code}}),409,'MEMBER_LIMIT');
    expect(await call('join-community',{token:strangerJwt,body:{invite_code:'B'.repeat(32)}}),404,'COMMUNITY_UNAVAILABLE');
  });
  await test('private detail/list exposes member counts and owner-only invite; no emails',async()=>{
    const result=await call('community-detail',{token:memberJwt,query:`community_id=${community.id}&limit=1&offset=0`});expect(result,200);
    assert.equal(result.data.members.length,1);assert.equal(result.data.member_count,2);assert.equal(result.data.community.invite_code,undefined);
    assert.ok(!JSON.stringify(result.data).includes('@example.invalid'));
    expect(await call('community-detail',{token:strangerJwt,query:`community_id=${community.id}`}),404,'COMMUNITY_UNAVAILABLE');
    expect(await call('leave-community',{token:ownerJwt,body:{community_id:community.id}}),409,'OWNER_CANNOT_LEAVE');
  });
  await test('week/month/total verify exact totals, zeros, pagination, me and manual exclusions',async()=>{
    const device='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',now=new Date(),hour=new Date(now);hour.setUTCMinutes(0,0,0);
    await db.query("INSERT INTO tokentracker_devices(id,user_id,device_name,platform) VALUES($1,$2,'Community runtime','fixture')",[device,user]);
    await db.query(`INSERT INTO tokentracker_hourly(user_id,device_id,hour_start,source,model,input_tokens,output_tokens,cached_input_tokens,total_tokens)
      VALUES($1,$2,$3,'codex','gpt-4o',100,20,10,130)`,[user,device,hour.toISOString()]);
    for(const period of ['week','month','total']) {
      const result=await call('community-leaderboard',{token:memberJwt,query:`community_id=${community.id}&period=${period}&limit=1&offset=0`});expect(result,200);
      assert.equal(result.data.rows.length,1);assert.equal(result.data.rows[0].total_tokens,'130');assert.equal(result.data.rows[0].rank,1);
      assert.equal(result.data.me.user_id,member);assert.equal(result.data.me.total_tokens,'0');assert.equal(result.data.me.rank,2);
      assert.equal(result.data.member_count,2);assert.equal(result.data.basis,'client_reported_tokens');assert.equal(result.data.automatic_anticheat,false);
      const trace=requests.at(-1);assert.equal(trace.args.p_actor,member);assert.equal(trace.args.p_as_of,undefined);
    }
    env.set('LEADERBOARD_BLOCKED_USER_IDS',user);
    const excluded=await call('community-leaderboard',{token:ownerJwt,query:`community_id=${community.id}`});expect(excluded,200);
    assert.equal(excluded.data.me,null);assert.equal(excluded.data.excluded_member_count,1);assert.equal(excluded.data.rows[0].rank,1);
    env.set('LEADERBOARD_BLOCKED_USER_IDS','invalid');expect(await call('community-leaderboard',{token:ownerJwt,query:`community_id=${community.id}`}),500,'SERVER_MISCONFIGURED');
    env.delete('LEADERBOARD_BLOCKED_USER_IDS');
    expect(await call('community-leaderboard',{token:strangerJwt,query:`community_id=${community.id}`}),404,'COMMUNITY_UNAVAILABLE');
  });
  await test('owner creates transfer, recipient rejects, and owner can issue replacement',async()=>{
    expect(await call('create-community-transfer',{token:memberJwt,body:{community_id:community.id,to_user_id:user}}),404,'COMMUNITY_UNAVAILABLE');
    const result=await call('create-community-transfer',{token:ownerJwt,body:{community_id:community.id,to_user_id:member}});expect(result,201);
    expect(await call('create-community-transfer',{token:ownerJwt,body:{community_id:community.id,to_user_id:member}}),409,'TRANSFER_PENDING');
    expect(await call('reject-community-transfer',{token:ownerJwt,body:{request_id:result.data.transfer.id}}),404,'TRANSFER_UNAVAILABLE');
    expect(await call('reject-community-transfer',{token:memberJwt,body:{request_id:result.data.transfer.id}}),200);
    expect(await call('accept-community-transfer',{token:memberJwt,body:{request_id:result.data.transfer.id}}),409,'TRANSFER_NOT_PENDING');
  });
  await test('expired transfer returns 410 and persists expired state rather than rollback',async()=>{
    const created=await call('create-community-transfer',{token:ownerJwt,body:{community_id:community.id,to_user_id:member}});expect(created,201);
    const id=created.data.transfer.id;
    await db.query("UPDATE community_transfer_requests SET created_at=now()-interval '8 days',expires_at=now()-interval '1 day' WHERE id=$1",[id]);
    expect(await call('accept-community-transfer',{token:memberJwt,body:{request_id:id}}),410,'TRANSFER_EXPIRED');
    assert.equal(await scalar('SELECT status FROM community_transfer_requests WHERE id=$1',[id]),'expired');
  });
  await test('accept checks configured owned quota at acceptance, and preserves pending request on rejection',async()=>{
    env.set('COMMUNITY_MAX_JOINED','2');
    const other=await call('create-community',{token:memberJwt,body:{name:'Recipient owned quota fixture'}});expect(other,201);
    const created=await call('create-community-transfer',{token:ownerJwt,body:{community_id:community.id,to_user_id:member}});expect(created,201);
    expect(await call('accept-community-transfer',{token:memberJwt,body:{request_id:created.data.transfer.id}}),409,'OWNED_LIMIT');
    assert.equal(await scalar('SELECT status FROM community_transfer_requests WHERE id=$1',[created.data.transfer.id]),'pending');
    expect(await call('reject-community-transfer',{token:memberJwt,body:{request_id:created.data.transfer.id}}),200);
    expect(await call('delete-community',{token:memberJwt,body:{community_id:other.data.community.id,confirmation_name:other.data.community.name}}),200);
    env.set('COMMUNITY_MAX_JOINED','1');
  });
  await test('recipient accepts ownership; replay is idempotent and old owner remains member',async()=>{
    const created=await call('create-community-transfer',{token:ownerJwt,body:{community_id:community.id,to_user_id:member}});expect(created,201);
    const id=created.data.transfer.id;
    expect(await call('accept-community-transfer',{token:ownerJwt,body:{request_id:id}}),404,'TRANSFER_UNAVAILABLE');
    const accepted=await call('accept-community-transfer',{token:memberJwt,body:{request_id:id}});expect(accepted,200);assert.equal(accepted.data.owner_id,member);
    assert.equal((await call('accept-community-transfer',{token:memberJwt,body:{request_id:id}})).data.already_accepted,true);
    assert.equal(await scalar('SELECT count(*)::int FROM community_members WHERE community_id=$1',[community.id]),2);
    expect(await call('delete-community',{token:ownerJwt,body:{community_id:community.id,confirmation_name:community.name}}),404,'COMMUNITY_UNAVAILABLE');
  });
  await test('ordinary member leaves, loses read access; owner deletes without touching tokens',async()=>{
    expect(await call('leave-community',{token:ownerJwt,body:{community_id:community.id}}),200);
    expect(await call('community-detail',{token:ownerJwt,query:`community_id=${community.id}`}),404,'COMMUNITY_UNAVAILABLE');
    expect(await call('delete-community',{token:memberJwt,body:{community_id:community.id,confirmation_name:'wrong'}}),400,'CONFIRMATION_REQUIRED');
    expect(await call('delete-community',{token:memberJwt,body:{community_id:community.id,confirmation_name:community.name}}),200);
    assert.equal(await scalar('SELECT count(*)::int FROM community_members WHERE community_id=$1',[community.id]),0);
    assert.equal(await scalar('SELECT count(*)::int FROM community_transfer_requests WHERE community_id=$1',[community.id]),0);
    assert.equal(await scalar('SELECT total_tokens::text FROM tokentracker_hourly WHERE user_id=$1',[user]),'130');
  });
  await test('SDK/database errors return safe 500 without raw diagnostics or credentials',async()=>{
    transport.failures.set('community_create','private SQL diagnostic');
    const result=await call('create-community',{token:ownerJwt,body:{name:'DB failure'}});expect(result,500,'DATABASE_ERROR');
    assert.ok(!JSON.stringify(result.data).includes('private SQL diagnostic'));transport.failures.delete('community_create');
  });
  await test('each manifest entry executed only its bound RPC with server actor/config',async()=>{
    assert.deepEqual([...new Set(requests.map(r=>r.rpc))].sort(),specs.map(s=>s.rpc).sort());
    assert.ok(requests.every(r=>[user,member,stranger,missing].includes(r.args.p_actor)));
    assert.ok(requests.every(r=>r.args.user_id===undefined && r.args.p_as_of===undefined));
    assert.ok([...transport.trace,...legacyTransport.trace].every(t=>t.kind==='rpc'));
    for(const spec of specs) {
      const before=requests.length;
      const query=spec.operation==='community-leaderboard'?`community_id=${missing}`:'';
      await call(spec.operation,{...validRequest(spec.operation),query,token:ownerJwt});
      assert.equal(requests.length,before+1);assert.equal(requests.at(-1).rpc,spec.rpc);
    }
  });
  console.log(`PASS ${passed} Community Edge runtime checks; ${requests.length} actual local SDK RPC requests; 9/9 contracts; no cloud touched`);
} finally {await db.close();}
