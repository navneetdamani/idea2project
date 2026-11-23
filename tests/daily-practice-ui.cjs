const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const E=require('../applications/daily-practice/engine'),C=require('../applications/daily-practice/curriculum'),Q=require('../applications/daily-practice/questions');
require('../applications/daily-practice/question-cases');
const KEY='idea2proj.daily-practice.v1',code=fs.readFileSync(require('node:path').join(__dirname,'../applications/daily-practice/app.js'),'utf8');
const base=()=>({plans:[{id:'test',learner:'Learner',name:'SAT',type:'sat',start:E.dayKey(),days:365,scheduleVersion:2,completions:[],seen:[],attempts:[]}],active:'test'});
function harness(initial=base()){
  const stored=new Map([[KEY,JSON.stringify(initial)]]),nodes=new Map();
  function node(selector){if(!nodes.has(selector))nodes.set(selector,{innerHTML:'',textContent:'',value:'',checked:false,hidden:false,disabled:false,files:[],focus(){},prepend(){},after(child){this.afterNode=child;},addEventListener(type,fn){this['on'+type]=fn;},querySelector:node});return nodes.get(selector);}
  const sandbox={PracticeEngine:E,PracticeCurriculum:C,PracticeQuestions:Q,document:{querySelector:node,addEventListener(){},createElement:()=>({click(){}})},localStorage:{getItem:key=>stored.get(key)||null,setItem:(key,value)=>stored.set(key,value)},window:{scrollTo(){},addEventListener(){}},crypto:crypto.webcrypto,console,setTimeout,Blob,URL,Date};
  vm.runInNewContext(code,sandbox);
  return {node,stored,data:()=>JSON.parse(stored.get(KEY))};
}
const click=(h,id)=>h.node(id).onclick();
const submit=h=>h.node('#quiz-form').onsubmit({preventDefault(){}});
const select=(h,i,value)=>h.node('#quiz-form').onchange({target:{name:'q'+i,value:String(value)}});
let h=harness();click(h,'#start');h.node('#read').onchange({target:{checked:true}});click(h,'#quiz');
let p=h.data().plans[0];assert.equal(p.draft.questions.length,3);assert.equal(p.completions.length,0);assert.equal(p.seen.length,3);
const ids=p.draft.questions.map(q=>q.id);select(h,0,p.draft.questions[0].answer);
// A reload must retain exactly the same quiz and the selected answer.
h=harness(h.data());click(h,'#resume');p=h.data().plans[0];assert.deepEqual(p.draft.questions.map(q=>q.id),ids);assert.equal(p.draft.selected[0],p.draft.questions[0].answer);
select(h,1,(p.draft.questions[1].answer+1)%p.draft.questions[1].options.length);select(h,2,p.draft.questions[2].answer);submit(h);
p=h.data().plans[0];assert.equal(p.attempts.length,3);assert.equal(p.attempts.filter(x=>x.correct).length,2);assert.equal(p.completions.length,0,'grading alone does not earn daily credit');
// Reloading checked feedback must not grade or append attempts a second time.
h=harness(h.data());click(h,'#resume');assert.equal(h.data().plans[0].attempts.length,3);assert(h.node('#quiz-result').innerHTML.includes('2 / 3 correct'));
h.node('#reviewed').checked=true;click(h,'#finish');p=h.data().plans[0];assert.equal(p.completions.length,1);assert.equal(p.completions[0].topic,0);assert.equal(p.completions[0].score,2);assert(!p.draft);
// Extra practice produces new questions on the same day without inflating a streak.
h.node('#practice-topic').value='0';click(h,'#practice');p=h.data().plans[0];assert(p.draft.questions.every(q=>!ids.includes(q.id)));assert.equal(p.draft.mode,'practice');
p.draft.questions.forEach((q,i)=>select(h,i,q.answer));submit(h);h.node('#reviewed').checked=true;click(h,'#finish');p=h.data().plans[0];assert.equal(p.completions.length,1);assert.equal(p.attempts.length,6);assert.equal(p.seen.length,6);
// Old saved plans retain completion dates and continue at an unintroduced topic.
const legacy=base();delete legacy.plans[0].scheduleVersion;delete legacy.plans[0].seen;delete legacy.plans[0].attempts;legacy.plans[0].start=E.addDays(E.dayKey(),-3);legacy.plans[0].completions=[{index:0,date:E.addDays(E.dayKey(),-3),score:1,total:2},{index:1,date:E.addDays(E.dayKey(),-2),score:1,total:2}];
h=harness(legacy);click(h,'#start');h.node('#read').onchange({target:{checked:true}});click(h,'#quiz');p=h.data().plans[0];assert.equal(p.completions.length,2);assert.deepEqual(p.completions.map(c=>c.topic),[0,0]);assert.equal(p.draft.topic,1);assert(p.seen.includes(Q.id(C.sat.topics[0].questions[0])));
// A stale tab cannot overwrite newly committed progress.
const changed=h.data();changed.plans[0].learner='Changed elsewhere';h.stored.set(KEY,JSON.stringify(changed));select(h,0,0);assert.equal(h.data().plans[0].learner,'Changed elsewhere');assert(h.node('#message').textContent.includes('another tab'));
// Plan labels and imported lesson text are escaped before rendering.
const injected=base();injected.plans[0].learner='<img src=x onerror=alert(1)>';h=harness(injected);assert(!h.node('#app').innerHTML.includes('<img'));assert(h.node('#app').innerHTML.includes('&lt;img'));
// Catch-up completes old scheduled slots today, without manufacturing historical streak days.
const delayed=base();delayed.plans[0].start=E.addDays(E.dayKey(),-2);h=harness(delayed);
assert(h.node('.stats').afterNode.innerHTML.includes('2 missed activities'));
function finishNext(h,button){click(h,button);h.node('#read').onchange({target:{checked:true}});click(h,'#quiz');const p=h.data().plans[0];p.draft.questions.forEach((q,i)=>select(h,i,q.answer));submit(h);h.node('#reviewed').checked=true;click(h,'#finish');}
finishNext(h,'#catchup');p=h.data().plans[0];assert.equal(p.completions[0].date,E.dayKey());assert.equal(p.completions[0].scheduledDate,E.addDays(E.dayKey(),-2));assert.equal(p.completions[0].kind,'catchup');
assert(h.node('.stats').afterNode.innerHTML.includes('1 missed activity'));
finishNext(h,'#catchup');p=h.data().plans[0];assert.equal(p.completions.length,2);assert.equal(new Set(p.completions.map(c=>c.date)).size,1);assert.equal(E.streak(p.completions).current,1);
// Today's scheduled activity remains available after catching up; tomorrow's does not.
assert(h.node('#app').innerHTML.includes('id="start"'));finishNext(h,'#start');p=h.data().plans[0];assert.equal(p.completions.length,3);assert.equal(p.completions[2].kind,'daily');assert.equal(E.overdue(p).length,0);assert(!h.node('#app').innerHTML.includes('id="start"'));assert.equal(E.streak(p.completions).current,1);
h=harness(h.data());assert(!h.node('#storage-warning').textContent,'multiple catch-ups on the same actual day survive validation and reload');assert(h.node('#app').innerHTML.includes('3<span> / 365'));
console.log('PASS: saved quizzes, fresh practice, migration, escaping, multi-tab reconciliation, catch-up coverage, same-day limits, and truthful streak dates');
