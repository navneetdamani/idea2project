(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const client = window.TalentFlowCandidate?.client;
  if (!client) return;
  let user = null, revision = 0, busy = false, jobs = [];
  let dashboardInitialized=false;
  const escape=value=>String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const statusNames={submitted:'Submitted',in_review:'In review',closed:'Closed',rejected:'Rejected'};
  function resetDashboard(){for(const id of ['application-total','application-reviewing','application-closed','application-rejected'])$(id).textContent='0';$('submission-confirmation').hidden=true;dashboardInitialized=false;}
  const desired = new URL(window.location.href).searchParams.get('job');
  const requestedApplication = new URL(window.location.href).searchParams.get('application');
  if (/^I2P-\d{8}-\d{2}$/.test(desired || '')) {
    try { sessionStorage.setItem('talentflow-selected-job', desired); } catch {}
  }
  const message = (text, error = false) => { $('application-status').textContent=text; $('application-status').classList.toggle('error',error); };
  function gates() {
    const state=window.TalentFlowCandidate.getSnapshot?.();
    const ready=!state || (state.userId===user?.id && state.profileSaved && state.cvSaved && !state.loading);
    $('application-fields').disabled = !user || !jobs.length || busy || !ready;
    $('application-readiness').textContent = !user ? 'Sign in to apply.' : !ready ? 'Save your profile and wait for your CV to show as saved above. The application form will then be enabled.' : 'Your profile and saved CV are ready. Complete the form below to submit an application.';
    $('refresh-applications').disabled = !user || busy;
    $('dashboard-readiness').textContent=!user?'Sign in to view your applications.':!state||state.loading?'Checking your saved profile and CV...':state.profileSaved&&state.cvSaved?'Your profile and CV are saved. You are ready to apply.':'Complete your profile and save a PDF CV before applying.';
  }
  function checked(result, error) { if(result.error) throw Error(error); return result.data; }
  async function refresh(session) {
    const current = ++revision; user=session?.user || null; jobs=[]; gates();
    $('application-form').reset(); $('my-applications').replaceChildren(); $('application-job').replaceChildren(); message('');
    resetDashboard();
    if (!user) return;
    try {
      const data=checked(await client.from('published_jobs').select('id,title').eq('is_open',true).order('id'), 'Applications are temporarily unavailable. Please try again later.');
      if(current!==revision)return;
      jobs=data;
      const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='Choose an open role';$('application-job').append(placeholder);
      for(const job of jobs) { const option=document.createElement('option'); option.value=job.id; option.textContent=job.title; $('application-job').append(option); }
      let preferred=desired; try { preferred=preferred || sessionStorage.getItem('talentflow-selected-job'); } catch {}
      if(jobs.some(j=>j.id===preferred)) $('application-job').value=preferred;
      else if(desired)message('The linked role is no longer accepting applications. Please choose another open role below.',true);
      await history(current);
    } catch(error) { if(current===revision)message(error.message,true); }
    finally { if(current===revision)gates(); }
  }
  async function history(current=revision,dispatch=true) {
    const data=checked(await client.from('job_applications').select('id,job_id,submitted_at,status,review_updated_at,published_jobs(title,is_open),job_application_receipts(state,sent_at,recruiter_state)').eq('candidate_id',user.id).order('submitted_at',{ascending:false}), 'Unable to load your applications. Please reload before submitting again.');
    if(current!==revision)return;
    $('my-applications').replaceChildren();
    $('application-total').textContent=String(data.length);
    $('application-reviewing').textContent=String(data.filter(a=>a.status==='in_review').length);
    $('application-closed').textContent=String(data.filter(a=>a.status==='closed').length);
    $('application-rejected').textContent=String(data.filter(a=>a.status==='rejected').length);
    if(!dashboardInitialized){$('profile-editor').open=!data.length;dashboardInitialized=true;}
    for(const application of data) {
      const item=document.createElement('li');
      item.className='application-record';
      item.id='application-'+application.id;
      if(application.id===requestedApplication){item.style && (item.style.outline='2px solid #f26a21');item.setAttribute?.('aria-current','true');}
      const receipt=Array.isArray(application.job_application_receipts)?application.job_application_receipts[0]:application.job_application_receipts;
      const relatedJob=Array.isArray(application.published_jobs)?application.published_jobs[0]:application.published_jobs;
      const title=relatedJob?.title||jobs.find(j=>j.id===application.job_id)?.title||application.job_id;
      const labels={pending:'Confirmation email queued',sending:'Sending confirmation email',sent:'Confirmation email sent',failed:'Confirmation email failed — your application is saved. Refresh to retry.'};
      const next={submitted:'Your application is saved and awaiting recruitment review. We will contact you if there is a suitable next step.',in_review:'The recruitment team is reviewing your application. Keep your profile and latest CV current.',rejected:'Your application was not selected for this role. You can explore other open opportunities.',closed:'Review of this application has ended. You can explore other open opportunities.'};
      item.innerHTML='<div class="record-heading"><div><p class="section-label">Application</p><h3>'+escape(title)+'</h3></div><span class="status-pill '+escape(application.status)+'">'+escape(statusNames[application.status]||application.status)+'</span></div><p class="muted">Submitted '+escape(new Date(application.submitted_at).toLocaleDateString())+(application.review_updated_at?' · Status updated '+escape(new Date(application.review_updated_at).toLocaleDateString()):'')+'</p><p>'+escape(next[application.status]||'Your application is saved.')+'</p><p class="receipt-line" id="receipt-'+escape(application.id)+'">'+escape(labels[receipt?.state]||labels.pending)+'</p><p class="reference">Reference <span>'+escape(application.id)+'</span></p>';
      $('my-applications').append(item);
      if(dispatch && client.functions && (!receipt || ['pending','failed','sending'].includes(receipt.state) || receipt.recruiter_state!=='sent') && data.indexOf(application)<3) {
        void client.functions.invoke('application-receipt',{body:{application_id:application.id}}).then(result=>{
          if(current!==revision)return;
          $('receipt-'+application.id).textContent=labels[result.data?.state]||labels[receipt?.state]||'Confirmation email pending. Your application is saved; refresh to check again.';
        }).catch(()=>{if(current===revision)$('receipt-'+application.id).textContent='Confirmation email pending. Your application is saved.';});
      }
    }
    if(!data.length) $('my-applications').innerHTML='<li class="empty-state"><h3>Your next opportunity starts here.</h3><p>No applications submitted yet. Choose an open role below after saving your profile and CV.</p></li>';
    if(requestedApplication && !data.some(a=>a.id===requestedApplication))message('This application is not available in this account. Sign in with the email address you used to apply.',true);
    if(requestedApplication)$('my-applications').scrollIntoView?.({block:'start'});
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
      const confirmation='Application submitted. Reference: '+result.data.id+'. A confirmation email has been queued. You can check its delivery status under My applications.';
      message(confirmation);
      $('submission-confirmation').hidden=false;$('submission-reference').textContent=result.data.id;
      $('profile-editor').open=false;
      $('application-statement').value=''; $('application-consent').checked=false;
      try { await history(current); }
      catch { message(confirmation+' Application history could not be refreshed. Your submission remains saved.'); }
      $('candidate-dashboard').scrollIntoView?.({block:'start',behavior:'smooth'});
      setTimeout(()=>{if(current===revision && user)void history(current,false).catch(()=>{});},4000);
    } catch(error) { if(current===revision)message(error.message,true); }
    finally { busy=false; gates(); }
  });
  $('refresh-applications').addEventListener('click',()=>{if(user)void history().catch(error=>message(error.message,true));});
  window.addEventListener?.('candidate-data-changed',()=>{gates();if(user)void history().catch(error=>message(error.message,true));});
  client.auth.onAuthStateChange((event,session)=>{
    if((event==='TOKEN_REFRESHED' || event==='SIGNED_IN') && session?.user?.id===user?.id)return;
    setTimeout(()=>{void refresh(session);},0);
  });
})();
