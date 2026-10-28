(function(){
  'use strict';
  const $=id=>document.getElementById(id),id=new URL(location.href).searchParams.get('application');
  const status=text=>$('review-status').textContent=text;
  const checked=(result,message)=>{if(result.error)throw Error(message);return result.data;};
  if(!window.CandidateCore?.configReady(window.TALENTFLOW_CONFIG)||!window.supabase){status('Recruiter sign-in is unavailable. Please try again later.');return;}
  const client=window.supabase.createClient(window.TALENTFLOW_CONFIG.supabaseUrl,window.TALENTFLOW_CONFIG.supabasePublishableKey,{auth:{storage:window.sessionStorage,storageKey:'talentflow-candidate-auth',persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
  let revision=0,candidateId=null;
  function clear(){candidateId=null;$('review-detail').hidden=true;for(const name of ['role','reference','state','name','headline','skills','summary','availability','statement'])$('review-'+name).textContent='';}
  async function load(session){
    const current=++revision;clear();$('review-login').hidden=!!session;$('review-session').hidden=!session;$('review-login-fields').disabled=false;
    if(!session){status('Sign in with an authorized recruiter account.');return;}
    try{
      status('Checking recruiter access...');
      const allowed=checked(await client.rpc('is_recruiter'),'Unable to verify recruiter access.');
      if(current!==revision)return;
      if(!allowed)throw Error('This account does not have recruiter access. Sign out and use an authorized recruiter account.');
      if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id||''))throw Error('Open a valid application link from the recruitment notification email.');
      const app=checked(await client.from('job_applications').select('id,candidate_id,job_id,status,submitted_at,availability_days,statement').eq('id',id).maybeSingle(),'Unable to load the application.');
      if(current!==revision)return;
      if(!app)throw Error('Application not found. The candidate may have removed their profile.');
      const profile=checked(await client.from('candidate_profiles').select('full_name,headline,location,experience_years,skills,summary').eq('id',app.candidate_id).single(),'Unable to load the candidate profile.');
      const job=checked(await client.from('published_jobs').select('title').eq('id',app.job_id).maybeSingle(),'Unable to load the role.');
      if(current!==revision)return;
      candidateId=app.candidate_id;
      $('review-all').href='admin.html?job='+encodeURIComponent(app.job_id);
      $('review-role').textContent=job?.title||app.job_id;
      $('review-reference').textContent='Reference '+app.id+' | Submitted '+new Date(app.submitted_at).toLocaleString();
      $('review-state').textContent='Current status: '+({submitted:'Submitted',in_review:'In review',closed:'Closed'}[app.status]||app.status);
      $('review-name').textContent=profile.full_name;
      $('review-headline').textContent=[profile.headline,profile.location,profile.experience_years+' years of experience'].filter(Boolean).join(' | ');
      $('review-skills').textContent=profile.skills.join(', ');$('review-summary').textContent=profile.summary;
      $('review-availability').textContent='Available to start in '+app.availability_days+' days.';$('review-statement').textContent=app.statement;
      $('review-detail').hidden=false;status('Application loaded. Profile and CV reflect the candidate\'s latest saved version.');
    }catch(error){if(current===revision){clear();status(error.message);}}
  }
  $('review-login-form').addEventListener('submit',async event=>{
    event.preventDefault();$('review-login-fields').disabled=true;
    try{const data=checked(await client.auth.signInWithPassword({email:$('review-email').value.trim(),password:$('review-password').value}),'Sign-in failed. Check your email and password.');$('review-password').value='';await load(data.session);}
    catch(error){status(error.message);}finally{$('review-login-fields').disabled=false;}
  });
  $('review-refresh').addEventListener('click',async()=>{try{const data=checked(await client.auth.getSession(),'Please sign in again.');await load(data.session);}catch(error){status(error.message);}});
  $('review-signout').addEventListener('click',async()=>{try{checked(await client.auth.signOut({scope:'local'}),'Unable to sign out.');await load(null);}catch(error){status(error.message);}});
  $('review-cv').addEventListener('click',async()=>{
    if(!candidateId)return;const current=revision;$('review-cv').disabled=true;
    try{const blob=checked(await client.storage.from('candidate-cvs').download(candidateId+'/latest.pdf'),'No CV is available. The candidate may have removed it.');if(current!==revision)return;const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Candidate-CV.pdf';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}catch(error){if(current===revision)status(error.message);}finally{$('review-cv').disabled=false;}
  });
  client.auth.onAuthStateChange((event,session)=>{if(event==='TOKEN_REFRESHED')return;setTimeout(()=>{void load(session);},0);});
})();
