import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readCommunityLimits } from './config.mjs';
test('absent env uses the one central fallback',()=>{
  assert.deepEqual(readCommunityLimits(()=>undefined),{max_owned:10,max_joined:20,max_members:2000});
});
test('env overrides each quota, independently',()=>{
  const values={COMMUNITY_MAX_OWNED:'2',COMMUNITY_MAX_JOINED:'3',COMMUNITY_MAX_MEMBERS:' 4 '};
  const result=readCommunityLimits(k=>values[k]);
  assert.deepEqual(result,{max_owned:2,max_joined:3,max_members:4});
  assert.ok(Object.isFrozen(result));
  assert.deepEqual(readCommunityLimits(k=>k==='COMMUNITY_MAX_OWNED'?'1':undefined),{max_owned:1,max_joined:20,max_members:2000});
});
test('bad configured limits fail instead of silently falling back',()=>{
  for(const value of ['', '0','-1','1.5','2e3','Infinity','2147483648','null',null,10]) {
    assert.throws(()=>readCommunityLimits(()=>value),/Invalid COMMUNITY_MAX_OWNED/);
  }
  assert.throws(()=>readCommunityLimits(),/environment reader/);
});
