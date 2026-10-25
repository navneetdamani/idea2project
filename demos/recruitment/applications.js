(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const client = window.TalentFlowCandidate?.client;
  if (!client) return;
  let user = null, revision = 0, busy = false, jobs = [];
  const desired = new URL(window.location.href).searchParams.get('job');
  if (/^I2P-\d{8}-\d{2}$/.test(desired || '')) {
    try { sessionStorage.setItem('talentflow-selected-job', desired); } catch {}
  }
  const message = (text, error = false) => { $('application-status').textContent=text; $('application-status').classList.toggle('error',error); };
  function gates() { $('application-fields').disabled = !user || !jobs.length || busy; }
  function checked(result, error) { if(result.error) throw Error(error); return result.data; }
  async function refresh(session) {
    const current = ++revision; user=session?.user || null; jobs=[]; gates();
    $('application-form').reset(); $('my-applications').replaceChildren(); $('application-job').replaceChildren(); message('');
    if (!user) return;
    try {
      const data=checked(await client.from('published_jobs').select('id,title').eq('is_open',true).order('id'), 'Applications are temporarily unavailable. Please try again later.');
      if(current!==revision)return;
      jobs=data;
      for(const job of jobs) { const option=document.createElement('option'); option.value=job.id; option.textContent=job.title; $('application-job').append(option); }
      let preferred=desired; try { preferred=preferred || sessionStorage.getItem('talentflow-selected-job'); } catch {}
      if(jobs.some(j=>j.id===preferred)) $('application-job').value=preferred;
      await history(current);
    } catch(error) { if(current===revision)message(error.message,true); }
    finally { if(current===revision)gates(); }
  }
  async function history(current=revision) {
    const data=checked(await client.from('job_applications').select('id,job_id,submitted_at,status').eq('candidate_id',user.id).order('submitted_at',{ascending:false}), 'Unable to load your applications. Please reload before submitting again.');
    if(current!==revision)return;
    $('my-applications').replaceChildren();
    for(const application of data) {
      const item=document.createElement('li');
      item.textContent=(jobs.find(j=>j.id===application.job_id)?.title || application.job_id)+' · '+application.status+' · '+new Date(application.submitted_at).toLocaleDateString()+' · Reference '+application.id;
      $('my-applications').append(item);
    }
    if(!data.length) $('my-applications').textContent='No applications submitted yet.';
  }
  $('application-form').addEventListener('submit',async event=>{
    event.preventDefault(); if(!user || busy)return;
    busy=true; gates(); const current=revision, candidate=user;
    try {
      const job=$('application-job').value, raw=$('availability-days').value.trim(), days=Number(raw), statement=$('application-statement').value.trim();
      if(!jobs.some(j=>j.id===job) || !raw || !Number.isInteger(days) || days<0 || days>365 || statement.length<20 || statement.length>4000 || !$('application-consent').checked) throw Error('Choose a role, enter availability from 0 to 365 days, add at least 20 characters about your experience, and confirm consent.');
      const profile=checked(await client.from('candidate_profiles').select('id').eq('id',candidate.id).maybeSingle(),'Unable to verify your profile. Please reload and try again.');
      if(!profile) throw Error('Save your candidate profile before applying.');
      const files=checked(await client.storage.from('candidate-cvs').list(candidate.id,{limit:10,search:'latest.pdf'}),'Unable to verify your CV. Please try again.');
      if(!files.some(file=>file.name==='latest.pdf'))throw Error('Upload your latest CV before applying.');
      if(current!==revision)return;
      const result=await client.from('job_applications').insert({candidate_id:candidate.id,job_id:job,availability_days:days,statement,consent_version:'2026-10-app-v1'}).select('id').single();
      if(current!==revision)return;
      if(result.error) {
        if(result.error.code==='23505') throw Error('You have already applied for this role. See My applications below.');
        throw Error('Submission could not be confirmed. Reload and check My applications before trying again; the role may have closed.');
      }
      message('Application submitted. Reference: '+result.data.id+'. The recruitment team can review it in the portal.');
      $('application-statement').value=''; $('application-consent').checked=false;
      await history(current);
    } catch(error) { if(current===revision)message(error.message,true); }
    finally { busy=false; gates(); }
  });
  client.auth.onAuthStateChange((event,session)=>{
    if((event==='TOKEN_REFRESHED' || event==='SIGNED_IN') && session?.user?.id===user?.id)return;
    setTimeout(()=>{void refresh(session);},0);
  });
})();
