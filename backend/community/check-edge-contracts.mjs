import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { inspectEdge } from '../bootstrap/edge-contracts.mjs';
import { checkEdges,root } from './build-edges.mjs';
import { specs } from './edge-spec.mjs';
export async function checkCommunityContracts(db) {
  const catalog=(await db.query("SELECT proname,proargnames,pronargs,pronargdefaults,oid FROM pg_proc WHERE pronamespace='public'::regnamespace")).rows;
  const entries=checkEdges();
  for(const row of entries) {
    const actual=inspectEdge(fs.readFileSync(path.join(root,row.entry),'utf8'),row.entry);
    assert.equal(actual.tables.size,0,'Community HTTP handlers must access only protected RPCs');
    // Each standalone entry includes the shared dispatcher. The runtime tests
    // additionally prove that the bound operation calls only its own RPC.
    assert.deepEqual(actual.rpcs.map(r=>r.name).sort(),specs.map(s=>s.rpc).sort());
    for(const rpc of actual.rpcs) {
      const fn=catalog.find(f=>f.proname===rpc.name);
      assert.ok(fn,`Missing ${rpc.name}`);
      assert.ok(rpc.args.every(arg=>fn.proargnames.includes(arg)),`Unknown named argument: ${rpc.name}`);
      assert.ok(fn.proargnames.slice(0,fn.pronargs-fn.pronargdefaults).every(arg=>rpc.args.includes(arg)),`Missing argument: ${rpc.name}`);
      const privileges=(await db.query("SELECT has_function_privilege('anon',$1,'EXECUTE') AS anon,has_function_privilege('authenticated',$1,'EXECUTE') AS authenticated,has_function_privilege('project_admin',$1,'EXECUTE') AS admin",[fn.oid])).rows[0];
      assert.ok(!privileges.anon && !privileges.authenticated && privileges.admin,`RPC permission drift: ${rpc.name}`);
    }
  }
  return entries;
}
