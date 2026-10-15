import test from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../store.mjs';
import { Worker } from '../worker.mjs';
function fixture() {
  const s=new Store(':memory:'),id=s.submit('owner','Change a headline','unique-key-0000001');let merges=0;
  const g={main:async()=>'base',files:async()=>({}),proposal:async()=>({base:'base',head:'head',pr:1,baseTree:'old-tree'}),mergeGate:async()=>({ready:true}),merge:async()=>{merges++;return 'merged';},deployment:async()=>({ok:true,url:'https://github.com/run'})};
  const w=new Worker({autoPublish:true},s,g,async()=>[]);
  return {s,id,g,w,merges:()=>merges};
}
test('full queue → branch → checks → merge → deployment',async()=>{
  const f=fixture();try{await f.w.tick();assert.equal(f.s.get(f.id).status,'checking');await f.w.tick();assert.equal(f.merges(),1);assert.equal(f.s.get(f.id).status,'deploying');await f.w.tick();assert.equal(f.s.get(f.id).status,'deployed');}finally{f.s.close();}
});
test('pending checks never merge',async()=>{
  const f=fixture();try{f.g.mergeGate=async()=>null;await f.w.tick();await f.w.tick();assert.equal(f.merges(),0);assert.equal(f.s.get(f.id).status,'checking');}finally{f.s.close();}
});
test('failed checks never merge',async()=>{
  const f=fixture();try{f.g.mergeGate=async()=>{throw Error('Automated checks failed');};await f.w.tick();await f.w.tick();assert.equal(f.merges(),0);assert.equal(f.s.get(f.id).status,'failed');}finally{f.s.close();}
});
test('configuration and administrator pause block publishing',async()=>{
  const f=fixture();try{f.w.config.autoPublish=false;await f.w.tick();await f.w.tick();assert.equal(f.merges(),0);f.w.config.autoPublish=true;f.w.pause();await f.w.tick();assert.equal(f.merges(),0);}finally{f.s.close();}
});
test('uncertain merge reconciles without duplicate generation',async()=>{
  const f=fixture();try{await f.w.tick();f.g.merge=async()=>{throw Error('connection reset');};await f.w.tick();assert.equal(f.s.get(f.id).status,'checking');f.g.mergeGate=async()=>({merged:'merged'});await f.w.tick();assert.equal(f.s.get(f.id).status,'deploying');}finally{f.s.close();}
});
test('deployment failure pauses queue',async()=>{
  const f=fixture();try{await f.w.tick();await f.w.tick();f.g.deployment=async()=>({ok:false});await f.w.tick();assert.equal(f.s.get(f.id).status,'deployment-failed');assert.equal(f.w.paused(),true);}finally{f.s.close();}
});
test('rollback fails if main advanced',async()=>{
  const f=fixture();try{f.s.state(f.id,'queued-rollback',{rollbackOf:'missing'});await f.w.tick();assert.equal(f.s.get(f.id).status,'failed');assert.equal(f.merges(),0);}finally{f.s.close();}
});
test('restart fails interrupted planning safely',()=>{
  const f=fixture();try{f.s.state(f.id,'planning',{});f.w.recover();assert.equal(f.s.get(f.id).status,'failed');}finally{f.s.close();}
});
test('latest-update rollback creates a checked revert and remains paused',async()=>{
  const f=fixture();try{
    f.s.state(f.id,'deployed',{base:'base',baseTree:'prior-tree',merged:'current-main'});
    const id=f.s.submit('owner','Administrator rollback','unique-rollback-key');
    f.s.state(id,'queued-rollback',{rollbackOf:f.id});f.w.pause();f.g.main=async()=>'current-main';
    let proposalArgs;
    f.g.proposal=async(...args)=>{proposalArgs=args;return {base:'current-main',head:'revert-head',pr:2,baseTree:'current-tree'};};
    await f.w.tick();assert.deepEqual(proposalArgs,[id,'current-main',[],'prior-tree']);
    assert.equal(f.s.get(id).status,'checking');await f.w.tick();assert.equal(f.merges(),1);
    await f.w.tick();assert.equal(f.s.get(f.id).status,'rolled-back');assert.equal(f.w.paused(),true);
  }finally{f.s.close();}
});
