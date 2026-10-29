const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../applications/recruitment/applications.js'),'utf8');
const nodes=new Map(),applications=[];let authCallback,hasProfile=false,hasCV=false;
const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',checked:false,disabled:false,textContent:'',children:[],listeners:{},classList:{toggle(){}},replaceChildren(){this.children=[];this.textContent=''},append(x){this.children.push(x)},reset(){},addEventListener(k,f){this.listeners[k]=f}});return nodes.get(id)};
const ok=data=>Promise.resolve({data,error:null});
const client={auth:{onAuthStateChange(fn){authCallback=fn}},storage:{from:()=>({list:()=>ok(hasCV?[{name:'latest.pdf'}]:[])})},from(table){return {
  select(){if(table==='candidate_profiles')return {eq:()=>({maybeSingle:()=>ok(hasProfile?{id:'A'}:null)})};return {eq:(field,id)=>({order:()=>ok(table==='published_jobs'?[{id:'I2P-20261027-01',title:'Test role'}]:applications.filter(a=>a.candidate_id===id))})}},
  insert(payload){return {select:()=>({single:()=>{if(applications.some(a=>a.candidate_id===payload.candidate_id&&a.job_id===payload.job_id))return Promise.resolve({error:{code:'23505'}});const data={...payload,id:'test-reference',status:'submitted',submitted_at:'2026-10-25T00:00:00Z'};applications.push(data);return ok(data)}})}}
}}};
const sandbox={document:{getElementById:node,createElement:()=>({})},URL,sessionStorage:{setItem(){},getItem(){return null}},setTimeout:fn=>setImmediate(fn),location:{href:'https://www.idea2proj.com/applications/recruitment/candidate.html?job=I2P-20261027-01'},TalentFlowCandidate:{client}};sandbox.window=sandbox;
vm.runInNewContext(source,sandbox);
const flush=async()=>{for(let i=0;i<8;i++)await new Promise(setImmediate)};
const submit=async()=>{await node('application-form').listeners.submit({preventDefault(){}});await flush()};
(async()=>{
  authCallback('SIGNED_IN',{user:{id:'A'}});await flush();assert.equal(node('application-job').value,'I2P-20261027-01');
  node('availability-days').value='30';node('application-statement').value='Fictional implementation experience relevant to the role.';node('application-consent').checked=true;
  await submit();assert.match(node('application-status').textContent,/Save your candidate profile/);assert.equal(applications.length,0);
  hasProfile=true;await submit();assert.match(node('application-status').textContent,/Upload your latest CV/);
  hasCV=true;node('application-consent').checked=false;await submit();assert.equal(applications.length,0);
  node('application-consent').checked=true;await submit();assert.equal(applications.length,1);assert.match(node('application-status').textContent,/Application submitted.*test-reference/);assert.equal(node('my-applications').children.length,1);
  assert.equal(node('application-total').textContent,'1');assert.equal(node('submission-confirmation').hidden,false);assert.equal(node('submission-reference').textContent,'test-reference');
  applications[0].status='in_review';applications[0].published_jobs={title:'Archived <script>role</script>',is_open:false};node('refresh-applications').listeners.click();await flush();assert.equal(node('application-reviewing').textContent,'1');assert.match(node('my-applications').children[0].innerHTML,/In review/);assert.match(node('my-applications').children[0].innerHTML,/Archived &lt;script&gt;/);assert.doesNotMatch(node('my-applications').children[0].innerHTML,/<script>/);
  applications[0].status='rejected';node('refresh-applications').listeners.click();await flush();assert.equal(node('application-rejected').textContent,'1');assert.equal(node('application-closed').textContent,'0');assert.match(node('my-applications').children[0].innerHTML,/Rejected/);
  for(const [status,label] of [['submitted_to_customer','Submitted to customer'],['customer_rejected','Customer rejected']]){applications[0].status=status;node('refresh-applications').listeners.click();await flush();assert.match(node('my-applications').children[0].innerHTML,new RegExp(label));}
  node('application-statement').value='Another fictional response for the same role.';node('application-consent').checked=true;await submit();assert.match(node('application-status').textContent,/already applied/);assert.equal(applications.length,1);
  authCallback('SIGNED_OUT',null);await flush();assert.equal(node('application-fields').disabled,true);assert.equal(node('my-applications').children.length,0);
  console.log('PASS: selected role, profile/CV prerequisites, consent, confirmed submission, duplicate handling and sign-out isolation');
})().catch(e=>{console.error(e);process.exitCode=1});
