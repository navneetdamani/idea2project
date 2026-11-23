const assert=require('node:assert/strict');
const E=require('../applications/daily-practice/engine');
const C=require('../applications/daily-practice/curriculum');
const Q=require('../applications/daily-practice/questions');
require('../applications/daily-practice/question-cases');
for(const [type,course] of Object.entries(C)){
  E.validateTopics(course.topics);
  assert.equal(new Set(course.topics.map(t=>t.title)).size,course.topics.length);
  for(const days of [course.topics.length,type==='sat'?365:90,730]){
    const seq=E.schedule(course.topics,days);
    assert.equal(seq.length,days);
    assert.equal(new Set(seq.map(x=>x.topic)).size,course.topics.length);
    const seen=new Set();for(const entry of seq){if(entry.review)assert(seen.has(entry.topic),'review must follow introduction');else {assert(!seen.has(entry.topic));seen.add(entry.topic);}}
  }
}
assert.equal(new Set(C.sat.topics.map(x=>x.domain)).size,8);
assert.equal(new Set(C.rd2027.topics.map(x=>x.domain)).size,4);
assert.equal(new Set(C.rd2026.topics.map(x=>x.domain)).size,4);
assert.throws(()=>E.schedule(C.rd2027.topics,10));
assert.throws(()=>E.schedule(C.sat.topics,Infinity));
assert.throws(()=>E.validateTopics([{...C.sat.topics[0],questions:[{prompt:'Bad',options:['a','b'],answer:9,explanation:'bad'}]}]));
assert.equal(E.addDays('2026-12-31',1),'2027-01-01');
assert.equal(E.addDays('2028-02-28',1),'2028-02-29');
assert.equal(E.addDays('2026-03-08',1),'2026-03-09');
assert.equal(E.addDays('2026-11-01',1),'2026-11-02');
assert.equal(E.ordinal('2026-03-09')-E.ordinal('2026-03-08'),1);
const c=dates=>dates.map(date=>({date}));
assert.deepEqual(E.streak([], '2026-11-13'),{current:0,best:0});
assert.deepEqual(E.streak(c(['2026-11-11','2026-11-12']), '2026-11-13'),{current:2,best:2});
assert.deepEqual(E.streak(c(['2026-11-10','2026-11-11']), '2026-11-13'),{current:0,best:2});
assert.deepEqual(E.streak(c(['2026-11-10','2026-11-11','2026-11-13','2026-11-13']), '2026-11-13'),{current:1,best:2});
assert.deepEqual(E.streak(c(['2026-12-31','2027-01-01']), '2027-01-01'),{current:2,best:2});
// The former yearly schedule repeated the first topic for its first eight days.
assert.equal(new Set(E.schedule(C.sat.topics,365).slice(0,34).map(x=>x.topic)).size,34);
const old={days:365,completions:Array.from({length:10},(_,index)=>({index,date:E.addDays('2026-11-01',index),score:1,total:2}))};
const historicalTopics=E.legacySchedule(C.sat.topics,365).slice(0,10).map(x=>x.topic);
E.migratePlan(old,C.sat.topics);
assert.deepEqual(old.completions.map(x=>x.topic),historicalTopics,'migration preserves actual completed topics');
assert.equal(old.completions.length,10);
const migrated=E.schedule(C.sat.topics,365,old.completions);
assert.deepEqual(migrated.slice(0,10).map(x=>x.topic),historicalTopics);
assert.equal(new Set(migrated.map(x=>x.topic)).size,34);
const identity={prompt:'A unique question?',options:['Yes','No'],answer:0};
assert.equal(Q.id(identity),Q.id({...identity,options:['No','Yes']}),'option shuffling is not a fresh question');
assert.equal(Q.id(identity),Q.id({...identity,options:['Different distractor','Yes']}),'new distractors are not a fresh question');
// End-to-end sequences: no duplicate question prompts and no uncovered core topics.
for(const trial of [1,7,19])for(const [type,days] of [['sat',365],['rd2027',90],['rd2026',90]]){
  const course=C[type],history=[],seen=[],prompts=new Set();
  for(let i=0;i<days;i++){
    const topic=E.schedule(course.topics,days,history)[i].topic;
    const result=Q.buildQuiz({topics:course.topics,topic,seed:trial*123456+i*321,seen,count:Q.generators.has(course.topics[topic].title)?3:2});
    assert.equal(result.exhausted,false,`${type} day ${i+1}: ${course.topics[topic].title}`);
    assert(result.questions.length>=2);
    E.validateTopics([{...course.topics[topic],questions:result.questions}]);
    for(const q of result.questions){assert(!seen.includes(q.id));assert(!prompts.has(q.prompt));seen.push(q.id);prompts.add(q.prompt);assert.equal(q.topic,topic);}
    const score=trial===7?i%result.questions.length:result.questions.length;
    history.push({index:i,topic,score,total:result.questions.length});
  }
  assert.equal(new Set(history.map(x=>x.topic)).size,course.topics.length);
}
// Independently solve generated linear equations; verify shuffled option keys.
for(let seed=1;seed<=100;seed++){
  const result=Q.buildQuiz({topics:C.sat.topics,topic:0,seed});
  for(const q of result.questions){const match=q.prompt.match(/Solve for x: (\d+)x \+ (\d+) = (-?\d+)\./);if(match){const [,a,b,c]=match.map(Number);assert.equal(Number(q.options[q.answer]),(c-b)/a);}}
}
// Conditional probability distractors must also be mathematically distinct.
const probability=C.sat.topics.findIndex(t=>t.title==='Probability and conditional probability');
for(const q of Q.candidates(C.sat.topics[probability],probability,123,1)){
  const values=q.options.filter(x=>/^\d+\/\d+$/.test(x)).map(x=>{const [a,b]=x.split('/').map(Number);return a/b;});
  assert.equal(new Set(values).size,values.length);
}
// A finite custom bank must stop rather than quietly repeating the same quiz.
const custom=[C.sat.topics[0]],first=Q.buildQuiz({topics:[{...custom[0],title:'Custom skill'}],topic:0,seed:1,count:2});
const exhausted=Q.buildQuiz({topics:[{...custom[0],title:'Custom skill'}],topic:0,seed:2,seen:first.questions.map(q=>q.id),count:2});
assert.equal(exhausted.exhausted,true);assert.equal(exhausted.questions.length,0);
const repeat=Q.buildQuiz({topics:[{...custom[0],title:'Custom skill'}],topic:0,seed:2,seen:first.questions.map(q=>q.id),allowRepeat:true,count:2});
assert.equal(repeat.repeated,true);
const matchingTitle=Q.buildQuiz({topics:custom,topic:0,seed:3,builtin:false,count:2});
assert(matchingTitle.questions.every(q=>custom[0].questions.some(own=>Q.id(own)===q.id)),'custom course titles must not activate unrelated preset generators');
const mainIdea=C.sat.topics.findIndex(t=>t.title==='Central ideas and details');
const varied=Q.buildQuiz({topics:C.sat.topics,topic:mainIdea,seed:999});
const families=varied.questions.filter(q=>q.family).map(q=>q.family);
assert.equal(new Set(families).size,families.length,'one reading quiz must not repeat the same passage family with different numbers');
console.log('PASS: complete SAT/RD sequences, unseen question content, answer keys, legacy migration, date boundaries, streaks, and explicit bank exhaustion');
