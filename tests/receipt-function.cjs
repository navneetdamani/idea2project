const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../supabase/functions/application-receipt/index.ts'),'utf8').replace(/^import .*;\r?\n/gm,'');
function harness({authorized=true,owned=true,password=true,state='pending',fail=false}={}) {
  let handler,sends=0;const updates=[];
  const row={id:'11111111-1111-1111-1111-111111111111',job_id:'J1',submitted_at:'2026-10-25T00:00:00Z'};
  const result=data=>Promise.resolve({data,error:null});
  const admin={auth:{getUser:()=>result({user:authorized?{id:'candidate-a',email:'candidate@example.invalid',email_confirmed_at:'yes'}:null})},rpc:()=>result(state==='pending'?[{state:'sending'}]:[]),from(table){return {
    select(){if(table==='job_applications')return {eq(){return {eq:()=>({maybeSingle:()=>result(owned?row:null)})}}};if(table==='published_jobs')return {eq:()=>({single:()=>result({title:'Role <test>'})})};return {eq:()=>({single:()=>result({state})})}},
    update(value){updates.push(value);return {eq:()=>result(null)}}
  }}};
  const sandbox={Request,Response,Date,console,createClient:()=>admin,Deno:{env:{get:key=>key==='RECRUITMENT_SMTP_PASSWORD'?(password?'fake-test-only':undefined):'fake-test-only'},serve:fn=>handler=fn},nodemailer:{createTransport:()=>({async sendMail(mail){sends++;assert.equal(mail.to,'candidate@example.invalid');assert.doesNotMatch(mail.html,/<test>/);assert.match(mail.html,/&lt;test&gt;/);if(fail)throw Object.assign(Error('provider error'),{code:'EAUTH'});},close(){}})}};
  vm.runInNewContext(source,sandbox);
  return {updates,get sends(){return sends},run:(token='valid')=>handler(new Request('https://example.invalid',{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify({application_id:row.id})}))};
}
(async()=>{
  let h=harness();assert.equal((await h.run('')).status,401);assert.equal(h.sends,0);
  h=harness({authorized:false});assert.equal((await h.run()).status,401);
  h=harness({owned:false});assert.equal((await h.run()).status,404);assert.equal(h.sends,0);
  h=harness({password:false});assert.equal((await h.run()).status,503);assert.equal(h.sends,0);
  h=harness({state:'sent'});assert.equal((await h.run()).status,200);assert.equal(h.sends,0);
  h=harness();assert.equal((await h.run()).status,200);assert.equal(h.sends,1);assert.equal(h.updates[0].state,'sent');
  h=harness({fail:true});assert.equal((await h.run()).status,503);assert.equal(h.updates[0].state,'failed');assert.equal(h.updates[0].last_error,'EAUTH');
  console.log('PASS: receipt authentication, ownership, configured transport, idempotency, safe recipient, escaping and retryable delivery failure');
})().catch(error=>{console.error(error);process.exitCode=1});
