import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
export const digest = s => createHash('sha256').update(s).digest('hex');
export const token = () => randomBytes(32).toString('base64url');
export class Store {
  constructor(path) {
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY, uid TEXT, login TEXT, email TEXT, csrf TEXT, expires INTEGER);
      CREATE TABLE IF NOT EXISTS oauth (hash TEXT PRIMARY KEY, verifier TEXT, expires INTEGER);
      CREATE TABLE IF NOT EXISTS quota (key TEXT PRIMARY KEY, count INTEGER, expires INTEGER);
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
      CREATE TABLE IF NOT EXISTS requests (id TEXT PRIMARY KEY, uid TEXT, prompt TEXT, created INTEGER,
        status TEXT, data TEXT NOT NULL DEFAULT '{}', idempotency TEXT, UNIQUE(uid,idempotency));
      CREATE TABLE IF NOT EXISTS audit (seq INTEGER PRIMARY KEY, time INTEGER, uid TEXT, request_id TEXT, event TEXT, detail TEXT, previous TEXT, hash TEXT);
      CREATE TRIGGER IF NOT EXISTS audit_no_update BEFORE UPDATE ON audit BEGIN SELECT RAISE(ABORT,'Append only'); END;
      CREATE TRIGGER IF NOT EXISTS audit_no_delete BEFORE DELETE ON audit BEGIN SELECT RAISE(ABORT,'Append only'); END;`);
    this.verifyAudit();
  }
  transaction(fn) {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = fn(); this.db.exec('COMMIT'); return result; }
    catch(e) { this.db.exec('ROLLBACK'); throw e; }
  }
  audit(uid, id, event, detail = {}) {
    const previous = this.db.prepare('SELECT hash FROM audit ORDER BY seq DESC LIMIT 1').get()?.hash || '';
    const time = Date.now(), data = JSON.stringify(detail);
    const hash = digest(JSON.stringify([time, uid, id, event, data, previous]));
    this.db.prepare('INSERT INTO audit(time,uid,request_id,event,detail,previous,hash) VALUES(?,?,?,?,?,?,?)').run(time,uid,id,event,data,previous,hash);
  }
  verifyAudit() {
    let previous='';
    for (const r of this.db.prepare('SELECT * FROM audit ORDER BY seq').iterate()) {
      if(r.previous!==previous || r.hash!==digest(JSON.stringify([r.time,r.uid,r.request_id,r.event,r.detail,r.previous]))) throw Error('Audit integrity check failed');
      previous=r.hash;
    }
  }
  limit(key, max, windowMs) {
    const now = Date.now();
    this.db.prepare('DELETE FROM quota WHERE expires < ?').run(now);
    const row = this.db.prepare('SELECT count FROM quota WHERE key=?').get(key);
    if (row?.count >= max) throw Object.assign(Error('Rate limit reached. Please try later.'), {status:429});
    this.db.prepare('INSERT INTO quota VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1').run(key,now+windowMs);
  }
  submit(uid, prompt, key) {
    return this.transaction(() => {
      const old = this.db.prepare('SELECT id FROM requests WHERE uid=? AND idempotency=?').get(uid,key);
      if (old) return old.id;
      this.limit(`submit:${uid}`,5,3600000);
      this.limit('global:submit',20,86400000);
      if (this.db.prepare("SELECT COUNT(*) AS n FROM requests WHERE status IN ('queued','planning','checking','deploying')").get().n >= 20) throw Object.assign(Error('Queue is full'),{status:429});
      const id = randomUUID();
      this.db.prepare('INSERT INTO requests(id,uid,prompt,created,status,idempotency) VALUES(?,?,?,?,?,?)').run(id,uid,prompt,Date.now(),'queued',key);
      this.audit(uid,id,'submitted',{promptHash:digest(prompt)});
      return id;
    });
  }
  get(id) { const r = this.db.prepare('SELECT * FROM requests WHERE id=?').get(id); return r && {...r,data:JSON.parse(r.data)}; }
  state(id,status,data) {
    this.transaction(() => {
      const r = this.get(id);
      this.db.prepare('UPDATE requests SET status=?,data=? WHERE id=?').run(status,JSON.stringify({...r.data,...data}),id);
      this.audit('system',id,status,data);
    });
  }
  list(uid, admin) { return this.db.prepare(`SELECT id,uid,prompt,created,status,data FROM requests ${admin?'':'WHERE uid=?'} ORDER BY created DESC LIMIT 100`).all(...(admin?[]:[uid])).map(r=>({...r,data:JSON.parse(r.data)})); }
  session(uid,login,email) {
    const raw = token(), csrf = token();
    this.db.prepare('DELETE FROM sessions WHERE expires < ?').run(Date.now());
    this.db.prepare('INSERT INTO sessions VALUES(?,?,?,?,?,?)').run(digest(raw),uid,login,email,csrf,Date.now()+8*3600000);
    this.audit(uid,'','login');
    return raw;
  }
  close() { this.db.close(); }
}
