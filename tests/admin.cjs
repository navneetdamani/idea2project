const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../applications/recruitment/admin.js'),'utf8');
function harness(allowed=true){
  const nodes=new Map(),calls=[];let callback,deferred=false,resolvePage;
  const make=()=>({value:'',textContent:'',hidden:false,disabled:false,children:[],listeners:{},classList:{toggle(){}},append(child){this.children.push(child)},replaceChildren(){this.children=[];this.textContent='';this.innerHTML=''},addEventListener(k,f){this.listeners[k]=f},setAttribute(){}});
  const node=id=>{if(!nodes.has(id))nodes.set(id,make());return nodes.get(id)};
  const apps=Array.from({length:51},(_,n)=>({id:'application-'+n,job_id:n===50?'J2':'J1',candidate_id:'C'+n,status:'submitted',submitted_at:'2026-10-28T00:00:00Z',availability_days:30,statement:'Test experience',profile:{full_name:n?'Candidate '+n:'<script>unsafe</script>',headline:'Consultant',location:'Test city',experience_years:5,skills:['Mendix'],summary:'Test summary'}}));
  const ok=data=>Promise.resolve({data,error:null});
  const client={auth:{onAuthStateChange:fn=>callback=fn,signOut:()=>ok(null)},rpc(name,args){calls.push({name,args});
    if(name==='is_recruiter')return ok(allowed);
    if(name==='recruiter_job_summary')return ok(['J1','J2'].map(id=>({id,title:id==='J1'?'Test role':'Second role',is_open:true,total:apps.filter(a=>a.job_id===id).length,...Object.fromEntries(['submitted','in_review','rejected','closed','submitted_to_customer','customer_rejected'].map(status=>[status,apps.filter(a=>a.job_id===id&&a.status===status).length]))})));
    if(name==='recruiter_job_applicants'){
      const found=apps.filter(a=>(!args.p_job||a.job_id===args.p_job)&&(!args.p_status||a.status===args.p_status)&&(!args.p_search||a.profile.full_name.includes(args.p_search)));
      const data={total:found.length,items:found.slice(args.p_offset,args.p_offset+args.p_limit)};
      if(deferred)return new Promise(resolve=>resolvePage=()=>resolve({data,error:null}));return ok(data);
    }
    if(name==='set_application_review_status'){const app=apps.find(a=>a.id===args.p_application);if(app.status!==args.p_expected)return Promise.resolve({error:{code:'40001'}});app.status=args.p_status;return ok(app);}
    throw Error('Unexpected RPC '+name);
  }};
  const sandbox={URL,location:{href:'https://www.idea2proj.com/applications/recruitment/admin.html'},document:{getElementById:node,createElement:make,body:{append(){}}},setTimeout:fn=>setImmediate(fn),CandidateCore:{configReady:()=>true},TALENTFLOW_CONFIG:{},sessionStorage:{},supabase:{createClient:()=>client},TalentFlowOpenings:[]};sandbox.window=sandbox;vm.runInNewContext(source,sandbox);
  return {node,calls,apps,session:(s,event='SIGNED_IN')=>callback(event,s),defer:()=>deferred=true,resolve:()=>resolvePage()};
}
const flush=async()=>{for(let n=0;n<20;n++)await new Promise(setImmediate)};
(async()=>{
  let h=harness(false);h.session({user:{id:'C',email:'test@example.invalid'}});await flush();assert.equal(h.calls.length,1);assert.equal(h.node('admin-authorized').hidden,true);assert.match(h.node('admin-message').textContent,/does not have recruiter access/);
  h=harness();h.session({user:{id:'R',email:'reviewer@example.invalid'}});await flush();assert.equal(h.node('admin-applicants').children.length,50);assert.equal(h.node('admin-next').disabled,false);assert.equal(h.node('admin-jobs').children.length,2);assert.equal(h.node('admin-total').textContent,'51');assert.equal(h.node('admin-open-jobs').textContent,'2');assert.equal(h.calls.at(-1).args.p_job,'');assert.equal(h.calls.at(-1).args.p_status,'submitted');assert.match(h.node('admin-applicants').children[0].innerHTML,/&lt;script&gt;/);assert.doesNotMatch(h.node('admin-applicants').children[0].innerHTML,/<script>/);
  h.node('admin-next').listeners.click();await flush();assert.equal(h.node('admin-applicants').children.length,1);assert.equal(h.node('admin-next').disabled,true);assert.equal(h.calls.at(-1).args.p_offset,50);
  h.node('admin-previous').listeners.click();await flush();h.node('admin-applicants').children[0].children[0].listeners.click();assert.equal(h.node('admin-detail').hidden,false);assert.equal(h.node('admin-candidate-name').textContent,'<script>unsafe</script>');
  h.node('admin-review-status').value='in_review';await h.node('admin-status-form').listeners.submit({preventDefault(){}});await flush();assert.equal(h.apps[0].status,'in_review');assert.equal(h.node('admin-reviewing').textContent,'1');
  h.node('admin-filter-status').value='in_review';h.node('admin-filters').listeners.submit({preventDefault(){}});await flush();assert.equal(h.node('admin-applicants').children.length,1);
  h.node('admin-applicants').children[0].children[0].listeners.click();h.node('admin-review-status').value='rejected';await h.node('admin-status-form').listeners.submit({preventDefault(){}});await flush();assert.equal(h.node('admin-rejected').textContent,'1');assert.equal(h.apps[0].status,'rejected');h.node('admin-show-new').listeners.click();await flush();assert.equal(h.calls.at(-1).args.p_job,'');assert.equal(h.calls.at(-1).args.p_status,'submitted');h.node('admin-jobs').children[1].children[0].listeners.click();await flush();assert.equal(h.calls.at(-1).args.p_job,'J2');assert.equal(h.node('admin-applicants').children.length,1);h.node('admin-show-all').listeners.click();await flush();assert.equal(h.calls.at(-1).args.p_job,'');assert.equal(h.calls.at(-1).args.p_status,'');
  h.node('admin-applicants').children[0].children[0].listeners.click();h.node('admin-review-status').value='submitted_to_customer';await h.node('admin-status-form').listeners.submit({preventDefault(){}});await flush();assert.equal(h.node('admin-customer-submitted').textContent,'1');h.node('admin-review-status').value='customer_rejected';await h.node('admin-status-form').listeners.submit({preventDefault(){}});await flush();assert.equal(h.node('admin-customer-submitted').textContent,'0');assert.equal(h.node('admin-customer-rejected').textContent,'1');
  h.defer();h.node('admin-filters').listeners.submit({preventDefault(){}});await flush();h.session(null,'SIGNED_OUT');await flush();h.resolve();await flush();assert.equal(h.node('admin-applicants').children.length,0);assert.equal(h.node('admin-detail').hidden,true);assert.equal(h.node('admin-candidate-name').textContent,'');
  console.log('PASS: recruiter gate, complete pagination, escaped applicant names, status updates, filtering and sign-out race isolation');
})().catch(e=>{console.error(e);process.exitCode=1});
