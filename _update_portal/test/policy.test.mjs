import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FILES,validateChange,validateProposal } from '../policy.mjs';
const page='<!doctype html><html><head><title>Before</title></head><body><main><h1>Hello</h1><a href="/safe">Link</a><script src="script.js"></script></main></body></html>';
test('visible text changes pass',()=>validateChange('index.html',page,page.replace('Hello','Updated &amp; improved')));
for(const [name,path,next] of [
  ['script insertion','index.html',page.replace('Hello','<script>alert(1)</script>')],
  ['event handler','index.html',page.replace('<h1>','<h1 onclick="alert(1)">')],
  ['changed link','index.html',page.replace('/safe','https://evil.example')],
  ['script replacement','index.html',page.replace('script.js','evil.js')],
  ['markup restructure','index.html',page.replace('<h1>','<h2>').replace('</h1>','</h2>')],
  ['secret file','.env','key=exfiltrate'],
  ['traversal','../index.html',page],
  ['workflow edit','.github/workflows/portal-checks.yml','skip: true'],
  ['parser confusion','index.html',page.replace('Hello','<svg><foreignObject>attack</foreignObject></svg>')]
])test(`blocks ${name}`,()=>assert.throws(()=>validateChange(path,page,next)));
test('inline scripts cannot change',()=>{
  const before=page.replace('<script src="script.js"></script>','<script>const x=1;</script>');
  assert.throws(()=>validateChange('index.html',before,before.replace('x=1','x=2')));
});
test('CSS styling passes',()=>validateChange('style.css','body{color:red}','body{color:blue;display:grid}'));
for(const value of ['body{background:url(https://evil.example)}','@import "https://evil.example";','body{background:image-set("https://evil.example" 1x)}','body{width:expression(alert(1))}','body{background:u\\72l(https://evil.example)}','body{content:attr(value)}']) {
  test(`blocks CSS resource or execution: ${value}`,()=>assert.throws(()=>validateChange('style.css','body{color:red}',value)));
}
test('existing resource preserved',()=>validateChange('style.css','@import url("https://fonts.googleapis.com/x");body{color:red}','@import url("https://fonts.googleapis.com/x");body{color:blue}'));
test('empty, duplicate, unchanged proposals fail',()=>{
  assert.throws(()=>validateProposal({files:[]},{'index.html':page}));
  assert.throws(()=>validateProposal({files:[{path:'index.html',content:page}]},{'index.html':page}));
  assert.throws(()=>validateProposal({files:[{path:'index.html',content:page+' '},{path:'index.html',content:page+' '}]},{'index.html':page}));
});
test('real website text and styling changes satisfy policy',()=>{
  for(const path of FILES){
    const before=readFileSync(new URL(`../../${path}`,import.meta.url),'utf8');
    const after=path.endsWith('.css')?before+'\nbody{color:#172127}':before.replace('<title>','<title>Updated ');
    assert.notEqual(before,after);validateChange(path,before,after);
  }
});
