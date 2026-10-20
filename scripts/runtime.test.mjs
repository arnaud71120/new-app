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
