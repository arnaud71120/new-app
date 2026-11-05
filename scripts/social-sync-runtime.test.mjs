import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {Response as WorkerResponse} from 'miniflare';
import {runtime,token} from './runtime-server.mjs';

// The only test adapter seeds/reads the actual SQLite Durable Object. Public
// requests still pass through production authentication, jobs, leases and tick.
const fixture=await build({stdin:{contents:`
import app,{SocialStore as ProductionStore} from './worker/index.js';
export class SocialStore extends ProductionStore{async fetch(request){
 const url=new URL(request.url);
 if(url.pathname==='/fixture-seed'){for(const [key,value] of Object.entries(await request.json()))await this.ctx.storage.put(key,value);return Response.json({ok:true});}
 if(url.pathname==='/fixture-state')return Response.json(await this.ctx.storage.get('state'));
 return super.fetch(request);
}}
export default app;`,resolveDir:process.cwd(),sourcefile:'social-sync-runtime-fixture.mjs'},bundle:true,format:'esm',platform:'browser',target:'es2022',write:false});

const profile={id:'sync-fixture',name:'Compte de recette',x:'syncfixture',linkedin:'https://www.linkedin.com/in/sync-fixture/',enabled:true,priority:1};
const state=(overrides={})=>({platforms:{x:{status:'ready',nextAt:Date.now()+86400000,lastAttempt:Date.now()-3600000,requestRevision:2},linkedin:{status:'ready',nextAt:Date.now()+86400000,lastAttempt:Date.now()-3600000,requestRevision:2}},budget:{month:new Date().toISOString().slice(0,7),used:0},...overrides});
const config=(overrides={})=>({revision:1,profilesConfigured:true,profiles:[profile],socialSchedule:{xHours:6,linkedinHours:12},...overrides});
const json=(value,status=200,headers={})=>new WorkerResponse(JSON.stringify(value),{status,headers:{'Content-Type':'application/json',...headers}});
function timeout(promise,label,milliseconds=4000){let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label)),milliseconds);})]).finally(()=>clearTimeout(timer));}
async function setup({initial=state(),configuration=config(),bindings={},outbound}={}){
 const calls=[];
 const mf=await runtime(0,{scriptPath:undefined,script:fixture.outputFiles[0].text,bindings:{EXTERNAL_CALLS_PAUSED:'false',BRIGHTDATA_TOKEN:'runtime-fixture-provider-token',BRIGHTDATA_FREE_ONLY_CONFIRMED:'true',...bindings},outboundService:async request=>{
  const url=new URL(request.url);assert.equal(url.hostname,'api.brightdata.com','A test must never call a real or unexpected provider.');
  calls.push({url:url.href,path:url.pathname,method:request.method,body:request.method==='POST'?await request.json():null});
  return outbound?outbound(request,url,calls):json({snapshot_id:'sd_sync_fixture'});
 }});
 const namespace=await mf.getDurableObjectNamespace('SOCIAL_STORE'),stub=namespace.get(namespace.idFromName('cyberveille-social-v1'));
 const seeded=await stub.fetch('https://internal/fixture-seed',{method:'POST',body:JSON.stringify({'admin:config':configuration,state:initial})});assert.equal(seeded.status,200);await seeded.body.cancel();
 const call=async(path,{body,auth=token,origin='http://localhost',method}={})=>{
  const response=await mf.dispatchFetch('http://localhost'+path,{method:method||(body===undefined?'GET':'POST'),headers:{...(auth?{Authorization:'Bearer '+auth}:{}),...(body===undefined?{}:{Origin:origin,'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  assert.match(response.headers.get('Content-Type')||'',/application\/json/);
  return {status:response.status,body:await response.json()};
 };
 const start=(platform='x',requestId=crypto.randomUUID())=>call('/api/sync',{body:{platform,requestId}});
 const read=jobId=>call('/api/sync?'+new URLSearchParams({jobId}));
 const complete=jobId=>timeout((async()=>{for(;;){const result=await read(jobId);assert.equal(result.status,200,JSON.stringify(result));if(!['queued','running'].includes(result.body.status))return result.body;await new Promise(resolve=>setTimeout(resolve,20));}})(),'The synchronization job did not finish.');
 const stored=async()=>await (await stub.fetch('https://internal/fixture-state')).json();
 return {mf,stub,calls,call,start,read,complete,stored};
}

test('Runtime : forcer X accepte immédiatement, ignore son prochain horaire et ne double aucune extraction',{timeout:20000},async()=>{
 let release,triggered;const gate=new Promise(resolve=>{release=resolve;}),started=new Promise(resolve=>{triggered=resolve;});
 const initial=state(),originalLinkedIn=structuredClone(initial.platforms.linkedin);
 const fixture=await setup({initial,outbound:async(request,url)=>{
  if(url.pathname.endsWith('/trigger')){triggered();await gate;return json({snapshot_id:'sd_sync_gate'});}
  if(url.pathname.endsWith('/progress/sd_sync_gate'))return json({status:'running'});
  assert.fail('Unexpected provider endpoint: '+url.pathname);
 }});
 try{
  const id=crypto.randomUUID(),accepted=await timeout(fixture.start('x',id),'POST waited for the provider instead of returning 202.');
  assert.equal(accepted.status,202);assert.equal(accepted.body.jobId,id);assert.ok(['queued','running'].includes(accepted.body.status));
  await timeout(started,'The requested extraction did not start.');
  const running=await timeout(fixture.read(id),'GET must stay available while the provider is pending.');assert.equal(running.body.status,'running');
  const duplicate=await timeout(fixture.start('x',id),'The duplicate command blocked behind the provider.');assert.equal(duplicate.status,202);assert.equal(duplicate.body.jobId,id);
  const reserved=await fixture.stored();assert.equal(reserved.budget.used,3);assert.equal(reserved.platforms.x.pending.reserved,3);assert.ok(reserved.platforms.x.nextAt<initial.platforms.x.nextAt);assert.deepEqual(reserved.platforms.linkedin,originalLinkedIn);
  assert.equal(fixture.calls.length,1);assert.equal(fixture.calls[0].method,'POST');assert.match(fixture.calls[0].url,/dataset_id=gd_lwxkxvnf1cynvib9co/);assert.equal(fixture.calls[0].body.length,1);assert.equal(fixture.calls[0].body[0].url,'https://x.com/syncfixture');
  release();const result=await fixture.complete(id);assert.equal(result.status,'complete');assert.deepEqual(Object.keys(result.result.platforms),['x']);assert.equal(result.result.platforms.x.status,'started');assert.equal(result.result.platforms.x.pending,true);assert.equal(result.result.platforms.x.snapshotId,'sd_sync_gate');assert.equal(result.result.budget.used,3);
  await fixture.read(id);await fixture.read(id);assert.equal(fixture.calls.length,1,'Reading a completed job must never retrigger or poll the provider.');
  const follow=await fixture.start('x'),followed=await fixture.complete(follow.body.jobId);assert.equal(followed.result.platforms.x.status,'in_progress');assert.equal(fixture.calls.filter(row=>row.path.endsWith('/trigger')).length,1);assert.equal(fixture.calls.filter(row=>row.path.includes('/progress/')).length,1);
  const immediate=await fixture.start('x');await fixture.complete(immediate.body.jobId);assert.equal(fixture.calls.length,2,'The 15-second provider poll cooldown must apply to fresh commands too.');assert.equal((await fixture.stored()).budget.used,3);
 }finally{release();await fixture.mf.dispose();}
});

test('Runtime : un snapshot X prêt est importé sans envoyer une seconde extraction',{timeout:20000},async()=>{
 const initial=state();initial.budget.used=3;initial.platforms.x={...initial.platforms.x,status:'running',pending:{id:'sd_existing_ready',started:Date.now()-3600000,reserved:3,uncertain:false,profiles:[profile]}};
 const fixture=await setup({initial,outbound:async(request,url)=>{
  if(url.pathname.endsWith('/progress/sd_existing_ready'))return json({status:'ready'});
  if(url.pathname.endsWith('/snapshot/sd_existing_ready'))return json([{id:'2110431221675332999',url:'https://x.com/syncfixture/status/2110431221675332999',user_posted:'syncfixture',description:'Nouvelle publication de cybersécurité de recette.',date_posted:new Date().toISOString()}]);
  assert.fail('A ready pending snapshot must not trigger a new extraction: '+url.pathname);
 }});
 try{
  const accepted=await fixture.start('x');assert.equal(accepted.status,202);const result=await fixture.complete(accepted.body.jobId);
  assert.equal(result.status,'complete');assert.equal(result.result.platforms.x.status,'ready');assert.equal(result.result.platforms.x.pending,false);assert.equal(result.result.platforms.x.count,1);assert.equal(result.result.platforms.x.newCount,1);
  const stored=await fixture.stored();assert.equal(stored.budget.used,3);assert.equal(stored.platforms.x.pending,undefined);assert.equal(stored.platforms.x.lastSnapshotId,'sd_existing_ready');assert.equal(stored.platforms.x.lastCount,1);
  assert.equal(fixture.calls.length,2);assert.ok(fixture.calls.every(row=>row.method==='GET'));
  const social=await fixture.call('/api/social');assert.equal(social.status,200);assert.equal(social.body.articles.length,1);assert.equal(social.body.articles[0].followedPerson,profile.name);
  await fixture.read(accepted.body.jobId);assert.equal(fixture.calls.length,2);
 }finally{await fixture.mf.dispose();}
});

test('Runtime : un résultat fournisseur dépassant sa réservation est importé puis signale la collecte suspendue',{timeout:20000},async()=>{
 const initial=state();initial.budget.used=3;initial.platforms.x={...initial.platforms.x,status:'running',pending:{id:'sd_over_reserved',started:Date.now()-3600000,reserved:3,uncertain:false,profiles:[profile]}};
 const fixture=await setup({initial,outbound:async(request,url)=>{
  assert.equal(request.method,'GET');
  if(url.pathname.endsWith('/progress/sd_over_reserved'))return json({status:'ready'});
  if(url.pathname.endsWith('/snapshot/sd_over_reserved'))return json(Array.from({length:4},(_,index)=>({id:'211043122167533299'+index,url:'https://x.com/syncfixture/status/211043122167533299'+index,user_posted:'syncfixture',description:'Publication de recette dépassant la réservation numéro '+index,date_posted:new Date().toISOString()})));
  assert.fail('An oversized provider result must not launch another extraction: '+url.pathname);
 }});
 try{
  const accepted=await fixture.start('x');assert.equal(accepted.status,202);const result=await fixture.complete(accepted.body.jobId);
  assert.equal(result.status,'complete');assert.equal(result.result.platforms.x.status,'blocked');assert.equal(result.result.platforms.x.code,'halted');assert.equal(result.result.platforms.x.count,4);assert.equal(result.result.platforms.x.newCount,4);assert.equal(result.result.platforms.x.pending,false);
  const stored=await fixture.stored();assert.equal(stored.halted,true);assert.equal(stored.budget.used,3);assert.equal(stored.platforms.x.lastCount,4);assert.equal(stored.platforms.x.pending,undefined);assert.equal(fixture.calls.length,2);assert.ok(fixture.calls.every(row=>row.method==='GET'));
  const social=await fixture.call('/api/social');assert.equal(social.body.articles.length,4);
 }finally{await fixture.mf.dispose();}
});

test('Runtime : la portée LinkedIn ou toutes les plateformes réserve exactement les profils demandés',{timeout:20000},async()=>{
 for(const scope of ['linkedin','all']){
  const fixture=await setup({outbound:async(request,url)=>{assert.ok(url.pathname.endsWith('/trigger'));return json({snapshot_id:url.searchParams.get('dataset_id')==='gd_lyy3tktm25m4avu764'?'sd_sync_linkedin':'sd_sync_x'});}});
  try{
   const accepted=await fixture.start(scope);assert.equal(accepted.status,202);const result=await fixture.complete(accepted.body.jobId);
   const selected=scope==='all'?['x','linkedin']:['linkedin'];assert.equal(result.status,'complete');assert.deepEqual(Object.keys(result.result.platforms),selected);
   assert.equal(fixture.calls.length,selected.length);assert.equal(result.result.budget.used,scope==='all'?4:1);
   for(const platform of selected){assert.equal(result.result.platforms[platform].status,'started');assert.equal(result.result.platforms[platform].pending,true);}
   const linkedin=fixture.calls.find(row=>new URL(row.url).searchParams.get('dataset_id')==='gd_lyy3tktm25m4avu764');assert.ok(linkedin);assert.equal(linkedin.body.length,1);assert.equal(linkedin.body[0].url,profile.linkedin);
   if(scope==='linkedin')assert.equal((await fixture.stored()).platforms.x.pending,undefined);
  }finally{await fixture.mf.dispose();}
 }
});

test('Runtime : forcer une ancienne collecte lance une extraction récente sans réimporter son snapshot historique',{timeout:20000},async()=>{
 const initial=state();initial.platforms.x={...initial.platforms.x,lastSnapshotId:'sd_old',importRevision:1,mediaRevision:0,lastCount:1};
 const fixture=await setup({initial,outbound:async(request,url)=>{
  assert.ok(url.pathname.endsWith('/trigger'),'A force command must not fetch the historical snapshot: '+url.pathname);assert.equal(request.method,'POST');return json({snapshot_id:'sd_fresh_forced'});
 }});
 try{
  const accepted=await fixture.start('x');assert.equal(accepted.status,202);const result=await fixture.complete(accepted.body.jobId);
  assert.equal(result.status,'complete');assert.equal(result.result.platforms.x.status,'started');assert.equal(result.result.platforms.x.pending,true);assert.equal(result.result.platforms.x.snapshotId,'sd_fresh_forced');assert.equal(result.result.budget.used,3);
  assert.equal(fixture.calls.length,1);assert.ok(fixture.calls[0].path.endsWith('/trigger'));const stored=await fixture.stored();assert.equal(stored.platforms.x.pending.id,'sd_fresh_forced');assert.equal(stored.platforms.x.lastSnapshotId,'sd_old');assert.equal(stored.platforms.x.importRevision,1);
 }finally{await fixture.mf.dispose();}
});

test('Runtime : incertitude, budget et délai récent empêchent toute nouvelle extraction forcée',{timeout:20000},async()=>{
 for(const scenario of ['uncertain','budget','cooldown']){
  const initial=state();
  if(scenario==='uncertain')initial.platforms.x.pending={started:Date.now()-3600000,reserved:3,uncertain:true,profiles:[profile]};
  if(scenario==='budget')initial.budget.used=3999;
  if(scenario==='cooldown')initial.platforms.x.lastAttempt=Date.now();
  const fixture=await setup({initial,outbound:()=>{assert.fail('No outbound call is allowed for '+scenario);}});
  try{
   const accepted=await fixture.start('x');assert.equal(accepted.status,202);const result=await fixture.complete(accepted.body.jobId);
   assert.equal(result.status,'complete',scenario);assert.equal(result.result.platforms.x.status,{uncertain:'uncertain',budget:'blocked',cooldown:'cooldown'}[scenario]);
   if(scenario==='uncertain')assert.equal(result.result.platforms.x.pending,true);
   if(scenario==='budget')assert.equal(result.result.platforms.x.code,'budget_exhausted');
   if(scenario==='cooldown')assert.ok(result.result.platforms.x.retryAfterSeconds>0);
   assert.equal(fixture.calls.length,0);assert.equal((await fixture.stored()).budget.used,initial.budget.used);
  }finally{await fixture.mf.dispose();}
 }
});

test('Runtime : les pauses et la confirmation du compte gratuit restent obligatoires',{timeout:20000},async()=>{
 for(const scenario of ['environment-pause','external-pause','social-pause','free-confirmation']){
  const configuration=config(),bindings={};
  if(scenario==='environment-pause')bindings.EXTERNAL_CALLS_PAUSED='true';
  if(scenario==='external-pause')configuration.externalPaused=true;
  if(scenario==='social-pause')configuration.socialPaused=true;
  if(scenario==='free-confirmation')bindings.BRIGHTDATA_FREE_ONLY_CONFIRMED='false';
  const fixture=await setup({configuration,bindings,outbound:()=>{assert.fail('A pause or missing free confirmation must block the provider.');}});
  try{
   const accepted=await fixture.start('all');assert.equal(accepted.status,202);const result=await fixture.complete(accepted.body.jobId);
   assert.equal(result.status,'failed',scenario);assert.equal(result.code,scenario==='free-confirmation'?'free_confirmation':'owner_paused');assert.equal(fixture.calls.length,0);assert.equal((await fixture.stored()).budget.used,0);
  }finally{await fixture.mf.dispose();}
 }
});

test('Runtime : HTTP 429 conserve Retry-After et sa réservation, même en forçant à nouveau',{timeout:20000},async()=>{
 const startedAt=Date.now(),fixture=await setup({outbound:async(request,url)=>{assert.ok(url.pathname.endsWith('/trigger'));return json({message:'Rate limited'},429,{'Retry-After':'1200'});}});
 try{
  const accepted=await fixture.start('x'),result=await fixture.complete(accepted.body.jobId);
  assert.equal(result.status,'complete');assert.equal(result.result.platforms.x.status,'blocked');assert.equal(result.result.platforms.x.code,'provider_limit');assert.equal(result.result.platforms.x.providerHttpStatus,429);assert.ok(result.result.platforms.x.retryAfterSeconds>=1190);
  const stored=await fixture.stored();assert.ok(stored.platforms.x.providerRetryAt>=startedAt+1200000);assert.equal(stored.platforms.x.pending,undefined);assert.equal(stored.budget.used,3);
  const retry=await fixture.start('x'),retried=await fixture.complete(retry.body.jobId);assert.equal(retried.result.platforms.x.status,'blocked');assert.equal(retried.result.platforms.x.code,'provider_limit');assert.equal(fixture.calls.length,1);assert.equal((await fixture.stored()).budget.used,3);
 }finally{await fixture.mf.dispose();}
});

test('Runtime : Retry-After protège aussi le suivi d’un snapshot existant après le délai de quinze secondes',{timeout:20000},async()=>{
 const initial=state();initial.budget.used=3;initial.platforms.x={...initial.platforms.x,status:'running',pending:{id:'sd_pending_rate_limit',started:Date.now()-3600000,reserved:3,uncertain:false,profiles:[profile]}};
 let providerChecks=0;
 const fixture=await setup({initial,outbound:async(request,url)=>{
  assert.ok(url.pathname.endsWith('/progress/sd_pending_rate_limit'));assert.equal(request.method,'GET');providerChecks++;
  return providerChecks===1?json({message:'Progress limited'},429,{'Retry-After':'1200'}):json({status:'running'});
 }});
 const replaceState=async value=>{const response=await fixture.stub.fetch('https://internal/fixture-seed',{method:'POST',body:JSON.stringify({state:value})});assert.equal(response.status,200);await response.body.cancel();};
 try{
  const first=await fixture.start('x');await fixture.complete(first.body.jobId);let stored=await fixture.stored();assert.equal(stored.platforms.x.lastHttpStatus,429);assert.ok(stored.platforms.x.providerRetryAt>Date.now()+1190000);assert.equal(providerChecks,1);
  // Advance the persisted poll age only: the provider Retry-After is still in
  // the future, so a fresh explicit command must leave the same snapshot alone.
  stored.platforms.x.lastCheckedAt=Date.now()-16000;await replaceState(stored);
  const blocked=await fixture.start('x'),blockedResult=await fixture.complete(blocked.body.jobId);assert.equal(blockedResult.result.platforms.x.pending,true);assert.equal(providerChecks,1);assert.equal((await fixture.stored()).budget.used,3);
  stored=await fixture.stored();stored.platforms.x.providerRetryAt=Date.now()-1;stored.platforms.x.lastCheckedAt=Date.now()-16000;await replaceState(stored);
  const resumed=await fixture.start('x'),result=await fixture.complete(resumed.body.jobId);assert.equal(result.result.platforms.x.status,'in_progress');assert.equal(providerChecks,2);stored=await fixture.stored();assert.equal(stored.platforms.x.pending.id,'sd_pending_rate_limit');assert.equal(stored.platforms.x.providerRetryAt,undefined);assert.equal(stored.platforms.x.lastHttpStatus,null);assert.equal(stored.budget.used,3);assert.ok(fixture.calls.every(row=>row.method==='GET'));
 }finally{await fixture.mf.dispose();}
});

test('Runtime : la commande de synchronisation refuse les requêtes anonymes, les mauvaises origines et les identifiants invalides',{timeout:20000},async()=>{
 const fixture=await setup({outbound:()=>{assert.fail('Rejected requests must never reach the provider.');}});
 try{
  assert.equal((await fixture.call('/api/sync?jobId='+crypto.randomUUID(),{auth:null})).status,401);
  assert.equal((await fixture.call('/api/sync',{body:{requestId:crypto.randomUUID(),platform:'all'},origin:'https://another.example'})).status,403);
  assert.equal((await fixture.call('/api/sync',{body:{requestId:'invalid-id',platform:'x'}})).status,400);
  assert.equal((await fixture.call('/api/sync',{body:{requestId:crypto.randomUUID(),platform:'rss'}})).status,400);
  assert.equal((await fixture.call('/api/sync?jobId='+crypto.randomUUID())).status,404);
  assert.equal((await fixture.call('/api/sync',{method:'PUT'})).status,405);
  assert.equal(fixture.calls.length,0);assert.equal((await fixture.stored()).budget.used,0);
 }finally{await fixture.mf.dispose();}
});
