(function (root) {
  'use strict';
  const dayKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const ordinal = key => { const [y,m,d] = key.split('-').map(Number); return Math.floor(Date.UTC(y,m-1,d)/86400000); };
  const addDays = (key, count) => { const [y,m,d] = key.split('-').map(Number); return dayKey(new Date(y,m-1,d+count,12)); };
  function streak(completions, today = dayKey()) {
    const dates = [...new Set(completions.map(x=>x.date))].sort();
    let best=0, run=0, previous=-Infinity;
    for (const date of dates) { const n=ordinal(date); run=n===previous+1?run+1:1; best=Math.max(best,run); previous=n; }
    let current=0, cursor=dates.includes(today)?today:addDays(today,-1);
    const set=new Set(dates); while(set.has(cursor)) { current++; cursor=addDays(cursor,-1); }
    return {current,best};
  }
  function schedule(topics, days) {
    if (!Number.isInteger(days)||days<topics.length||days>730||!topics.length) throw Error(`Choose ${topics.length}–730 days to allow one topic per session.`);
    // Spread all first encounters over 80% of the plan; revisit earlier topics between them.
    const teachingDays = Math.max(topics.length, Math.ceil(days*.8));
    const first = new Map(topics.map((_,i)=>[Math.floor(i*teachingDays/topics.length),i]));
    const result=[]; let seen=0, review=0;
    for(let i=0;i<days;i++) {
      if(first.has(i)) { const index=first.get(i); result.push({topic:index,review:false}); seen++; }
      else { result.push({topic:review++%seen,review:true}); }
    }
    return result;
  }
  function validateTopics(topics) {
    if(!Array.isArray(topics)||topics.length<1||topics.length>200) throw Error('Provide 1–200 topics.');
    return topics.map((t,i)=>{
      for(const field of ['title','domain','lesson','example']) if(typeof t[field]!=='string'||!t[field].trim()||t[field].length>10000) throw Error(`Topic ${i+1}: ${field} is required (up to 10,000 characters).`);
      if(!Array.isArray(t.questions)||t.questions.length<2||t.questions.length>5) throw Error(`Topic ${i+1}: provide 2–5 questions.`);
      const questions=t.questions.map(q=>{
        if(typeof q.prompt!=='string'||!q.prompt.trim()||q.prompt.length>2000||!Array.isArray(q.options)||q.options.length<2||q.options.length>4||q.options.some(o=>typeof o!=='string'||!o.trim()||o.length>2000)||new Set(q.options).size!==q.options.length||!Number.isInteger(q.answer)||q.answer<0||q.answer>=q.options.length||typeof q.explanation!=='string'||!q.explanation.trim()||q.explanation.length>3000) throw Error(`Topic ${i+1}: check question, distinct choices, answer index and explanation.`);
        return {prompt:q.prompt,options:[...q.options],answer:q.answer,explanation:q.explanation};
      });
      return {title:t.title.trim(),domain:t.domain.trim(),lesson:t.lesson.trim(),example:t.example.trim(),questions};
    });
  }
  const api={dayKey,ordinal,addDays,streak,schedule,validateTopics};
  if(typeof module!=='undefined') module.exports=api; else root.PracticeEngine=api;
})(globalThis);
