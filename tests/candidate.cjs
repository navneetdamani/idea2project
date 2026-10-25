const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const core = require('../demos/recruitment/candidate-core.js');
const root = path.join(__dirname,'../demos/recruitment');
const cfg = {supabaseUrl:'https://example-project.supabase.co',supabasePublishableKey:'sb_publishable_abcdefghijklmnopqrstuv'};
const input = {full_name:' Demo Candidate ',headline:'SAP Consultant',location:'Remote',phone:'',experience_years:'7.5',skills:'SAP PS, SAP PS, FI/CO',summary:'Sample projects',consent:true};
const flush = async () => {for(let i=0;i<8;i++)await new Promise(setImmediate)};
function harness(config) {
  const nodes = new Map(), profiles = new Map(), files = new Map(), calls = [];
  let onAuth, session = null, listError = false;
  const node = id => {
    if(!nodes.has(id))nodes.set(id,{value:'',checked:false,disabled:false,hidden:false,files:[],dataset:{},listeners:{},classList:{toggle(){}},setAttribute(){},addEventListener(name,fn){this.listeners[name]=fn},reset(){},click(){},remove(){}});
    return nodes.get(id);
  };
  const tabs = ['login','signup'].map(mode=>{const n=node(mode+'-tab');n.dataset.mode=mode;return n});
  const result = data=>Promise.resolve({data,error:null});
  const client = {
    auth:{onAuthStateChange(fn){onAuth=fn},async signUp(payload){calls.push(['signup',payload]);return {data:{session:null}}},async signInWithPassword(payload){calls.push(['login',payload]);return {data:{}}},async resetPasswordForEmail(email,options){calls.push(['reset',email,options]);return {data:{}}},async updateUser(payload){calls.push(['password',payload]);return {data:{}}},getSession(){return result({session})},async signOut(){session=null;return {data:{}}}},
    from(table){assert.equal(table,'candidate_profiles');return {
      select(){return {eq(field,id){assert.equal(field,'id');return {maybeSingle:()=>result(profiles.get(id)||null)}}}},
      upsert(payload){profiles.set(payload.id,payload);return {select:()=>({single:()=>result(payload)})}},
      delete(){return {eq(field,id){return {select(){const found=profiles.delete(id);return result(found?[{id}]:[])}}}}}
    }},
    storage:{from(bucket){assert.equal(bucket,'candidate-cvs');return {
      list(id){return listError ? Promise.resolve({error:{message:'temporary outage'}}) : result(files.has(id+'/latest.pdf')?[{name:'latest.pdf',updated_at:'2026-10-22T00:00:00Z'}]:[])},
      upload(key,file,options){calls.push(['upload',key,options]);files.set(key,file);return result({path:key})},
      remove(keys){keys.forEach(k=>files.delete(k));return result([])},
      download(key){return result(files.get(key))}
    }}}
  };
  const sandbox = {console,CandidateCore:core,TALENTFLOW_CONFIG:config,supabase:{createClient(url,key,options){calls.push(['client',url,key,options]);return client}},document:{getElementById:node,querySelectorAll:()=>tabs,createElement:()=>node('download-link'),body:{append(){}}},URL,sessionStorage:{},location:{href:'https://www.idea2proj.com/demos/recruitment/candidate.html'},setTimeout(fn,delay){if(!delay)setImmediate(fn)},confirm:()=>true};
  sandbox.window=sandbox;
  vm.runInNewContext(fs.readFileSync(path.join(root,'candidate.js'),'utf8'),sandbox);
  return {node,profiles,files,calls,setListError(value){listError=value},async event(type,user){session=user?{user}:null;onAuth(type,session);await flush()},async submit(id){node(id).listeners.submit({preventDefault(){}});await flush()},async change(id){node(id).listeners.change();await flush()},async click(id){node(id).listeners.click();await flush()}};
}
(async()=>{
  assert.equal(core.configReady(cfg),true);
  for(const key of ['sb_secret_abcdefghijklmnopqrstuv','', 'eyJhbGciOiJIUzI1NiJ9.'+btoa(JSON.stringify({role:'service_role'}))+'.sig'])assert.equal(core.configReady({...cfg,supabasePublishableKey:key}),false);
  assert.equal(core.configReady({...cfg,supabaseUrl:'http://insecure.example'}),false);
  assert.deepEqual(core.profilePayload('user-a',input).skills,['SAP PS','FI/CO']);
  assert.equal(core.profilePayload('user-a',{...input,id:'user-b'}).id,'user-a');
  for(const data of [{consent:false},{experience_years:''},{experience_years:81},{experience_years:1.234},{full_name:''},{skills:','}])assert.throws(()=>core.profilePayload('user-a',{...input,...data}));
  await core.validateCV(new File(['%PDF-1.7 sample'],'cv.pdf',{type:'application/pdf'}));
  for(const file of [new File(['text'],'cv.pdf',{type:'application/pdf'}),new File(['%PDF-1'],'cv.html',{type:'text/html'}),new File(['%PDF-1',new Uint8Array(core.MAX_CV_BYTES)],'cv.pdf',{type:'application/pdf'})])await assert.rejects(()=>core.validateCV(file));
  let h=harness({});assert.equal(h.node('auth-fields').disabled,true);assert.equal(h.calls.length,0);
  h=harness(cfg);assert.equal(h.node('setup-notice').hidden,true);assert.equal(h.node('auth-fields').disabled,false);
  await h.click('signup-tab');h.node('auth-email').value='sample@example.invalid';h.node('auth-password').value='A-fictional-password';h.node('signup-name').value='Demo Candidate';await h.submit('auth-form');assert.equal(h.calls.find(c=>c[0]==='signup')[1].options.emailRedirectTo,'https://www.idea2proj.com/demos/recruitment/candidate.html');assert.equal(h.node('auth-password').value,'');
  const user={id:'user-a',email:'sample@example.invalid',user_metadata:{full_name:'Demo Candidate'}};
  await h.event('SIGNED_IN',user);assert.equal(h.node('profile-area').hidden,false);assert.equal(h.node('cv-fields').disabled,true);
  for(const [id,key] of Object.entries({'full-name':'full_name','headline':'headline','profile-location':'location','phone':'phone','experience-years':'experience_years','profile-skills':'skills','summary':'summary'}))h.node(id).value=input[key];
  h.node('profile-consent').checked=true;await h.submit('profile-form');assert.equal(h.profiles.get('user-a').full_name,'Demo Candidate');assert.equal(h.node('cv-fields').disabled,false);
  h.node('cv-file').files=[new File(['%PDF-1.7 latest'],'latest.pdf',{type:'application/pdf'})];await h.submit('cv-form');assert.equal(h.files.size,1);assert.equal(h.calls.find(c=>c[0]==='upload')[1],'user-a/latest.pdf');assert.equal(h.node('download-cv').disabled,false);
  h.node('cv-file').files=[new File(['%PDF-1.7 replacement'],'cv.pdf',{type:'application/pdf'})];await h.submit('cv-form');assert.equal(h.files.size,1);assert.match(await h.files.get('user-a/latest.pdf').text(),/replacement/);
  await h.click('sign-out');await h.event('SIGNED_IN',user);
  assert.equal(h.node('full-name').value,'Demo Candidate');assert.equal(h.node('saved-cv').hidden,false);assert.equal(h.node('download-cv').disabled,false);assert.match(h.node('cv-status').textContent,/Saved CV/);
  h.setListError(true);await h.click('reload-details');assert.equal(h.node('cv-error').hidden,false);assert.match(h.node('cv-status').textContent,/could not be checked/);
  h.setListError(false);await h.click('reload-details');assert.equal(h.node('cv-error').hidden,true);assert.equal(h.node('download-cv').disabled,false);
  h.node('cv-file').files=[new File(['%PDF-1.7 automatically saved'],'auto.pdf',{type:'application/pdf'})];await h.change('cv-file');assert.match(await h.files.get('user-a/latest.pdf').text(),/automatically saved/);assert.match(h.node('cv-selection').textContent,/auto.pdf is saved/);
  await h.event('SIGNED_IN',{id:'user-b',email:'b@example.invalid',user_metadata:{}});assert.equal(h.node('full-name').value,'');assert.equal(h.node('download-cv').disabled,true);assert.equal(h.node('cv-fields').disabled,true);
  await h.event('PASSWORD_RECOVERY',user);assert.equal(h.node('recovery-area').hidden,false);assert.equal(h.node('profile-area').hidden,true);h.node('new-password').value='New-fictional-password';await h.submit('recovery-form');assert.equal(h.node('recovery-area').hidden,true);
  await h.click('remove-profile');assert.equal(h.profiles.has('user-a'),false);assert.equal(h.files.has('user-a/latest.pdf'),false);
  await h.click('sign-out');assert.equal(h.node('profile-area').hidden,true);assert.equal(h.node('account-email').textContent,'');
  assert.doesNotMatch(fs.readFileSync(path.join(root,'candidate.js'),'utf8'),/localStorage|talentflow_sample/);
  console.log('PASS: configuration gating, secret-key rejection, profile validation, PDF checks, signup, password reset, session isolation, private upload/replacement, deletion and sign-out (mock Supabase adapter)');
})().catch(error=>{console.error(error);process.exitCode=1});
