const assert=require('node:assert/strict');
const E=require('../applications/daily-practice/engine');
const C=require('../applications/daily-practice/curriculum');
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
console.log('Daily Practice: curriculum schema, full-topic scheduling, review ordering, date boundaries, and streak tests passed.');
