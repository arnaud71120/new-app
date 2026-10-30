import test from 'node:test';
import assert from 'node:assert/strict';
import {Response as WorkerResponse} from 'miniflare';
import {runtime,token} from './runtime-server.mjs';
import {ACCESS_CONFIG} from '../worker/index.js';

const host='discovery.cyberveille.org';
const sourceURL='https://'+host+'/';
const feedURL=sourceURL+'feed.xml';
const page='<!doctype html><html><head><title>Cyberveille Discovery</title><link rel="alternate" type="application/rss+xml" title="Actualités Cyberveille Discovery" href="/feed.xml"></head><body>Site public de découverte.</body></html>';
const rss='<?xml version="1.0"?><rss version="2.0"><channel><title>Cyberveille Discovery</title><link>'+sourceURL+'</link><description>Flux de recette locale</description><item><title>Publication de recette</title><link>'+sourceURL+'news/latest</link><description>Publication de test sans appel fournisseur.</description><pubDate>Thu, 29 Oct 2026 10:00:00 GMT</pubDate></item></channel></rss>';
const json=value=>WorkerResponse.json(value);
async function signedReader(){
 const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
 const key={...await crypto.subtle.exportKey('jwk',pair.publicKey),kid:'source-search-runtime-reader',alg:'RS256',use:'sig'},encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url'),now=Math.floor(Date.now()/1000);
 const input=encode({alg:'RS256',kid:key.kid})+'.'+encode({iss:ACCESS_CONFIG.issuer,aud:[ACCESS_CONFIG.audience],email:'reader-source-search@example.com',type:'app',iat:now-10,exp:now+3600});
 const signature=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',pair.privateKey,new TextEncoder().encode(input));
 return {key,jwt:input+'.'+Buffer.from(signature).toString('base64url')};
}
function client(mf){return async(path,{body,auth=token,origin='http://localhost',headers={}}={})=>{
 const response=await mf.dispatchFetch('http://localhost'+path,{method:body!==undefined?'POST':'GET',headers:{...(auth?{Authorization:'Bearer '+auth}:{}),...(body!==undefined?{Origin:origin,'Content-Type':'application/json'}:{}),...headers},...(body!==undefined?{body:JSON.stringify(body)}:{})});
 assert.match(response.headers.get('Content-Type')||'',/application\/json/);
 return {status:response.status,body:await response.json()};
};}

