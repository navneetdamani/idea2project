const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../supabase/functions/application-receipt/index.ts'),'utf8').replace(/^import .*;\r?\n/gm,'');
function harness({authorized=true,owned=true,password=true,state='pending',recruiterState='pending',failTo=null,reject=false}={}){
  let handler;const sends=[],updates=[],receipt={state,recruiter_state:recruiterState};
  const row={id:'11111111-1111-1111-1111-111111111111',job_id:'J1',submitted_at:'2026-10-25T00:00:00Z'};
  const result=data=>Promise.resolve({data,error:null});
  const admin={auth:{getUser:()=>result({user:authorized?{id:'candidate-a',email:'candidate@example.invalid',email_confirmed_at:'yes'}:null})},
    rpc(name){const key=name==='claim_application_receipt'?'state':'recruiter_state';const claim=['pending','failed'].includes(receipt[key]);if(claim)receipt[key]='sending';return result(claim?[{}]:[]);},
    from(table){return {select(){if(table==='job_applications')return {eq(){return {eq:()=>({maybeSingle:()=>result(owned?row:null)})}}};if(table==='published_jobs')return {eq:()=>({single:()=>result({title:'Role <test>'})})};return {eq:()=>({single:()=>result(receipt)})};},update(value){updates.push(value);Object.assign(receipt,value);return {eq:()=>result(null)};}}}};
  const sandbox={Request,Response,Date,console,createClient:()=>admin,Deno:{env:{get:key=>key==='RECRUITMENT_SMTP_PASSWORD'?(password?'test-only':undefined):'test-only'},serve:fn=>handler=fn},
    nodemailer:{createTransport:()=>({async sendMail(mail){sends.push(mail);assert.doesNotMatch(mail.html,/<test>/);assert.match(mail.html,/&lt;test&gt;/);assert.equal(mail.attachments,undefined);if(mail.to===failTo)throw Object.assign(Error('provider failure'),{code:'EAUTH'});return {accepted:reject?[]:[mail.to]};},close(){}})}};
  vm.runInNewContext(source,sandbox);
  return {sends,updates,receipt,run:(token='valid')=>handler(new Request('https://example.invalid',{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify({application_id:row.id,to:'attacker@example.invalid'})}))};
}
(async()=>{
  for(const option of [{authorized:false},{owned:false},{password:false}]){const h=harness(option);assert.ok((await h.run()).status>=400);assert.equal(h.sends.length,0);}
  let h=harness();assert.equal((await h.run('')).status,401);
  h=harness();assert.equal((await h.run()).status,200);assert.deepEqual(h.sends.map(x=>x.to),['candidate@example.invalid','info@idea2proj.com']);
  assert.match(h.sends[0].text,/candidate\.html\?application=11111111-1111-1111-1111-111111111111#my-applications/);assert.match(h.sends[0].html,/Check application status/);
  assert.match(h.sends[1].text,/reviewer\.html\?application=/);assert.match(h.sends[1].text,/authorized recruiter/);
  await h.run();assert.equal(h.sends.length,2,'Retry must not resend successful messages');
  h=harness({state:'sent',recruiterState:'failed'});await h.run();assert.equal(h.sends.length,1);assert.equal(h.sends[0].to,'info@idea2proj.com');
  h=harness({failTo:'info@idea2proj.com'});assert.equal((await h.run()).status,503);assert.equal(h.receipt.state,'sent');assert.equal(h.receipt.recruiter_state,'failed');
  h=harness({failTo:'candidate@example.invalid'});await h.run();assert.equal(h.receipt.state,'failed');assert.equal(h.receipt.recruiter_state,'sent');
  h=harness({reject:true});await h.run();assert.equal(h.receipt.state,'failed');assert.equal(h.receipt.recruiter_state,'failed');
  console.log('PASS: fixed recipients, signed-in status/review links, independent delivery/retries, authorization, escaping and SMTP rejection');
})().catch(error=>{console.error(error);process.exitCode=1});

