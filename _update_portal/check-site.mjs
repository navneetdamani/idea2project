import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { parse } from 'parse5';
import { FILES, validateChange } from './policy.mjs';
const git = (...args) => execFileSync('git',args,{encoding:'utf8',cwd:new URL('..',import.meta.url),maxBuffer:1000000}).trim();
const base = process.env.PORTAL_BASE_SHA;
const automated = process.env.PORTAL_HEAD_REF?.startsWith('portal/change-');
if(automated) {
  if(!/^[a-f0-9]{40}$/.test(base || '')) throw Error('Base SHA required');
  const paths = git('diff','--name-only',base,'HEAD').split('\n').filter(Boolean);
  if(!paths.length || paths.some(p=>!FILES.includes(p))) throw Error('Automated change exceeds file allowlist');
  for(const path of paths) {
    const before = execFileSync('git',['show',`${base}:${path}`],{encoding:'utf8',cwd:new URL('..',import.meta.url)});
    const after=readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
    validateChange(path,before,after);
  }
}
for(const path of FILES.filter(p=>p.endsWith('.html'))) {
  const html=readFileSync(new URL(`../${path}`,import.meta.url),'utf8'),errors=[];
  const document=parse(html,{onParseError:e=>errors.push(e.code)});
  if(errors.length)throw Error(`Invalid HTML in ${path}: ${errors.join(', ')}`);
  const elements=[];
  function walk(n){elements.push(n);for(const child of n.childNodes || [])walk(child);}
  walk(document);
  for(const tag of ['html','head','title','body','main','h1'])if(!elements.some(e=>e.tagName===tag))throw Error(`${path} requires ${tag}`);
  for(const e of elements)for(const attr of e.attrs || []) {
    if(!['href','src'].includes(attr.name) || !attr.value || /^(https?:|mailto:|tel:|#|data:)/.test(attr.value))continue;
    const local=decodeURIComponent(attr.value.split(/[?#]/)[0]);
    if(local.startsWith('//'))continue;
    const target=new URL(`../${local}`,import.meta.url);
    // Local resources must exist; directories are valid for index.html routes.
    try{readFileSync(target);}catch(error){if(error.code!=='EISDIR')throw Error(`Broken local resource in ${path}: ${local}`);}
  }
}
console.log('Website structure, local resources and automated edit scope passed');
