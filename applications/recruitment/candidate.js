(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const core = window.CandidateCore;
  let client = null, user = null, profile = null, cvExists = false, busy = false, loading = false, mode = 'login', recovering = false, revision = 0;
  const redirectTo = new URL('candidate.html', window.location.href).href.split('#')[0].split('?')[0];
  const columns = 'id,full_name,headline,location,phone,experience_years,skills,summary,consent_version,updated_at';
  function status(message, error = false) {
    $('status').textContent = message;
    $('status').classList.toggle('error', error);
    $('status').hidden = !message;
  }
  function permissions() {
    $('auth-fields').disabled = !client || busy;
    $('forgot-password').disabled = !client || busy;
    $('profile-fields').disabled = !user || busy || loading;
    $('cv-fields').disabled = !user || !profile || busy || loading;
    $('download-cv').disabled = !cvExists || busy;
    $('remove-cv').disabled = !cvExists || busy;
    $('remove-profile').disabled = !profile || busy;
    $('sign-out').disabled = busy;
    $('reload-details').disabled = !user || busy || loading;
    document.querySelectorAll('[data-mode]').forEach(b => b.disabled = busy);
  }
  function setMode(next) {
    mode = next;
    const signup = mode === 'signup', forgot = mode === 'forgot';
    $('signup-name-field').hidden = !signup;
    $('signup-name').required = signup;
    $('password-field').hidden = forgot;
    $('auth-password').required = !forgot;
    $('auth-password').autocomplete = signup ? 'new-password' : 'current-password';
    $('auth-password').value = '';
    $('auth-title').textContent = signup ? 'Create your candidate account.' : forgot ? 'Reset your password.' : 'Welcome back.';
    $('auth-description').textContent = signup ? 'Verify your email, then build your profile.' : forgot ? 'We’ll send a password reset link to your email.' : 'Sign in to update your profile and latest CV.';
    $('auth-submit').textContent = signup ? 'Create account →' : forgot ? 'Send reset link →' : 'Sign in →';
    $('auth-panel').setAttribute('aria-labelledby', signup ? 'signup-tab' : 'login-tab');
    document.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.mode === mode)));
    status('');
  }
  async function action(work) {
    if (!client || busy) return;
    busy = true; permissions(); status('');
    try { await work(); }
    catch (error) { status(error.message || 'Something went wrong. Please try again.', true); if ($('cv-selection').textContent?.startsWith('Uploading ')) $('cv-selection').textContent = 'Upload did not complete. Your previously saved CV, if any, has not been removed.'; }
    finally { busy = false; permissions(); }
  }
  function checked(result, message) {
    if (result.error) throw Error(message);
    return result.data;
  }
  function clearPrivateFields() {
    $('profile-form').reset(); $('cv-form').reset(); $('account-email').textContent = '';
    $('cv-status').textContent = 'Save your profile before uploading a CV.';
    profile = null; cvExists = false;
    $('saved-cv').hidden = true;
    $('cv-selection').textContent = '';
  }
  async function refreshCV(expectedRevision = revision) {
    const currentUser = user;
    const files = checked(await client.storage.from('candidate-cvs').list(currentUser.id, {limit:10,search:'latest.pdf'}), 'Unable to check your CV. Please try again.');
    if (expectedRevision !== revision || user?.id !== currentUser.id) return;
    const file = files.find(f => f.name === 'latest.pdf');
    cvExists = Boolean(file);
    $('cv-status').textContent = file ? 'Saved CV.pdf · Updated ' + new Date(file.updated_at).toLocaleString() + (file.metadata?.size ? ' · ' + Math.ceil(file.metadata.size / 1024) + ' KB' : '') + ' · Available after you sign in again.' : profile ? 'No saved CV yet. Choose a PDF below to upload it.' : 'Save your profile before uploading a CV.';
    $('saved-cv').hidden = !cvExists;
    $('cv-error').hidden = true;
    permissions();
  }
  async function handleSession(session, event) {
    const currentRevision = ++revision;
    if (event === 'PASSWORD_RECOVERY') recovering = true;
    user = session?.user || null;
    clearPrivateFields();
    $('auth-area').hidden = Boolean(user);
    $('profile-area').hidden = !user || recovering;
    $('recovery-area').hidden = !user || !recovering;
    if (!user) { recovering = false; loading = false; $('saved-cv').hidden = true; permissions(); return; }
    if (recovering) { permissions(); return; }
    const currentUser = user;
    loading = true; permissions();
    $('account-email').textContent = currentUser.email || '';
    try {
      const data = checked(await client.from('candidate_profiles').select(columns).eq('id', currentUser.id).maybeSingle(), 'Unable to load your profile. Please sign out and try again.');
      if (currentRevision !== revision || user?.id !== currentUser.id) return;
      profile = data;
      const values = data || {full_name:currentUser.user_metadata?.full_name || '', skills:[], experience_years:''};
      for (const [id,key] of Object.entries({'full-name':'full_name','headline':'headline','profile-location':'location','phone':'phone','experience-years':'experience_years','summary':'summary'})) $(id).value = values[key] ?? '';
      $('profile-skills').value = (values.skills || []).join(', ');
      $('profile-consent').checked = values.consent_version === '2026-10-v1';
    } catch (error) { if (currentRevision === revision) status(error.message, true); }
    // Check Storage independently: a profile fetch failure must not hide a saved CV.
    try { await refreshCV(currentRevision); }
    catch (error) { if (currentRevision === revision) { $('cv-status').textContent = 'Your saved CV could not be checked. Reload saved details to try again.'; $('cv-error').textContent = error.message; $('cv-error').hidden = false; } }
    finally { if (currentRevision === revision) { loading = false; permissions(); window.dispatchEvent?.(new Event('candidate-data-changed')); } }
  }
  document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
  $('forgot-password').addEventListener('click', () => setMode('forgot'));
  $('auth-form').addEventListener('submit', event => {
    event.preventDefault();
    action(async () => {
      const email = $('auth-email').value.trim(), password = $('auth-password').value;
      if (mode === 'forgot') {
        checked(await client.auth.resetPasswordForEmail(email,{redirectTo}), 'We could not send the reset email. Please try again later.');
        status('If an account exists for this email, a password reset link will be sent.');
      } else if (mode === 'signup') {
        const data = checked(await client.auth.signUp({email,password,options:{emailRedirectTo:redirectTo,data:{full_name:$('signup-name').value.trim()}}}), 'We could not create the account. Check your details or try signing in.');
        status(data.session ? 'Account created. Complete your profile below.' : 'Check your inbox for a verification link, then return here to sign in.');
      } else {
        const data = checked(await client.auth.signInWithPassword({email,password}), 'Sign-in failed. Check your email and password, and confirm your email first.');
        if (data.session) await handleSession(data.session,'SIGNED_IN');
      }
      $('auth-password').value = '';
    });
  });
  $('recovery-form').addEventListener('submit', event => {
    event.preventDefault();
    action(async () => {
      checked(await client.auth.updateUser({password:$('new-password').value}), 'Unable to update your password. Request a fresh reset link and try again.');
      $('new-password').value = ''; recovering = false;
      const data = checked(await client.auth.getSession(), 'Please sign in again.');
      await handleSession(data.session,'SIGNED_IN'); status('Password updated.');
    });
  });
  $('profile-form').addEventListener('submit', event => {
    event.preventDefault();
    action(async () => {
      if (!user) throw Error('Please sign in first.');
      const payload = core.profilePayload(user.id,{full_name:$('full-name').value,headline:$('headline').value,location:$('profile-location').value,phone:$('phone').value,experience_years:$('experience-years').value,skills:$('profile-skills').value,summary:$('summary').value,consent:$('profile-consent').checked});
      profile = checked(await client.from('candidate_profiles').upsert(payload,{onConflict:'id'}).select(columns).single(), 'Unable to save your profile. Please try again.');
      status('Profile saved. You can now upload your latest CV.');
      await refreshCV();
      window.dispatchEvent?.(new Event('candidate-data-changed'));
    });
  });
  function uploadCV() {
    action(async () => {
      if (!user || !profile) throw Error('Save your profile before uploading a CV.');
      const file = $('cv-file').files[0]; await core.validateCV(file);
      $('cv-selection').textContent = 'Uploading ' + file.name + '… Please keep this page open.';
      checked(await client.storage.from('candidate-cvs').upload(user.id + '/latest.pdf',file,{contentType:'application/pdf',upsert:true,cacheControl:'0'}), 'CV upload could not be confirmed. Reload this page to check your latest CV, then try again if needed.');
      await refreshCV();
      if (!cvExists) throw Error('The upload was not visible in saved storage. Please try again before applying.');
      $('cv-form').reset(); $('cv-selection').textContent = file.name + ' is saved privately.';
      status('Your latest CV has been uploaded privately. It will remain available after you sign in again.');
      window.dispatchEvent?.(new Event('candidate-data-changed'));
    });
  }
  $('cv-form').addEventListener('submit', event => { event.preventDefault(); uploadCV(); });
  $('cv-file').addEventListener('change', () => { if ($('cv-file').files[0]) uploadCV(); });
  $('reload-details').addEventListener('click', () => action(async () => {
    const data = checked(await client.auth.getSession(), 'Please sign in again.');
    await handleSession(data.session,'RELOAD');
  }));
  $('download-cv').addEventListener('click', () => action(async () => {
    if (!user || !cvExists) throw Error('No CV is available.');
    const blob = checked(await client.storage.from('candidate-cvs').download(user.id + '/latest.pdf'), 'Unable to download your CV. Please try again.');
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = 'Latest-CV.pdf'; document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }));
  $('remove-cv').addEventListener('click', () => action(async () => {
    if (!user || !cvExists || !confirm('Remove your latest CV from the recruiting workspace?')) return;
    checked(await client.storage.from('candidate-cvs').remove([user.id + '/latest.pdf']), 'Unable to remove your CV. Please try again.');
    await refreshCV(); status('Your CV has been removed.'); window.dispatchEvent?.(new Event('candidate-data-changed'));
  }));
  $('remove-profile').addEventListener('click', () => action(async () => {
    if (!user || !profile || !confirm('Remove your candidate profile, current CV and submitted applications? Your login account will remain.')) return;
    checked(await client.storage.from('candidate-cvs').remove([user.id + '/latest.pdf']), 'Unable to remove your CV. Your profile has not been removed.');
    const removed = checked(await client.from('candidate_profiles').delete().eq('id',user.id).select('id'), 'Unable to remove your profile. Please try again.');
    if (!removed.length) throw Error('Your profile could not be removed. Please reload and try again.');
    clearPrivateFields(); $('full-name').value = user.user_metadata?.full_name || '';
    status('Your profile and CV have been removed. Your login account remains available.');
  }));
  $('sign-out').addEventListener('click', () => action(async () => {
    checked(await client.auth.signOut({scope:'local'}), 'Sign-out failed. Please try again.');
    await handleSession(null,'SIGNED_OUT'); status('You are signed out.');
  }));
  if (!core.configReady(window.TALENTFLOW_CONFIG) || !window.supabase) { permissions(); return; }
  try {
    client = window.supabase.createClient(window.TALENTFLOW_CONFIG.supabaseUrl,window.TALENTFLOW_CONFIG.supabasePublishableKey,{
      auth:{storage:window.sessionStorage,storageKey:'talentflow-candidate-auth',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'implicit'}
    });
    window.TalentFlowCandidate = {client,getSnapshot:()=>({userId:user?.id,profileSaved:Boolean(profile),cvSaved:cvExists,loading})};
    $('setup-notice').hidden = true; permissions();
    // Keep Supabase calls outside the synchronous auth callback to avoid its auth lock.
    client.auth.onAuthStateChange((event,session) => {
      if (event === 'TOKEN_REFRESHED' && session?.user?.id === user?.id) return;
      if (event === 'SIGNED_IN' && session?.user?.id === user?.id && !recovering) return;
      setTimeout(() => { if (event === 'SIGNED_IN' && session?.user?.id === user?.id && !recovering) return; void handleSession(session,event); },0);
    });
  } catch {
    client = null; permissions();
    $('setup-notice').textContent = 'Candidate sign-in is temporarily unavailable. Please contact Idea 2 Project or try again later.';
    $('setup-notice').hidden = false;
  }
})();
