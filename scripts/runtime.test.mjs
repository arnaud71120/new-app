import test from 'node:test';import assert from 'node:assert/strict';import {runtime,token} from './runtime-server.mjs';
test('Runtime Cloudflare : transactions, conflits, sauvegardes, isolation et synchronisation',async()=>{const mf=await runtime();try{
 const call=async(path,body,auth=token)=>{const response=await mf.dispatchFetch('http://localhost'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+auth,...(body?{Origin:'http://localhost','Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,body:await response.json()};};
 assert.equal((await call('/api/admin',null,'invalid')).status,401);
 let admin=await call('/api/admin');assert.equal(admin.status,200);assert.equal(admin.body.role,'admin');const rev=admin.body.revision;
 assert.equal((await call('/api/admin',{action:'pause',target:'feedsPaused',value:true,revision:rev})).status,200);
 assert.equal((await call('/api/admin',{action:'pause',target:'feedsPaused',value:false,revision:rev})).status,409);
 assert.equal((await call('/api/admin',{action:'pause',target:'socialPaused',value:true,revision:rev+1})).status,200);
 assert.ok((await call('/api/operations')).body.backups.length>=1);
 let user=await call('/api/user');assert.equal(user.body.revision,0);
 assert.equal((await call('/api/user',{action:'watchlist',items:['CVE-2026','Defender'],revision:0})).status,200);
 assert.equal((await call('/api/user',{action:'watchlist',items:[],revision:0})).status,409);
 assert.deepEqual((await call('/api/user')).body.watchlist,['CVE-2026','Defender']);
 assert.equal((await call('/api/user',{action:'bookmark',event:{id:'x',title:'Archive durable',url:'https://www.cert.ssi.gouv.fr/alerte/',date:'2026-10-20'},revision:1})).status,200);
 assert.equal((await call('/api/user')).body.bookmarks.x.title,'Archive durable');
 const feed=await call('/api/feed');assert.equal(feed.body.paused,true);
 const page=await mf.dispatchFetch('http://localhost/');assert.ok((await page.text()).length<260000);
 }finally{await mf.dispose();}});

test('Runtime Cloudflare : restauration réelle et clés Push privées autogérées',async()=>{const mf=await runtime();try{
 const call=async(path,body,origin='http://localhost')=>{const response=await mf.dispatchFetch('http://localhost'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,...(body?{Origin:origin,'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,body:await response.json()};};
 let config=await call('/api/admin');let revision=config.body.revision;
 const source={id:'custom-runtime-restore',name:'Source de restauration',url:'https://www.cert.ssi.gouv.fr/feed/',home:'https://www.cert.ssi.gouv.fr/',enabled:true,language:'fr',intervalMinutes:60};
 assert.equal((await call('/api/admin',{action:'save',revision:revision++,source})).status,200);
 assert.equal((await call('/api/admin',{action:'delete',revision:revision++,id:source.id})).status,200);
 assert.ok(!(await call('/api/admin')).body.sources.some(s=>s.id===source.id));const backup=(await call('/api/operations')).body.backups[0];assert.ok(backup.id);
 assert.equal((await call('/api/admin',{action:'restore-backup',revision:revision++,backupId:backup.id})).status,200);
 assert.ok((await call('/api/admin')).body.sources.some(s=>s.id===source.id));
 const push=await call('/api/push');assert.equal(push.status,200);assert.equal(push.body.ready,true);assert.match(push.body.publicKey,/^[A-Za-z0-9_-]{87}$/);assert.equal(push.body.count,0);for(const secret of ['d','privateKey','jwk','WEB_PUSH_PRIVATE_JWK'])assert.ok(!Object.hasOwn(push.body,secret));
 assert.equal((await call('/api/push',{action:'subscribe',subscription:{endpoint:'https://localhost/private'}})).status,400);
 const endpoint='https://updates.push.services.mozilla.com/wpush/v2/runtime-subscription-fixture';
 assert.equal((await call('/api/push',{action:'subscribe',subscription:{endpoint,expirationTime:null}},'https://evil.example')).status,403);
 assert.equal((await call('/api/push',{action:'subscribe',subscription:{endpoint,expirationTime:null}})).status,200);
 assert.equal((await call('/api/push')).body.count,1);assert.equal((await call('/api/push')).body.publicKey,push.body.publicKey);
 assert.equal((await call('/api/push',{action:'unsubscribe',endpoint})).status,200);assert.equal((await call('/api/push')).body.count,0);
 }finally{await mf.dispose();}});