// The outbound callback is the only external service. An unexpected destination
// produces a failure fixture, never a real network connection or provider call.
test('Runtime Cloudflare : recherche, contrôle des flux et des profils sans modifier la configuration',{timeout:20000},async()=>{
 const reader=await signedReader(),outbound=[],unexpected=[];let mf;
 try{
  mf=await runtime(0,{bindings:{EXTERNAL_CALLS_PAUSED:'false'},outboundService:async request=>{
   const url=new URL(request.url);outbound.push(url.href);
   if(url.href===ACCESS_CONFIG.issuer+'/cdn-cgi/access/certs')return json({keys:[reader.key]});
   if(url.hostname==='html.duckduckgo.com'&&url.pathname==='/html/'){
    if(/zataz/i.test(url.searchParams.get('q')||''))return new WorkerResponse('Search temporarily blocked',{status:403});
    const destination=/linkedin/i.test(url.searchParams.get('q')||'')?'https://www.linkedin.com/in/discovery-missing/':/(?:x\.com|twitter\.com)/i.test(url.searchParams.get('q')||'')?'https://x.com/cyberveille_fr':sourceURL;
    return new WorkerResponse('<html><body><a class="result__a" href="//duckduckgo.com/l/?uddg='+encodeURIComponent(destination)+'">Cyberveille Discovery</a></body></html>',{headers:{'Content-Type':'text/html;charset=utf-8'}});
   }
   if(url.hostname===host){
    if(url.pathname==='/')return new WorkerResponse(page,{headers:{'Content-Type':'text/html;charset=utf-8'}});
    if(url.pathname==='/feed.xml')return new WorkerResponse(rss,{headers:{'Content-Type':'application/rss+xml;charset=utf-8'}});
    return new WorkerResponse('Not found',{status:404});
   }
   if(url.hostname==='x.com')return new WorkerResponse('<html>Login required</html>',{status:403,headers:{'Content-Type':'text/html'}});
   if(url.hostname==='www.linkedin.com')return new WorkerResponse('Profile not found',{status:404});
   unexpected.push(url.hostname);return new WorkerResponse('Unexpected outbound request',{status:599});
  }});
  const call=client(mf);
  assert.equal((await call('/api/source-search?platform=site&q=discovery',{auth:null})).status,401);
  const readerReply=await call('/api/source-search?platform=site&q=discovery',{auth:null,headers:{'Cf-Access-Jwt-Assertion':reader.jwt}});
  const readerStatus=readerReply.status===403?null:await call('/api/status',{auth:null,headers:{'Cf-Access-Jwt-Assertion':reader.jwt}});assert.equal(readerReply.status,403,JSON.stringify({reply:readerReply.body,diagnostic:readerStatus?.body.accessDiagnostic,outbound}));
  const access=await call('/api/status',{auth:null,headers:{'Cf-Access-Jwt-Assertion':reader.jwt}});assert.equal(access.body.access,true);assert.equal(access.body.accessDiagnostic.code,'verified');assert.ok(outbound.includes(ACCESS_CONFIG.issuer+'/cdn-cgi/access/certs'));
  const parts=reader.jwt.split('.');parts[2]=(parts[2][0]==='A'?'B':'A')+parts[2].slice(1);assert.equal((await call('/api/source-search?platform=site&q=discovery',{auth:null,headers:{'Cf-Access-Jwt-Assertion':parts.join('.')}})).status,401);
  const before=await call('/api/admin');assert.equal(before.status,200);
  assert.equal((await call('/api/source-search?platform=invalid&q=discovery')).status,400);
  assert.equal((await call('/api/source-search',{body:{platform:'site',url:sourceURL},origin:'https://evil.example'})).status,403);
  const large=await call('/api/source-search',{body:{platform:'site',url:sourceURL,padding:'x'.repeat(5000)}});assert.ok([400,413].includes(large.status));

  const search=await call('/api/source-search?platform=site&q=discovery');assert.equal(search.status,200);assert.ok(['ok','partial'].includes(search.body.status));
  assert.ok(search.body.results.some(result=>result.url===sourceURL&&result.origin==='web'));
  assert.ok(outbound.some(value=>new URL(value).hostname==='html.duckduckgo.com'));
  const verified=await call('/api/source-search',{body:{platform:'site',url:sourceURL}});assert.equal(verified.status,200);assert.equal(verified.body.status,'verified');assert.equal(verified.body.feedUrl,feedURL);
  assert.ok(outbound.includes(feedURL));

  const xSearch=await call('/api/source-search?platform=x&q=cyberveille');assert.equal(xSearch.status,200);assert.ok(xSearch.body.results.some(result=>result.platform==='x'&&result.url.includes('x.com/cyberveille_fr')));
  const profile=await call('/api/source-search',{body:{platform:'x',url:'https://x.com/cyberveille_fr'}});assert.equal(profile.status,200);assert.equal(profile.body.status,'unverified');assert.equal(profile.body.httpStatus,403);assert.equal(profile.body.collectionTested,false);
  const missing=await call('/api/source-search',{body:{platform:'linkedin',url:'https://www.linkedin.com/in/discovery-missing/'}});assert.ok([200,404].includes(missing.status));assert.equal(missing.body.status,'error');assert.equal(missing.body.httpStatus,404);
  const blocked=await call('/api/source-search?platform=site&q=zataz');assert.equal(blocked.status,200);assert.equal(blocked.body.status,'partial');assert.ok(blocked.body.results.some(result=>result.origin==='catalog'&&/zataz/i.test(result.name)));

  const callsBeforePrivate=outbound.length;
  for(const url of ['https://127.0.0.1/','https://service.internal./']){
   const rejected=await call('/api/source-search',{body:{platform:'site',url}});assert.ok([200,400].includes(rejected.status));assert.ok(['error','unverified'].includes(rejected.body.status)||rejected.status===400);
  }
  assert.equal(outbound.length,callsBeforePrivate,'Une adresse privée ne doit pas être téléchargée.');
  const after=await call('/api/admin');assert.equal(after.body.revision,before.body.revision);assert.deepEqual(after.body.configuration,before.body.configuration);
  assert.deepEqual(unexpected,[]);assert.ok(outbound.every(value=>!/(?:generativelanguage|brightdata)/i.test(new URL(value).hostname)));
  assert.equal((await call('/api/admin',{body:{action:'pause',target:'externalPaused',value:true,revision:after.body.revision}})).status,200);
  const pausedConfig=await call('/api/admin'),callsBeforePause=outbound.length;
  const pausedSearch=await call('/api/source-search?platform=site&q=zataz');assert.equal(pausedSearch.status,200);assert.equal(pausedSearch.body.status,'paused');assert.ok(pausedSearch.body.results.some(result=>result.origin==='catalog'));
  const pausedProfile=await call('/api/source-search',{body:{platform:'x',url:'https://x.com/cyberveille_fr'}});assert.equal(pausedProfile.status,200);assert.equal(pausedProfile.body.status,'unverified');assert.equal(outbound.length,callsBeforePause);
  const afterPauseSearch=await call('/api/admin');assert.deepEqual(afterPauseSearch.body.configuration,pausedConfig.body.configuration);
 }finally{if(mf)await mf.dispose();}
});

test('Runtime Cloudflare : pause globale conserve le catalogue local sans recherche ni vérification réseau',{timeout:20000},async()=>{
 const outbound=[];let mf;
 try{
  mf=await runtime(0,{outboundService:request=>{outbound.push(request.url);return new WorkerResponse('Network forbidden during pause',{status:599});}});
  const call=client(mf),before=await call('/api/admin');
  const search=await call('/api/source-search?platform=site&q=zataz');assert.equal(search.status,200);assert.equal(search.body.status,'paused');assert.ok(search.body.results.some(result=>result.origin==='catalog'&&/zataz/i.test(result.name)));
  const verify=await call('/api/source-search',{body:{platform:'site',url:sourceURL}});assert.equal(verify.status,200);assert.equal(verify.body.status,'unverified');
  const after=await call('/api/admin');assert.equal(after.body.revision,before.body.revision);assert.deepEqual(after.body.configuration,before.body.configuration);assert.deepEqual(outbound,[]);
 }finally{if(mf)await mf.dispose();}
});


test('Runtime Cloudflare : le JWKS épinglé ne suit aucune redirection externe',{timeout:20000},async()=>{
 const reader=await signedReader(),outbound=[];let mf;
 try{
  mf=await runtime(0,{outboundService:request=>{outbound.push(request.url);return new WorkerResponse(null,{status:302,headers:{Location:'https://untrusted.cyberveille.org/certs'}});}});
  const call=client(mf),response=await call('/api/source-search?platform=site&q=discovery',{auth:null,headers:{'Cf-Access-Jwt-Assertion':reader.jwt}});
  assert.equal(response.status,503);assert.equal(response.body.code,'jwks_unavailable');assert.deepEqual(outbound,[ACCESS_CONFIG.issuer+'/cdn-cgi/access/certs']);
 }finally{if(mf)await mf.dispose();}
});
