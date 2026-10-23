import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Response as WorkerResponse} from 'miniflare';
import {runtime,token} from './runtime-server.mjs';
import {SOURCES} from '../worker/index.js';

const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
async function bounded(promise,milliseconds,message){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(message)),milliseconds);})]);}finally{clearTimeout(timer);}}
async function until(read,accept,milliseconds=5000){const deadline=Date.now()+milliseconds;let result;do{result=await read();if(accept(result))return result;await new Promise(resolve=>setTimeout(resolve,25));}while(Date.now()<deadline);assert.fail('État durable attendu non observé : '+JSON.stringify(result));}

// This runs real workerd/SQLite Durable Objects. Outbound traffic has no network
// fallback: only a local Gemini fixture is accepted by the service callback.
test('Runtime Cloudflare : analyses durables, retour 202, idempotence et erreurs fournisseur isolées',{timeout:20000},async()=>{
 const gate=deferred(),providerStarted=deferred(),requests=[],unexpected=[];let mf;
 try{
  mf=await runtime(0,{
   bindings:{EXTERNAL_CALLS_PAUSED:'false',GEMINI_API_KEY:'fixture',GEMINI_FREE_TIER_CONFIRMED:'true'},
   outboundService:async request=>{
    const url=new URL(request.url);
    if(url.hostname!=='generativelanguage.googleapis.com'){unexpected.push(url.hostname);return new WorkerResponse('Unexpected outbound service',{status:599});}
    requests.push({pathname:url.pathname,method:request.method,body:JSON.parse(await request.text())});
    if(requests.length===1){providerStarted.resolve();await gate.promise;return WorkerResponse.json({candidates:[{content:{parts:[{text:'Analyse native durable : publication conservée et résultat vérifiable.'}]},finishReason:'STOP'}]});}
    if(requests.length===3)return new WorkerResponse('<html><head><title>Service unavailable</title></head><body>Upstream service temporarily unavailable</body></html>',{status:503,headers:{'Content-Type':'text/html;charset=utf-8'}});
    return WorkerResponse.json({error:{code:503,status:'UNAVAILABLE',message:'Fixture unavailable'}},{status:503});
   }
  });
  const call=async(path,body,authenticated=true)=>{
   const response=await mf.dispatchFetch('http://localhost'+path,{method:body?'POST':'GET',headers:{...(authenticated?{Authorization:'Bearer '+token}:{}),...(body?{Origin:'http://localhost','Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
   assert.match(response.headers.get('Content-Type')||'',/application\/json/);
   return {status:response.status,body:await response.json()};
  };
  const namespace=await mf.getDurableObjectNamespace('SOCIAL_STORE'),stub=namespace.get(namespace.idFromName('cyberveille-social-v1'));
  const source=SOURCES.find(source=>source.id==='zataz');assert.ok(source?.enabled);
  const url='https://www.zataz.com/analyse-native-runtime/',title='Analyse native runtime Cloudflare',eventId='analyse native runtime cloudflare';
  const article={id:url,url,title,summary:'Une publication conservée sert à vérifier le suivi d’une analyse dans le véritable runtime Cloudflare.',source:source.name,sourceId:source.id,date:new Date().toISOString(),language:'fr',cves:[],references:[],score:30,type:'Veille générale'};
  const seeded=await stub.fetch('https://internal/feeds',{method:'POST',body:JSON.stringify([{source:source.id,sourceUrl:source.url,status:'ok',stage:'complete',checkedAt:new Date().toISOString(),articles:[article]}])});
  assert.equal(seeded.status,200);assert.equal((await seeded.json()).ok,true);
  const requestId=randomUUID(),selection={requestId,eventId,urls:[url],sourceIds:['zataz'],provider:'gemini'};
  const started=await bounded(call('/api/analysis',selection),2000,'Le POST attend la réponse Gemini au lieu de rendre 202');
  assert.equal(started.status,202);assert.equal(started.body.jobId,requestId);
  await bounded(providerStarted.promise,2000,'Le traitement différé n’a pas atteint le fournisseur');
  const duplicate=await bounded(call('/api/analysis',selection),1500,'Un second POST ne doit pas attendre le fournisseur');
  assert.equal(duplicate.status,202);assert.equal(duplicate.body.jobId,requestId);assert.equal(requests.length,1);
  const pending=await call('/api/analysis?jobId='+requestId);assert.equal(pending.status,200);assert.equal(pending.body.status,'generating');
  gate.resolve();
  const completed=await until(()=>call('/api/analysis?jobId='+requestId),value=>value.body.status==='complete');
  assert.equal(completed.status,200);assert.equal(completed.body.result.provider,'gemini');assert.match(completed.body.result.text,/Analyse native durable/);assert.equal(requests.length,1);
  const completedDuplicate=await call('/api/analysis',selection);assert.equal(completedDuplicate.status,200);assert.equal(completedDuplicate.body.status,'complete');assert.equal(requests.length,1);
  assert.match(requests[0].pathname,/\/v1beta\/models\/gemini-2\.5-flash:generateContent$/);assert.equal(requests[0].method,'POST');assert.ok(JSON.stringify(requests[0].body).includes(title));

  const secondId=randomUUID();assert.equal((await call('/api/analysis',{...selection,requestId:secondId})).status,202);
  const failed=await until(()=>call('/api/analysis?jobId='+secondId),value=>value.body.status==='failed');
  assert.equal(failed.status,200);assert.equal(failed.body.code,'provider_error');assert.equal(failed.body.providerHttpStatus,503);assert.match(failed.body.error,/Gemini/);assert.equal(requests.length,2);

  const htmlId=randomUUID();assert.equal((await call('/api/analysis',{...selection,requestId:htmlId})).status,202);
  const htmlFailure=await until(()=>call('/api/analysis?jobId='+htmlId),value=>value.body.status==='failed');
  assert.equal(htmlFailure.status,200);assert.equal(htmlFailure.body.code,'provider_error');assert.equal(htmlFailure.body.providerHttpStatus,503);assert.match(htmlFailure.body.error,/Gemini/);assert.ok(!htmlFailure.body.error.includes('<html>'));assert.equal(requests.length,3);

  const config=await call('/api/admin');assert.equal(config.status,200);
  assert.equal((await call('/api/admin',{action:'pause',target:'externalPaused',value:true,revision:config.body.revision})).status,200);
  const pausedId=randomUUID();assert.equal((await call('/api/analysis',{...selection,requestId:pausedId})).status,202);
  const paused=await until(()=>call('/api/analysis?jobId='+pausedId),value=>value.body.status==='failed');
  assert.equal(paused.status,200);assert.equal(paused.body.code,'owner_paused');assert.equal(requests.length,3);
  const anonymous=await call('/api/analysis?jobId='+requestId,undefined,false);assert.equal(anonymous.status,401);assert.equal(requests.length,3);assert.deepEqual(unexpected,[]);
 }finally{gate.resolve();if(mf)await mf.dispose();}
});
