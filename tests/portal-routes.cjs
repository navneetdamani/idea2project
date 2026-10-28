const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..');
for(const name of ['index.html','candidate.html','reviewer.html']){
  const old=fs.readFileSync(path.join(root,'demos/recruitment',name),'utf8');
  let destination;
  vm.runInNewContext(old.match(/<script>([\s\S]*?)<\/script>/)[1],{location:{search:'?job=I2P-20261027-01',hash:'#verification-test',replace:url=>destination=url}});
  assert.equal(destination,'/applications/recruitment/'+(name==='index.html'?'':name)+'?job=I2P-20261027-01#verification-test');
  const file=path.join(root,'applications/recruitment',name),html=fs.readFileSync(file,'utf8');
  for(const [,url] of html.matchAll(/(?:src|href)="([^"<>]+)"/g)){
    if(/^(?:https?:|mailto:|tel:|#)/.test(url))continue;
    const clean=url.split(/[?#]/)[0];if(!clean)continue;
    assert.ok(fs.existsSync(path.resolve(path.dirname(file),clean)),name+': missing '+url);
  }
}
console.log('PASS: canonical portal assets and legacy redirects preserve query strings and verification fragments');
const admin=fs.readFileSync(path.join(root,'applications/recruitment/admin.html'),'utf8');
for(const [,url] of admin.matchAll(/(?:src|href)="([^"<>]+)"/g)){
  if(/^(?:https?:|mailto:|tel:|#)/.test(url))continue;
  assert.ok(fs.existsSync(path.resolve(root,'applications/recruitment',url.split(/[?#]/)[0])),'Admin asset missing: '+url);
}
