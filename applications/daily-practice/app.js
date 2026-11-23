/* Browser-local plans, content-based question history, and resumable quizzes. */
(() => {
  'use strict';
  const E=PracticeEngine,C=PracticeCurriculum,Q=PracticeQuestions,KEY='idea2proj.daily-practice.v1';
  const app=document.querySelector('#app'),message=document.querySelector('#message');
  const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let state={plans:[],active:null},session=null,storageOK=true,snapshot=null,view='dashboard';
  const topics=p=>p.type==='custom'?p.topics:C[p.type].topics;
  const sequence=p=>E.schedule(topics(p),p.days,p.completions);
  const plan=()=>state.plans.find(p=>p.id===state.active)||state.plans[0];
  const human=key=>{const [y,m,d]=key.split('-').map(Number);return new Date(y,m-1,d,12).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});};
  function warn(text){const el=document.querySelector('#storage-warning');el.hidden=false;el.textContent=text;}
  function validPlan(p){
    if(!p||typeof p.id!=='string'||p.id.length>100||typeof p.learner!=='string'||!p.learner.trim()||p.learner.length>60||typeof p.name!=='string'||p.name.length>100||!['sat','rd2026','rd2027','custom'].includes(p.type)||!/^\d{4}-\d{2}-\d{2}$/.test(p.start)||E.addDays(p.start,0)!==p.start||!Number.isInteger(p.days)||p.days<1||p.days>730||!Array.isArray(p.completions))throw Error('Invalid saved plan.');
    const ts=E.validateTopics(topics(p));
    if(p.days<ts.length||p.completions.length>p.days)throw Error('Invalid plan length.');
    const validTopic=n=>Number.isInteger(n)&&n>=0&&n<ts.length;
    p.completions.forEach((c,i)=>{if(c.index!==i||!/^\d{4}-\d{2}-\d{2}$/.test(c.date)||E.addDays(c.date,0)!==c.date||c.date<p.start||(i&&c.date<p.completions[i-1].date)||!Number.isInteger(c.score)||c.score<0||!Number.isInteger(c.total)||c.total<1||c.total>6||c.score>c.total||(c.topic!==undefined&&!validTopic(c.topic))||(c.scheduledDate!==undefined&&(c.scheduledDate!==E.addDays(p.start,i)||c.scheduledDate>c.date)))throw Error('Invalid completion history.');});
    if(p.seen!==undefined&&(!Array.isArray(p.seen)||p.seen.length>30000||p.seen.some(x=>typeof x!=='string'||!/^[a-f0-9]{16}$/.test(x))))throw Error('Invalid question history.');
    if(p.attempts!==undefined&&(!Array.isArray(p.attempts)||p.attempts.length>30000||p.attempts.some(x=>!validTopic(x.topic)||typeof x.id!=='string'||typeof x.correct!=='boolean')))throw Error('Invalid quiz history.');
    if(p.draft){const d=p.draft;if(!['daily','catchup','practice'].includes(d.mode)||!validTopic(d.topic)||!Number.isInteger(d.index)||d.index<0||d.index>p.days||typeof d.date!=='string'||!Array.isArray(d.questions)||d.questions.length<2||d.questions.length>3||!Array.isArray(d.selected)||d.selected.length!==d.questions.length||typeof d.checked!=='boolean')throw Error('Invalid saved quiz.');
      E.validateTopics([{...ts[d.topic],questions:d.questions}]);
      if(d.questions.some((q,i)=>!validTopic(q.topic)||q.id!==Q.id(q)||(d.selected[i]!==null&&(!Number.isInteger(d.selected[i])||d.selected[i]<0||d.selected[i]>=q.options.length))))throw Error('Invalid saved quiz answer.');
      if(d.checked&&d.selected.some(x=>x===null))throw Error('Incomplete submitted quiz.');
    }
    return p;
  }
  function normalize(data){
    if(!data||!Array.isArray(data.plans)||data.plans.length>30)throw Error('Invalid saved data.');
    for(const p of data.plans){
      validPlan(p);const legacy=p.scheduleVersion!==2;
      E.migratePlan(p,topics(p));p.seen=p.seen||[];p.attempts=p.attempts||[];
      // The former app displayed both fixed questions. Do not reissue them as new.
      if(legacy)for(const c of p.completions)for(const q of topics(p)[c.topic].questions){const id=Q.id(q);if(!p.seen.includes(id))p.seen.push(id);}
    }
    if(new Set(data.plans.map(p=>p.id)).size!==data.plans.length)throw Error('Duplicate plan identifiers.');
    return data;
  }
  try{snapshot=localStorage.getItem(KEY);if(snapshot)state=normalize(JSON.parse(snapshot));}catch(error){storageOK=false;warn('Saved progress could not be read. This session will not overwrite it. Export new progress before closing this page.');}
  function save(){if(!storageOK)return;try{snapshot=JSON.stringify(state);localStorage.setItem(KEY,snapshot);}catch(error){storageOK=false;warn('Browser storage is unavailable or full. Progress is session-only. Export a backup before leaving.');}}
  function guard(){
    if(!storageOK)return true;
    try{const raw=localStorage.getItem(KEY);if(raw!==snapshot){state=raw?normalize(JSON.parse(raw)):{plans:[],active:null};snapshot=raw;session=null;dashboard();message.textContent='Progress changed in another tab. Your dashboard was refreshed; please resume from here.';return false;}}catch(error){warn('Could not check browser storage. Export a backup before leaving.');storageOK=false;}
    return true;
  }
  function download(name,data){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function focusHeading(){window.scrollTo({top:0,behavior:'instant'});const h=app.querySelector('h2');if(h){h.tabIndex=-1;h.focus();}}
  function setup(){
    view='setup';session=null;message.textContent='';
    app.innerHTML=`<div class="grid"><section class="panel"><p class="eyebrow">Your starting point</p><h2>One goal. A daily rhythm.</h2><form id="setup"><div class="field"><label for="learner">Learner name or nickname</label><input id="learner" required maxlength="60" autocomplete="off" placeholder="e.g. Maya"></div><div class="field"><label for="preset">What are you working toward?</label><select id="preset"><option value="sat">SAT · Grade 9 foundations · 365 days</option><option value="rd">Registered Dietitian (CDR) · 90 days</option><option value="custom">Custom exam or topic · your syllabus</option></select></div><div id="custom-fields" hidden><div class="field"><label for="goal">Exam or topic name</label><input id="goal" maxlength="100" placeholder="e.g. Biology finals"></div><div class="notice">Import lessons, examples, and 2–100 questions per topic as a JSON syllabus. Custom quizzes use unseen questions first; the app tells you when the supplied bank is exhausted.</div><button type="button" class="secondary" id="template">Download a sample syllabus</button><div class="field"><label for="syllabus-file">Custom syllabus (.json, up to 2 MB)</label><input type="file" id="syllabus-file" accept=".json,application/json"></div></div><div class="field"><label for="days">Plan duration (days)</label><input id="days" type="number" value="365" min="${C.sat.topics.length}" max="730" required></div><p id="outline-note" class="muted"></p><p id="setup-error" role="alert"></p><div class="actions"><button type="submit">Create my study sequence →</button>${state.plans.length?'<button type="button" class="secondary" id="cancel">Back to dashboard</button>':''}</div></form></section><aside class="panel dark"><p class="eyebrow">A complete route through your topics</p><h2>Learn.<br>Apply.<br>Move forward.</h2><ol class="steps"><li><b>Every topic gets a place</b><span>Introduce all core topics before spaced review begins.</span></li><li><b>Fresh questions, real feedback</b><span>Calculated math variants and applied cases. Questions already shown are tracked.</span></li><li><b>Review what needs attention</b><span>Earlier results guide review. Reloads keep unfinished quizzes intact.</span></li></ol><p>One learning cycle per day builds your streak. Extra practice is available whenever you want it.</p><small style="color:#c8ccd2">Introductory practice, not a full exam simulation or readiness assessment. Original items; no affiliation with College Board or CDR.</small></aside></div><div class="actions" style="margin-top:20px"><button id="restore" class="secondary">Restore a progress backup</button></div>`;
    const select=app.querySelector('#preset'),days=app.querySelector('#days');
    function note(){const type=select.value;app.querySelector('#custom-fields').hidden=type!=='custom';app.querySelector('#goal').required=type==='custom';days.min=type==='custom'?1:C[type==='rd'?'rd2027':'sat'].topics.length;const end=E.addDays(E.dayKey(),Number(days.value)-1);app.querySelector('#outline-note').textContent=type==='rd'?`Target finish: ${human(end)}. Uses the ${end<'2027-01-01'?'2022–2026':'2027–2031'} CDR outline. All ${days.min} core topics are introduced, then reviewed.`:type==='sat'?`All ${C.sat.topics.length} core topics across eight SAT domains, followed by spaced practice. Minimum ${days.min} days.`:'Every supplied topic receives an introduction. Additional days are spaced reviews.';}
    select.onchange=()=>{days.value=select.value==='sat'?365:90;note();};days.oninput=()=>{if(days.checkValidity())note();};note();
    app.querySelector('#template').onclick=()=>download('custom-syllabus-example.json',{topics:[{domain:'Your subject',title:'Your first topic',lesson:'Replace with your focused explanation, key details, and common mistakes.',example:'Add a worked example.',questions:[{prompt:'Replace with a question about your lesson.',options:['Correct answer','Incorrect answer','Another incorrect answer'],answer:0,explanation:'Explain the reasoning.'},{prompt:'Replace with an application question.',options:['Incorrect answer','Correct answer','Another incorrect answer'],answer:1,explanation:'Explain how the concept applies.'}]}]});
    app.querySelector('#setup').onsubmit=async event=>{event.preventDefault();const error=app.querySelector('#setup-error');error.textContent='';try{
      if(!guard())return;if(state.plans.length>=30)throw Error('This browser supports up to 30 plans.');
      const learner=app.querySelector('#learner').value.trim();if(!learner)throw Error('Enter a learner name or nickname.');
      let type=select.value,name=type==='sat'?'SAT foundations':'Registered Dietitian (CDR)',custom;
      const duration=Number(days.value),start=E.dayKey();
      if(type==='custom'){name=app.querySelector('#goal').value.trim();if(!name)throw Error('Enter the exam or topic name.');const file=app.querySelector('#syllabus-file').files[0];if(!file)throw Error('Choose a syllabus JSON file.');if(file.size>2e6)throw Error('Use a syllabus file smaller than 2 MB.');custom=E.validateTopics(JSON.parse(await file.text()).topics);}
      if(type==='rd')type=E.addDays(start,duration-1)<'2027-01-01'?'rd2026':'rd2027';
      if(!guard())return;E.schedule(custom||C[type].topics,duration);
      const p={id:crypto.randomUUID(),learner,name,type,start,days:duration,completions:[],seen:[],attempts:[],scheduleVersion:2,...(custom?{topics:custom}:{})};validPlan(p);state.plans.push(p);state.active=p.id;save();dashboard();focusHeading();
    }catch(err){error.textContent=err.message;}};
    app.querySelector('#cancel')?.addEventListener('click',dashboard);app.querySelector('#restore').onclick=restore;
  }
  function dashboard(){
    view='dashboard';session=null;message.textContent='';const p=plan();if(!p)return setup();
    const today=E.dayKey(),ts=topics(p),seq=sequence(p),n=p.completions.length,doneToday=p.completions.some(c=>c.date===today),finished=n===p.days;
    const entry=seq[Math.min(n,p.days-1)],t=ts[entry.topic],st=E.streak(p.completions,today),seen=new Set(p.completions.map(c=>c.topic));
    const original=E.addDays(p.start,p.days-1),estimated=E.addDays(today,Math.max(0,p.days-n-(doneToday?0:1))),scores=p.completions.reduce((a,c)=>({score:a.score+c.score,total:a.total+c.total}),{score:0,total:0});
    const clockBack=p.completions.some(c=>c.date>today),draft=p.draft&&(!finished||p.draft.mode==='practice');
    const dueDate=E.addDays(p.start,n),dueAvailable=dueDate<=today,upToDate=doneToday&&dueDate>today;
    app.innerHTML=`<div class="toolbar"><div class="field"><label for="active-plan">Your learning space</label><select id="active-plan">${state.plans.map(x=>`<option value="${escape(x.id)}" ${x.id===p.id?'selected':''}>${escape(x.learner)} · ${escape(x.name)}</option>`).join('')}</select></div><div class="actions"><button id="new" class="secondary">+ Add a learner / goal</button><button id="export" class="secondary">Export progress</button><button id="restore" class="secondary">Restore backup</button></div></div><div class="stats"><div class="stat"><b>${st.current} ✦</b><span>day current streak</span></div><div class="stat"><b>${st.best}</b><span>day best streak</span></div><div class="stat"><b>${n}<span> / ${p.days}</span></b><span>scheduled activities completed</span></div><div class="stat"><b>${scores.total?Math.round(100*scores.score/scores.total)+'%':'—'}</b><span>daily quiz accuracy</span></div></div>${clockBack?'<p class="notice">Your saved history includes a future date. Check your device date before completing another daily session.</p>':''}${draft?`<p class="notice">You have a saved ${p.draft.mode==='daily'?'daily':p.draft.mode==='catchup'?'catch-up':'extra practice'} quiz on ${escape(ts[p.draft.topic].title)}. <button id="resume" class="secondary">Resume saved quiz</button></p>`:''}<div class="grid"><section class="panel today"><p class="eyebrow">${finished?'Plan complete':upToDate?'Today is complete':`Your next step · Session ${n+1}`}</p><h2>${finished?'A whole plan, one day at a time.':upToDate?'You showed up today.':escape(t.title)}</h2><p class="muted">${escape(p.learner)}, ${finished?'every scheduled daily session is complete.':upToDate?'your next daily session opens tomorrow. Extra practice is available now.':`${entry.review?'Spaced review':'New topic'} · ${escape(t.domain)}`}</p>${!finished&&dueAvailable?`<p>Read the lesson, apply the example, and answer fresh questions. Topics move forward each day; reviews use earlier results to guide practice.</p><button id="start" ${clockBack?'disabled':''}>${draft?'Resume saved quiz →':dueDate<today?'Continue missed activity →':'Start today’s practice →'}</button>`:upToDate?'<button class="secondary" id="revisit">Review today’s lesson</button>':''}<div style="margin-top:26px"><b>${seen.size} / ${ts.length} core topics completed at least once</b><div class="progress-track" role="progressbar" aria-label="Core topic coverage" aria-valuemin="0" aria-valuemax="${ts.length}" aria-valuenow="${seen.size}"><div class="progress-fill" style="width:${100*seen.size/ts.length}%"></div></div><small>${p.seen.length} distinct questions shown · ${p.attempts.length} answers checked. Topic completion does not establish mastery.</small></div></section><aside class="panel"><p class="eyebrow">Your consistency calendar</p><h2>Last 28 days</h2><div class="calendar">${Array.from({length:28},(_,i)=>{const date=E.addDays(today,i-27),done=p.completions.some(c=>c.date===date);return `<div class="date ${done?'done':''} ${date===today?'today':''}" aria-label="${human(date)}: ${done?'completed':'no completed session'}">${Number(date.slice(-2))}${done?' ✓':''}</div>`;}).join('')}</div><p class="muted" style="margin-top:16px;font-size:.85rem">Green = completed. Outline = today. Streaks count actual study dates. Catching up several activities today counts as one streak day.</p></aside></div><section class="panel syllabus"><p class="eyebrow">Keep practicing</p><h2>Fresh practice, whenever you want</h2><p>Extra quizzes use unseen questions first and record results. They do not add another daily completion or change your streak.</p><div class="toolbar"><div class="field"><label for="practice-topic">Practice topic</label><select id="practice-topic">${ts.map((x,i)=>`<option value="${i}" ${i===entry.topic?'selected':''}>${escape(x.domain)} · ${escape(x.title)}</option>`).join('')}</select></div><button id="practice">${draft?'Resume saved quiz':'Start a fresh practice quiz'}</button></div></section><section class="panel syllabus"><p class="eyebrow">Your full study sequence</p><h2>${escape(p.name)} · ${p.days} days</h2><p class="muted">${p.type==='custom'?'Your supplied syllabus':escape(C[p.type].outline)} · Started ${human(p.start)} · Original finish ${human(original)}</p>${!finished?`<p>At one activity per day, estimated finish: <b>${human(estimated)}</b>. ${estimated>original?'Missed days moved the finish date; unfinished topics remain in your sequence.':''}</p><h3>Coming up next</h3><ol>${seq.slice(n,n+5).map(x=>`<li>${escape(ts[x.topic].title)} <small>· ${x.review?'Review with fresh questions':'New topic'}</small></li>`).join('')}</ol>`:''}${p.type==='rd2026'&&estimated>='2027-01-01'?'<p class="notice">This plan uses the older RD outline. Add a new RD plan for the 2027 outline before preparing for a 2027 exam.</p>':''}<details><summary>Topic progress and results</summary><div class="syllabus-list">${[...new Set(ts.map(x=>x.domain))].map(domain=>`<h3>${escape(domain)}</h3>${ts.map((topic,i)=>({topic,i})).filter(x=>x.topic.domain===domain).map(({topic,i})=>{const answers=p.attempts.filter(x=>x.topic===i);return `<div class="topic-row"><span>${escape(topic.title)}<small>${answers.length?` · ${answers.filter(x=>x.correct).length}/${answers.length} correct`:''}</small></span><span>${seen.has(i)?'✓ Completed':`Session ${seq.findIndex(x=>x.topic===i)+1}`}</span></div>`;}).join('')}`).join('')}</div></details><details><summary>View every session in the sequence</summary><div class="syllabus-list">${seq.map((x,i)=>`<div class="topic-row"><span>${i+1}. ${escape(ts[x.topic].title)} · ${x.review?'Review':'Learn'}</span><span>${p.completions[i]?`✓ ${human(p.completions[i].date)}`:'Upcoming'}</span></div>`).join('')}</div></details><details><summary>How questions and reviews work</summary><p>All core topics are introduced before review cycles. Later review priorities use time since the last daily encounter and earlier daily results. The future review order can change as you complete quizzes.</p><p>Quantitative questions are generated locally with calculated answers. Reading questions include their passage or notes. Other topics use original applied cases and concept checks. Question content is tracked, not just answer order. The app tells you when a finite bank has no unseen items left and asks before reusing questions.</p><p>Sessions use 2–3 questions. Read for about 5–7 minutes, work the example, and use the remaining time to answer and review. Add comprehensive materials and official timed practice for deeper exam preparation.</p>${p.type!=='custom'?`<p><a target="_blank" rel="noopener" href="${C[p.type].source}">Official ${p.type==='sat'?'College Board content domains':'CDR examination resources'} ↗</a></p>`:''}<p>RD lessons are educational, not patient-specific care instructions. Progress stays in this browser, without secured accounts or cross-device sync. Export a backup before changing devices or clearing browser data.</p></details></section>`;
    app.querySelector('#active-plan').onchange=event=>{if(!guard())return;state.active=event.target.value;save();dashboard();};app.querySelector('#new').onclick=setup;app.querySelector('#export').onclick=()=>download('daily-practice-backup.json',{version:1,...state});app.querySelector('#restore').onclick=restore;
    app.querySelector('#resume')?.addEventListener('click',resume);
    app.querySelector('#start')?.addEventListener('click',()=>draft?resume():lesson(false));
    app.querySelector('#revisit')?.addEventListener('click',()=>lesson(true));
    app.querySelector('#practice').onclick=()=>draft?resume():prepare('practice',Number(app.querySelector('#practice-topic').value));
    const missed=E.overdue(p,today);
    if(missed.length){
      const panel=document.createElement('section');panel.className='panel syllabus missed';
      panel.innerHTML=`<p class="eyebrow">Catch up at your own pace</p><h2>${missed.length} missed ${missed.length===1?'activity':'activities'} waiting</h2><p>Work through overdue lessons from the earliest unfinished activity. You can complete several today to get back on schedule. Each activity counts toward topic coverage; streaks use the actual day you study.</p><button id="catchup" ${clockBack?'disabled':''}>${draft?'Resume saved quiz':'Start earliest missed activity →'}</button><details><summary>See missed activities and original dates</summary><div class="syllabus-list">${missed.map(({index,scheduledDate},i)=>`<div class="topic-row"><span>${index+1}. ${escape(ts[seq[index].topic].title)}<small>Originally scheduled ${human(scheduledDate)}</small></span><span>${i===0?'Next to complete':'Queued'}</span></div>`).join('')}</div></details>`;
      app.querySelector('.stats').after(panel);app.querySelector('#catchup').onclick=()=>draft?resume():lesson(false);
    }
  }
  function lesson(readOnly){
    view='lesson';
    const p=plan(),seq=sequence(p),index=readOnly?p.completions.length-1:p.completions.length,entry=seq[index],t=topics(p)[entry.topic];
    app.innerHTML=`<div class="lesson"><button class="secondary" id="back">← Dashboard</button><section class="panel" style="margin-top:20px"><p class="eyebrow">${readOnly?'Completed session review':'Step 1 of 3 · Read and apply'} · ${entry.review?'Spaced review':'New topic'}</p><span class="pill">${escape(t.domain)}</span><h2>${escape(t.title)}</h2><p class="body-copy">${escape(t.lesson)}</p><div class="example"><b>Worked example / application</b><br>${escape(t.example)}</div><h3>Make it stick</h3><p>Explain the main idea in your own words. Work the example and identify one mistake to avoid. Your quiz tests the same concept with different questions.</p>${readOnly?'<p class="notice">This lesson is complete. Use Extra practice for another quiz.</p>':'<label class="check"><input type="checkbox" id="read"><span>I read the lesson and tried the example or recall exercise.</span></label><button id="quiz" disabled>Continue to fresh questions →</button>'}</section></div>`;
    app.querySelector('#back').onclick=dashboard;
    const originallyDue=E.addDays(p.start,index);
    if(!readOnly&&originallyDue<E.dayKey()){
      const note=document.createElement('p');note.className='notice';note.textContent=`Catch-up activity · Originally scheduled ${human(originallyDue)}. Completing it records today’s actual study date and advances your topic coverage.`;
      app.querySelector('.lesson .panel').prepend(note);
    }
    if(!readOnly){app.querySelector('#read').onchange=e=>{app.querySelector('#quiz').disabled=!e.target.checked;};app.querySelector('#quiz').onclick=()=>prepare(E.addDays(p.start,index)<E.dayKey()?'catchup':'daily',entry.topic);}
    focusHeading();
  }
  function prepare(mode,topic,allowRepeat=false){
    if(!guard())return;const p=plan();if(p.draft)return resume();
    message.textContent='';
    const seed=crypto.getRandomValues(new Uint32Array(1))[0];
    const result=Q.buildQuiz({topics:topics(p),topic,seed,seen:p.seen,attempts:p.attempts,introduced:[topic],count:p.type!=='custom'&&Q.generators.has(topics(p)[topic].title)?3:2,allowRepeat,builtin:p.type!=='custom'});
    if(result.exhausted){
      view='exhausted';
      app.innerHTML=`<div class="lesson panel"><p class="eyebrow">Question bank completed</p><h2>No unseen questions remain for this topic</h2><p>You have seen the available questions for ${escape(topics(p)[topic].title)}. Choose another topic for fresh practice, or explicitly repeat this topic for review.</p><div class="actions"><button id="back" class="secondary">Back to dashboard</button><button id="repeat">Repeat questions for review</button></div></div>`;
      app.querySelector('#back').onclick=dashboard;app.querySelector('#repeat').onclick=()=>prepare(mode,topic,true);focusHeading();return;
    }
    p.draft={mode,topic,index:p.completions.length,date:E.dayKey(),questions:result.questions,selected:result.questions.map(()=>null),checked:false,repeated:result.repeated};
    for(const q of result.questions)if(!p.seen.includes(q.id))p.seen.push(q.id);
    session=p.draft;save();quiz();
  }
  function resume(){
    if(!guard())return;const p=plan();if(!p.draft)return dashboard();
    if(p.draft.mode!=='practice'&&p.draft.index!==p.completions.length){delete p.draft;save();return dashboard();}
    if(p.draft.mode!=='practice')p.draft.mode=E.addDays(p.start,p.draft.index)<E.dayKey()?'catchup':'daily';
    p.draft.date=E.dayKey();session=p.draft;save();quiz();
  }
  function quiz(){
    if(!session)return dashboard();view='quiz';const p=plan(),t=topics(p)[session.topic];
    app.innerHTML=`<div class="lesson"><button class="secondary" id="back">← Dashboard (quiz saved)</button><section class="panel" style="margin-top:20px"><p class="eyebrow">${session.mode==='practice'?'Extra practice · No streak credit':'Step 2 of 3 · Retrieve'}</p><h2>${escape(t.title)}</h2><p class="muted">${session.questions.length} ${session.repeated?'review questions · includes previously seen content':'fresh questions · unseen in this plan'}. Your answers are saved as you go.</p><form id="quiz-form">${session.questions.map((q,i)=>`<fieldset><legend>${i+1}. ${escape(q.prompt)}</legend><span class="pill">${escape(topics(p)[q.topic].title)}</span>${q.options.map((o,j)=>`<label class="choice"><input required type="radio" name="q${i}" value="${j}" ${session.selected[i]===j?'checked':''} ${session.checked?'disabled':''}><span>${escape(o)}</span></label>`).join('')}<div id="feedback-${i}" hidden></div></fieldset>`).join('')}<button type="submit" ${session.checked?'disabled':''}>Check my answers</button></form><div id="quiz-result" role="status"></div></section></div>`;
    app.querySelector('#back').onclick=dashboard;
    app.querySelector('#quiz-form').onchange=e=>{if(!guard())return;if(session.checked)return;const i=Number(e.target.name.slice(1));if(!Number.isInteger(i)||i<0||i>=session.questions.length)return;session.selected[i]=Number(e.target.value);save();};
    app.querySelector('#quiz-form').onsubmit=e=>{e.preventDefault();if(!guard()||session.checked||session.selected.some(x=>x===null))return;session.checked=true;
      session.questions.forEach((q,i)=>{p.attempts.push({id:q.id,topic:q.topic,correct:session.selected[i]===q.answer,level:q.level,date:E.dayKey()});});save();quiz();
    };
    if(session.mode==='practice'){
      const leave=document.createElement('button');leave.className='secondary';leave.textContent='Choose another topic';
      leave.onclick=()=>{if(!guard())return;delete p.draft;save();dashboard();message.textContent='Extra quiz closed. Questions already shown remain in your history.';};
      app.querySelector('.lesson').prepend(leave);
    }
    if(session.checked){feedback();const result=app.querySelector('#quiz-result');result.tabIndex=-1;result.focus();result.scrollIntoView?.({block:'start'});}else focusHeading();
  }
  function feedback(){
    session.questions.forEach((q,i)=>{const correct=session.selected[i]===q.answer;const el=app.querySelector('#feedback-'+i);el.hidden=false;el.className='feedback'+(correct?'':' wrong');el.innerHTML=`<b>${correct?'Correct':'Review this one'} · ${escape(q.options[q.answer])}</b>${escape(q.explanation)}`;});
    const score=session.questions.filter((q,i)=>session.selected[i]===q.answer).length;
    app.querySelector('#quiz-result').innerHTML=`<p class="eyebrow">${session.mode!=='practice'?'Step 3 of 3 · Reflect':'Review your explanations'}</p><p class="result">${score} / ${session.questions.length} correct</p><p>Read the explanations above. A missed answer does not prevent daily completion; understanding feedback is part of the learning cycle.</p><label class="check"><input type="checkbox" id="reviewed"><span>I reviewed the explanations and can name one thing I learned.</span></label><button id="finish" disabled>${session.mode==='catchup'?'Complete missed activity →':session.mode==='daily'?'Finish today & save my streak →':'Finish extra practice →'}</button><p id="completion-error" role="alert"></p>`;
    app.querySelector('#reviewed').onchange=e=>{app.querySelector('#finish').disabled=!e.target.checked;};app.querySelector('#finish').onclick=complete;
  }
  function complete(){
    if(!session?.checked||!app.querySelector('#reviewed')?.checked||!guard())return;
    const p=plan(),daily=session.mode!=='practice',catchingUp=session.mode==='catchup',error=app.querySelector('#completion-error');
    if(daily){
      if(E.dayKey()!==session.date){error.textContent='The day changed. Return to the dashboard and resume the saved quiz to finish on the current date.';return;}
      const scheduledDate=E.addDays(p.start,session.index);
      if(p.completions.length!==session.index||p.completions.some(c=>c.date>session.date)||scheduledDate>session.date){error.textContent='This activity is already complete or is scheduled for a future day. Return to the dashboard.';return;}
      p.completions.push({date:session.date,scheduledDate,kind:scheduledDate<session.date?'catchup':'daily',index:session.index,topic:session.topic,score:session.questions.filter((q,i)=>session.selected[i]===q.answer).length,total:session.questions.length});
    }
    delete p.draft;save();dashboard();message.textContent=catchingUp?`Missed activity completed. ${E.overdue(p).length} overdue activities remain; coverage is updated and streaks use today’s actual date.`:daily?'Today’s learning cycle is complete. Your topic progress and streak are updated.':'Extra practice is saved. Start another fresh quiz whenever you want.';focusHeading();
  }
  function restore(){const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.onchange=async()=>{try{
    const file=input.files[0];if(!file)return;if(file.size>10e6)throw Error('Backup must be smaller than 10 MB.');const data=JSON.parse(await file.text());if(data.version!==1||!data.plans?.length)throw Error('Not a Daily Practice backup.');normalize(data);if(!guard())return;
    const ids=new Set(state.plans.map(p=>p.id)),incoming=data.plans.filter(p=>!ids.has(p.id));if(state.plans.length+incoming.length>30)throw Error('Restoring would exceed 30 plans.');state.plans.push(...incoming);state.active=incoming[0]?.id||state.active;save();dashboard();message.textContent=incoming.length?`Restored ${incoming.length} new plan(s), including question history. Existing plans were kept.`:'These plans already exist. Existing local progress was kept.';
  }catch(err){message.textContent='Could not restore backup: '+err.message;}};input.click();}
  window.addEventListener('storage',event=>{if(event.key!==KEY)return;if(view!=='dashboard'){warn('Progress changed in another tab. Your next action will reload the latest saved progress.');return;}guard();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&view==='dashboard'){if(guard())dashboard();}});
  dashboard();
})();
