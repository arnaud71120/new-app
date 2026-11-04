import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {runtime,token} from './runtime-server.mjs';

// Faults are injected between the production handler and the real SQLite DO.
// This adapter is test-only; production accepts no fault header or bypass.
const fixture=await build({stdin:{contents:`
import app,{SocialStore as ProductionStore} from './worker/index.js';
export class SocialStore extends ProductionStore{async fetch(request){
 if(new URL(request.url).pathname==='/fixture-seed'){for(const [key,value] of Object.entries(await request.json()))await this.ctx.storage.put(key,value);return Response.json({ok:true});}
 return super.fetch(request);
}}
export default {fetch(request,env,ctx){
 const fault=request.headers.get('X-Test-Failure'),binding=env.SOCIAL_STORE;
 const store={idFromName:name=>binding.idFromName(name),get:id=>{const stub=binding.get(id);return {fetch(input,init){
  const path=new URL(typeof input==='string'?input:input.url).pathname;
  if(fault==='configuration'&&path==='/admin'||fault==='metadata'&&['/feeds','/admin-probes','/data'].includes(path)||fault==='security'&&path==='/security')return Response.json({error:'fixture unavailable'},{status:503});
  return stub.fetch(input,init);
 }}}};
 return app.fetch(request,{...env,SOCIAL_STORE:store},ctx);
}};`,resolveDir:process.cwd(),sourcefile:'admin-resilience-fixture.mjs'},bundle:true,format:'esm',platform:'browser',target:'es2022',write:false});

test('Runtime : configuration et droits restent disponibles malgré une panne des diagnostics facultatifs',{timeout:20000},async()=>{
 const mf=await runtime(0,{scriptPath:undefined,script:fixture.outputFiles[0].text});
 try{
  const call=async(path,fault)=>{const response=await mf.dispatchFetch('http://localhost'+path,{headers:{Authorization:'Bearer '+token,...(fault?{'X-Test-Failure':fault}:{})}});return {status:response.status,reference:response.headers.get('X-Request-ID'),body:await response.json()};};
  const before=await call('/api/admin');assert.equal(before.status,200);
  const degraded=await call('/api/admin','metadata');
  assert.equal(degraded.status,200);assert.equal(degraded.body.role,'admin');assert.equal(degraded.body.revision,before.body.revision);
  assert.deepEqual(degraded.body.configuration,before.body.configuration);assert.equal(degraded.body.sources.length,before.body.sources.length);
  assert.equal(degraded.body.warnings.length,3);
  assert.deepEqual(new Set(degraded.body.warnings.map(warning=>warning.stage)),new Set(['feeds','admin-probes','social-state']));
  assert.ok(degraded.body.warnings.every(warning=>warning.requestId===degraded.reference));
  const missing=await call('/api/admin','configuration');
  assert.equal(missing.status,503);assert.equal(missing.body.stage,'configuration');assert.equal(missing.body.service,'administration');assert.equal(missing.body.requestId,missing.reference);assert.equal(missing.body.role,undefined);
  const source=await call('/api/source-search?platform=x&q=%40tariqkrim','security');
  assert.equal(source.status,503);assert.equal(source.body.stage,'rate-limit');assert.equal(source.body.service,'source-discovery');assert.equal(source.body.requestId,source.reference);
  const retry=await call('/api/admin');assert.equal(retry.status,200);assert.equal(retry.body.warnings.length,0);assert.deepEqual(retry.body.configuration,before.body.configuration);
 }finally{await mf.dispose();}
});

test('Runtime : les vues d’administration ne transfèrent pas les corps des publications',{timeout:20000},async()=>{
 const mf=await runtime(0,{scriptPath:undefined,script:fixture.outputFiles[0].text});try{
  const namespace=await mf.getDurableObjectNamespace('SOCIAL_STORE'),stub=namespace.get(namespace.idFromName('cyberveille-social-v1'));
  const catalog=await (await mf.dispatchFetch('http://localhost/api/admin',{headers:{Authorization:'Bearer '+token}})).json(),source=catalog.sources.find(item=>item.enabled&&item.url);
  const stamp=new Date().toISOString(),article={url:'https://www.cert.ssi.gouv.fr/alerte/test/',title:'PUBLICATION_BODY_MARKER',summary:'large publication '.repeat(2000),date:stamp};
  const seeded=await stub.fetch('https://internal/fixture-seed',{method:'POST',body:JSON.stringify({['feed:'+source.id]:{source:source.id,sourceUrl:source.url,status:'ok',checkedAt:stamp,articles:[article]},'post:test':{...article,sourceId:'x-brightdata',collectedAt:stamp}})});assert.equal(seeded.status,200);await seeded.body.cancel();
  const full=await (await stub.fetch('https://internal/feeds')).text(),compact=await (await stub.fetch('https://internal/feeds?summary=1')).text();
  assert.ok(full.includes('PUBLICATION_BODY_MARKER'));assert.ok(!compact.includes('PUBLICATION_BODY_MARKER'));assert.ok(compact.length<full.length/20);
  const rows=JSON.parse(compact);assert.equal(rows[0].count,1);assert.equal(rows[0].latestPostAt,stamp);
  const social=await (await stub.fetch('https://internal/data?summary=1')).json();assert.deepEqual(social.articles,[]);assert.equal(social.platforms.x.storedPosts,1);assert.equal(social.platforms.x.latestPostAt,stamp);
  for(const path of ['/api/admin','/api/operations']){const response=await mf.dispatchFetch('http://localhost'+path,{headers:{Authorization:'Bearer '+token}});assert.equal(response.status,200);assert.ok(!(await response.text()).includes('PUBLICATION_BODY_MARKER'));}
 }finally{await mf.dispose();}
});
