const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../applications/recruitment/reviewer.js'),'utf8');
const id='11111111-1111-1111-1111-111111111111';
function harness(allowed){
  const nodes=new Map();let callback,reads=0;
  const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',hidden:false,addEventListener(){}});return nodes.get(id);};
  const ok=data=>Promise.resolve({data,error:null});
  const app={id,candidate_id:'A',job_id:'J1',status:'in_review',submitted_at:'2026-10-27T00:00:00Z',availability_days:30,statement:'Test application statement'};
  const profile={full_name:'<script>test</script>',headline:'Consultant',location:'Test city',experience_years:4,skills:['Testing'],summary:'Test summary'};
  const client={auth:{onAuthStateChange:fn=>callback=fn},rpc:()=>ok(allowed),from(table){reads++;return {select(){return {eq(){return {maybeSingle:()=>ok(table==='job_applications'?app:{title:'Test role'}),single:()=>ok(profile)};}};}};}};
  const sandbox={URL,location:{href:'https://www.idea2proj.com/applications/recruitment/reviewer.html?application='+id},document:{getElementById:node},setTimeout:fn=>setImmediate(fn),CandidateCore:{configReady:()=>true},TALENTFLOW_CONFIG:{},sessionStorage:{},supabase:{createClient:()=>client}};sandbox.window=sandbox;vm.runInNewContext(source,sandbox);
  return {node,session:s=>callback('SIGNED_IN',s),get reads(){return reads}};
}
const flush=async()=>{for(let n=0;n<8;n++)await new Promise(setImmediate);};
(async()=>{
  let h=harness(false);h.session({user:{id:'candidate'}});await flush();assert.equal(h.reads,0);assert.equal(h.node('review-detail').hidden,true);assert.match(h.node('review-status').textContent,/does not have recruiter access/);
  h=harness(true);h.session({user:{id:'recruiter'}});await flush();assert.equal(h.node('review-detail').hidden,false);assert.equal(h.node('review-name').textContent,'<script>test</script>');assert.match(h.node('review-state').textContent,/In review/);
  h.session(null);await flush();assert.equal(h.node('review-detail').hidden,true);assert.equal(h.node('review-name').textContent,'');
  console.log('PASS: recruiter-only lookup, current status, plain-text rendering and private-data clearing on sign-out');
})().catch(e=>{console.error(e);process.exitCode=1});
