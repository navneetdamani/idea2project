import test from 'node:test';
import assert from 'node:assert/strict';
import { Store,digest } from '../store.mjs';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
test('idempotency, private history and per-user quota',()=>{
  const s=new Store(':memory:');
  try{
    const id=s.submit('one','A sufficiently long prompt','unique-key-000001');
    assert.equal(s.submit('one','A different prompt','unique-key-000001'),id);
    assert.equal(s.list('two',false).length,0);assert.equal(s.list('two',true).length,1);
    for(let i=0;i<4;i++)s.submit('one','A sufficiently long prompt',`unique-key-${i}`);
    assert.throws(()=>s.submit('one','Another prompt','last-key'),/Rate limit/);
    assert.equal(s.list('one',false).length,5);
  }finally{s.close();}
});
test('global daily spending quota and transactional limits',()=>{
  const s=new Store(':memory:');try{
    for(let i=0;i<20;i++){const id=s.submit(`u${i}`,'A long enough update',`key-${i}`);s.state(id,'failed',{});}
    assert.throws(()=>s.submit('extra','A long enough update','key-extra'),/Rate limit/);
    assert.equal(s.db.prepare("SELECT count FROM quota WHERE key='submit:extra'").get(),undefined);
  }finally{s.close();}
});
test('audit is linked and append only; session tokens are hashed',()=>{
  const s=new Store(':memory:');try{
    const raw=s.session('1','owner','owner@example.com');
    assert.equal(s.db.prepare('SELECT hash FROM sessions').get().hash,digest(raw));
    s.audit('1','','test');
    const rows=s.db.prepare('SELECT * FROM audit ORDER BY seq').all();
    assert.equal(rows[1].previous,rows[0].hash);
    for(const r of rows)assert.equal(r.hash,digest(JSON.stringify([r.time,r.uid,r.request_id,r.event,r.detail,r.previous])));
    assert.throws(()=>s.db.exec('UPDATE audit SET event=\'tampered\''),/Append only/);
    assert.throws(()=>s.db.exec('DELETE FROM audit'),/Append only/);
  }finally{s.close();}
});
test('audit verification detects altered rows',()=>{
  const s=new Store(':memory:');try{
    s.audit('owner','','event');s.db.exec('DROP TRIGGER audit_no_update');
    s.db.exec("UPDATE audit SET event='tampered'");assert.throws(()=>s.verifyAudit(),/integrity/);
  }finally{s.close();}
});
test('requests, sessions, audit and pause survive database reopen',()=>{
  const dir=mkdtempSync(join(tmpdir(),'portal-test-')),path=join(dir,'test.sqlite');
  try{
    const s=new Store(path),id=s.submit('one','Persist this update','persistent-key-1');
    const session=s.session('one','editor','editor@example.com');
    s.db.prepare("INSERT INTO settings VALUES('paused','true')").run();s.close();
    const reopened=new Store(path);try{
      assert.equal(reopened.get(id).status,'queued');
      assert.ok(reopened.db.prepare('SELECT * FROM sessions WHERE hash=?').get(digest(session)));
      assert.equal(reopened.db.prepare('SELECT value FROM settings').get().value,'true');reopened.verifyAudit();
    }finally{reopened.close();}
  }finally{rmSync(dir,{recursive:true,force:true});}
});
