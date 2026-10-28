(function(){
  'use strict';
  const $=id=>document.getElementById(id),params=new URL(location.href).searchParams;
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const names={submitted:'Submitted',in_review:'In review',closed:'Closed'};
  const checked=(result,message)=>{if(result.error)throw Error(result.error.code==='40001'?'This application changed. Refresh before updating its status.':message);return result.data;};
  const message=(text,error=false)=>{$('admin-message').textContent=text;$('admin-message').classList.toggle('error',error);};
  if(!window.CandidateCore?.configReady(window.TALENTFLOW_CONFIG)||!window.supabase){message('Recruiter sign-in is temporarily unavailable.',true);return;}
  const client=window.supabase.createClient(window.TALENTFLOW_CONFIG.supabaseUrl,window.TALENTFLOW_CONFIG.supabasePublishableKey,{auth:{storage:window.sessionStorage,storageKey:'talentflow-candidate-auth',persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
  let revision=0,listRevision=0,sessionUser=null,authorized=false,jobs=[],rows=[],selected=null,offset=0,total=0,busy=false;
  const pageSize=50;
  function controls(){for(const id of ['admin-job','admin-filter-status','admin-search','admin-refresh','admin-save-status'])$(id).disabled=busy||!authorized;$('admin-previous').disabled=busy||!authorized||offset===0;$('admin-next').disabled=busy||!authorized||offset+pageSize>=total;}
  function clearDetail(){selected=null;$('admin-detail').hidden=true;for(const key of ['name','headline','facts','phone','skills','summary','statement','availability','reference'])$('admin-candidate-'+key).textContent='';}
  function clear(){++listRevision;jobs=[];rows=[];offset=0;total=0;authorized=false;clearDetail();$('admin-applicants').replaceChildren();$('admin-job').replaceChildren();$('admin-jd').replaceChildren();$('admin-result-count').textContent='';$('admin-page').textContent='';$('admin-identity').textContent='';for(const id of ['admin-total','admin-new','admin-reviewing'])$(id).textContent='0';$('admin-authorized').hidden=true;controls();}
  function jobView(){
    const job=jobs.find(j=>j.id===$('admin-job').value);if(!job)return;
    $('admin-total').textContent=String(job.total);$('admin-new').textContent=String(job.submitted);$('admin-reviewing').textContent=String(job.in_review);
    const jd=window.TalentFlowOpenings?.find(j=>j.id===job.id);
    $('admin-jd').innerHTML='<h3>'+escape(job.title)+'</h3><p>'+escape(job.is_open?'Open for applications':'Retired from new applications')+'</p>'+(jd?'<p>'+escape(jd.summary)+'</p><p><strong>Location:</strong> '+escape(jd.location)+'</p><p><strong>Experience:</strong> '+escape(jd.experience)+'</p><p>'+jd.skills.map(s=>'<span class="skill">'+escape(s)+'</span>').join('')+'</p><p>'+escape(jd.detail)+'</p>':'<p class="muted">This is an archived role. Existing applications remain available for review.</p>')+'<p class="reference">Job reference '+escape(job.id)+'</p>';
  }
  async function summary(current){
    const value=$('admin-job').value;
    const data=checked(await client.rpc('recruiter_job_summary'),'Unable to load jobs and applicant counts.');if(current!==revision)return;
    jobs=data||[];$('admin-job').replaceChildren();
    for(const job of jobs){const option=document.createElement('option');option.value=job.id;option.textContent=job.title+' ('+job.total+' applicants)'+(job.is_open?'':' - retired');$('admin-job').append(option);}
    if(jobs.some(j=>j.id===value))$('admin-job').value=value;
    else if(jobs[0])$('admin-job').value=jobs[0].id;
    jobView();
  }
  function choose(app){
    selected=app;const p=app.profile||{};
    $('admin-candidate-name').textContent=p.full_name||'Candidate';$('admin-candidate-headline').textContent=p.headline||'';
    $('admin-candidate-facts').textContent=[p.location,p.experience_years!==undefined?p.experience_years+' years of experience':''].filter(Boolean).join(' | ');
    $('admin-candidate-phone').textContent=p.phone?'Phone: '+p.phone:'Phone not provided';$('admin-candidate-skills').textContent=(p.skills||[]).join(', ');
    $('admin-candidate-summary').textContent=p.summary||'No profile summary provided.';$('admin-candidate-statement').textContent=app.statement;
    $('admin-candidate-availability').textContent='Available to start in '+app.availability_days+' days.';
    $('admin-candidate-reference').textContent='Submitted '+new Date(app.submitted_at).toLocaleString()+' | Reference '+app.id;
    $('admin-review-status').value=app.status;$('admin-detail').hidden=false;
    for(const row of rows)$('applicant-'+row.id)?.setAttribute('aria-current',String(row.id===app.id));
  }
  async function page(current=revision){
    const request=++listRevision;rows=[];clearDetail();$('admin-applicants').replaceChildren();$('admin-result-count').textContent='Loading applicants...';busy=true;controls();jobView();
    try{
      if(!$('admin-job').value){$('admin-result-count').textContent='No jobs are available.';return;}
      const result=checked(await client.rpc('recruiter_job_applicants',{p_job:$('admin-job').value,p_status:$('admin-filter-status').value,p_search:$('admin-search').value.trim(),p_limit:pageSize,p_offset:offset}),'Unable to load applicants. Please refresh.');
      if(current!==revision||request!==listRevision)return;
      rows=result.items||[];total=Number(result.total)||0;
      $('admin-result-count').textContent=total+' matching applicant'+(total===1?'':'s');
      $('admin-page').textContent=total?'Showing '+(offset+1)+'-'+(offset+rows.length)+' of '+total:'No results';
      for(const app of rows){const li=document.createElement('li');li.id='applicant-'+app.id;li.className='applicant-card';
        li.innerHTML='<div class="record-heading"><h3>'+escape(app.profile?.full_name||'Candidate')+'</h3><span class="status-pill '+escape(app.status)+'">'+escape(names[app.status]||app.status)+'</span></div><p>'+escape(app.profile?.headline||'')+'</p><p class="muted">'+escape(app.profile?.location||'Location not provided')+' | '+escape(app.profile?.experience_years??'Not provided')+' years of experience</p><p class="tiny">'+escape((app.profile?.skills||[]).join(', '))+'</p><p class="tiny muted">Submitted '+escape(new Date(app.submitted_at).toLocaleDateString())+' | Available in '+escape(app.availability_days)+' days</p>';
        const button=document.createElement('button');button.type='button';button.textContent='Review application';button.addEventListener('click',()=>choose(app));li.append(button);$('admin-applicants').append(li);
      }
      if(!rows.length)$('admin-applicants').innerHTML='<li class="empty-state"><h3>No applicants match these filters.</h3><p>Choose another job or clear the search and status filters.</p></li>';
    }catch(error){if(current===revision&&request===listRevision){total=0;$('admin-page').textContent='';$('admin-result-count').textContent='Applicants could not be loaded.';message(error.message,true);}}
    finally{if(current===revision&&request===listRevision){busy=false;controls();}}
  }
  async function load(session){
    const current=++revision;clear();sessionUser=session?.user||null;$('admin-login').hidden=!!sessionUser;$('admin-session').hidden=!sessionUser;$('admin-login-fields').disabled=false;
    if(!sessionUser){message('Sign in with an approved recruiter account.');return;}
    try{
      message('Verifying recruiter access...');const allowed=checked(await client.rpc('is_recruiter'),'Unable to verify recruiter access.');if(current!==revision)return;
      if(!allowed)throw Error('This account does not have recruiter access. Use an approved recruiter account.');
      authorized=true;$('admin-authorized').hidden=false;$('admin-identity').textContent=sessionUser.email;await summary(current);if(current!==revision)return;
      let requested=null;const reference=params.get('application');
      if(reference&&/^[a-f0-9-]{36}$/i.test(reference)){
        const app=checked(await client.from('job_applications').select('id,candidate_id,job_id,status,submitted_at,availability_days,statement,candidate_profiles(full_name,headline,location,phone,experience_years,skills,summary)').eq('id',reference).maybeSingle(),'Unable to open the requested application.');
        if(current!==revision)return;if(app){requested={...app,profile:app.candidate_profiles};$('admin-job').value=app.job_id;}
      }else if(jobs.some(j=>j.id===params.get('job')))$('admin-job').value=params.get('job');
      await page(current);if(current!==revision)return;if(requested)choose(requested);
      message('Choose a job and select an applicant to review their profile and CV.');
    }catch(error){if(current===revision){clear();message(error.message,true);}}
  }
  $('admin-login-form').addEventListener('submit',async event=>{event.preventDefault();$('admin-login-fields').disabled=true;try{const data=checked(await client.auth.signInWithPassword({email:$('admin-email').value.trim(),password:$('admin-password').value}),'Sign-in failed. Check your email and password.');$('admin-password').value='';await load(data.session);}catch(error){message(error.message,true);}finally{$('admin-login-fields').disabled=false;}});
  $('admin-signout').addEventListener('click',async()=>{try{checked(await client.auth.signOut({scope:'local'}),'Unable to sign out.');await load(null);}catch(error){message(error.message,true);}});
  $('admin-filters').addEventListener('submit',event=>{event.preventDefault();if(authorized&&!busy){offset=0;void page();}});
  $('admin-job').addEventListener('change',()=>{if(authorized&&!busy){offset=0;void page();}});
  $('admin-previous').addEventListener('click',()=>{if(authorized&&!busy&&offset){offset=Math.max(0,offset-pageSize);void page();}});
  $('admin-next').addEventListener('click',()=>{if(authorized&&!busy&&offset+pageSize<total){offset+=pageSize;void page();}});
  $('admin-refresh').addEventListener('click',async()=>{if(!authorized||busy)return;const current=revision;busy=true;controls();try{await summary(current);if(current===revision){offset=0;await page(current);}}catch(error){if(current===revision)message(error.message,true);}finally{if(current===revision){busy=false;controls();}}});
  $('admin-status-form').addEventListener('submit',async event=>{
    event.preventDefault();if(!authorized||!selected||busy)return;const current=revision,app=selected,next=$('admin-review-status').value;
    if(next===app.status){message('Choose a different review status.');return;}
    busy=true;controls();
    try{checked(await client.rpc('set_application_review_status',{p_application:app.id,p_status:next,p_expected:app.status}),'Unable to save review status. Refresh and try again.');if(current!==revision)return;await summary(current);if(current!==revision)return;offset=0;await page(current);if(current!==revision)return;const updated=rows.find(a=>a.id===app.id);if(updated)choose(updated);message('Review status saved. The candidate can see the update in their dashboard.');}
    catch(error){if(current===revision)message(error.message,true);}finally{if(current===revision){busy=false;controls();}}
  });
  $('admin-download-cv').addEventListener('click',async()=>{
    if(!authorized||!selected)return;const current=revision,app=selected;$('admin-download-cv').disabled=true;
    try{const blob=checked(await client.storage.from('candidate-cvs').download(app.candidate_id+'/latest.pdf'),'The latest CV is unavailable. The candidate may have removed it.');if(current!==revision||selected?.id!==app.id)return;const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Candidate-CV.pdf';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}catch(error){if(current===revision)message(error.message,true);}finally{$('admin-download-cv').disabled=false;}
  });
  client.auth.onAuthStateChange((event,session)=>{if(event==='TOKEN_REFRESHED'||event==='SIGNED_IN'&&session?.user?.id===sessionUser?.id)return;setTimeout(()=>{void load(session);},0);});
})();
