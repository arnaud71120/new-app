import {test,expect} from '@playwright/test';

const eventA='cve:CVE-2026-44211',eventB='cve:CVE-2026-44212';
const json=(route,value,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(value)});
const complete=(jobId,text)=>({jobId,status:'complete',stage:'complete',result:{text,model:'gemini-job-fixture',provider:'gemini',generatedAt:new Date().toISOString()}});
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};

async function openAnalysisSelection(page){
 await page.evaluate(({idA,idB})=>{
  const make=(id,title)=>{const article={id,url:'https://www.cert.ssi.gouv.fr/alerte/'+encodeURIComponent(id)+'/',title,summary:'Une publication pour vérifier cette analyse et la reprise de sa réponse.',date:new Date().toISOString(),source:'CERT-FR',sourceId:'cert-fr',language:'fr',score:60,type:'Vulnérabilité',reasons:['Publication de test'],cves:[id.replace('cve:','')],references:[]};return {...article,articles:[article]};};
  data={mode:'live',sources:[],events:[make(idA,'Publication française A'),make(idB,'Publication française B')]};ai=true;accessToken='cloudflare-access';translationPaused=true;openDetail(idA);
 },{idA:eventA,idB:eventB});
}

async function analysisFixture(page,handler){
 const errors=[],unexpected=[],posts=[],polls=[];page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>{
  localStorage.setItem('cyberveille-ai-workload','manual');window.__finishedAnalysisResponses=0;
  const nativeFetch=window.fetch.bind(window);window.fetch=async(url,options)=>{
   const response=await nativeFetch(url,options);
   if(String(url).includes('/api/analysis')){const original=response.json.bind(response);response.json=async()=>{const value=await original();if(value.status==='complete')window.__finishedAnalysisResponses++;return value;};}
   return response;
  };
 });
 await page.route('**/api/**',async route=>{
  const request=route.request(),url=new URL(request.url()),path=url.pathname;
  if(path==='/api/status')return json(route,{ai:true,gemini:true,geminiConfigured:true,geminiModel:'gemini-2.5-flash',access:true,accessDiagnostic:{code:'verified',source:'header'},protected:true,role:'admin'});
  if(path==='/api/session')return json(route,{ok:true,access:true,token:'cloudflare-access'});
  if(path==='/api/feed')return json(route,{events:[],sources:[],mode:'live',pendingSources:0,totalSources:0,updatedAt:new Date().toISOString()});
  if(path.startsWith('/api/social'))return json(route,{articles:[],configured:false,freeOnlyConfirmed:false,storage:true,platforms:{}});
  if(path==='/api/user')return json(route,{revision:0,bookmarks:{},notes:{},read:[],watchlist:[],progress:[],preferences:{},cases:{},alerts:[]});
  if(path==='/api/analysis'){
   const body=request.method()==='POST'?request.postDataJSON():null;
   if(body)posts.push(body);else polls.push(url.searchParams.get('jobId'));
   return handler({route,method:request.method(),body,url,posts,polls});
  }
  unexpected.push(path);return json(route,{error:'Unexpected route in analysis job regression fixture'},500);
 });
 await page.goto('/');await page.waitForFunction(()=>connectionState==='connected'&&!feedLoading&&!socialLoading);
 await openAnalysisSelection(page);
 await expect(page.locator('#detail')).toBeVisible();return {errors,unexpected,posts,polls};
}

function assertStableRequests(posts){expect(posts.length).toBeGreaterThan(0);for(const body of posts){expect(body.requestId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);expect(body.eventId).toBe(eventA);}expect(new Set(posts.map(body=>body.requestId)).size).toBe(1);}
function assertClean(fixture){expect(fixture.errors).toEqual([]);expect(fixture.unexpected).toEqual([]);}

// The server has accepted the job, but its acknowledgement is lost at the edge.
test('Un POST reçu puis remplacé par HTML503 reprend le même job sans nouvelle génération',async({page})=>{
 const accepted=new Set();let generations=0,postAttempts=0;
 const fixture=await analysisFixture(page,({route,method,body,url})=>{
  if(method==='POST'){
   postAttempts++;if(!accepted.has(body.requestId)){accepted.add(body.requestId);generations++;}
   if(postAttempts===1)return route.fulfill({status:503,contentType:'text/html',headers:{'CF-Ray':'a4f02555a2ce1e4-MRS'},body:'<html><title>Service unavailable</title>Cloudflare gateway unavailable</html>'});
  }
  return json(route,complete(body?.requestId||url.searchParams.get('jobId'),'Analyse retrouvée après accusé perdu.'));
 });
 await page.locator('#explain').click();await expect(page.locator('#ai-result')).toContainText('503');await expect(page.locator('#explain')).toBeEnabled();
 expect(generations).toBe(1);await page.locator('#explain').click();await expect(page.locator('#ai-result')).toContainText('Analyse retrouvée après accusé perdu.');
 assertStableRequests(fixture.posts);expect(generations).toBe(1);assertClean(fixture);
});

test('Une panne503 pendant le suivi conserve le job et reprend son résultat',async({page})=>{
 const accepted=new Set();let generations=0,pollAttempts=0;
 const fixture=await analysisFixture(page,({route,method,body,url})=>{
  if(method==='POST'){if(!accepted.has(body.requestId)){accepted.add(body.requestId);generations++;}return json(route,{jobId:body.requestId,status:'queued',stage:'queued'},202);}
  pollAttempts++;if(pollAttempts===1)return route.fulfill({status:503,contentType:'text/html',body:'<html><title>Service unavailable</title>Gateway unavailable</html>'});
  return json(route,complete(url.searchParams.get('jobId'),'Résultat récupéré sans renvoi au fournisseur.'));
 });
 await page.locator('#explain').click();await expect(page.locator('#ai-result')).toContainText('503');await expect(page.locator('#explain')).toBeEnabled();
 await page.locator('#explain').click();await expect(page.locator('#ai-result')).toContainText('Résultat récupéré sans renvoi au fournisseur.');
 assertStableRequests(fixture.posts);expect(generations).toBe(1);expect(new Set(fixture.polls)).toEqual(new Set([fixture.posts[0].requestId]));assertClean(fixture);
});

test('Un doubleclic ne crée qu’une demande pendant le démarrage du job',async({page})=>{
 const started=deferred(),release=deferred();let generations=0;
 const fixture=await analysisFixture(page,async({route,method,body,url})=>{
  if(method==='POST'){generations++;started.resolve();await release.promise;return json(route,{jobId:body.requestId,status:'queued',stage:'queued'},202);}
  return json(route,complete(url.searchParams.get('jobId'),'Une seule analyse après doubleclic.'));
 });
 await page.locator('#explain').dblclick();await started.promise;await expect(page.locator('#explain')).toBeDisabled();expect(fixture.posts).toHaveLength(1);
 release.resolve();await expect(page.locator('#ai-result')).toContainText('Une seule analyse après doubleclic.');expect(generations).toBe(1);assertClean(fixture);
});

test('Le résultat d’une analyse A ne remplace jamais le contenu de la fiche B',async({page})=>{
 const pollingA=deferred(),releaseA=deferred(),eventByJob=new Map();
 const fixture=await analysisFixture(page,async({route,method,body,url})=>{
  if(method==='POST'){eventByJob.set(body.requestId,body.eventId);return json(route,{jobId:body.requestId,status:'queued',stage:'queued'},202);}
  if(eventByJob.get(url.searchParams.get('jobId'))===eventA){pollingA.resolve();await releaseA.promise;return json(route,complete(url.searchParams.get('jobId'),'RESULTAT_RESERVE_A'));}
  return json(route,complete(url.searchParams.get('jobId'),'RESULTAT_RESERVE_B'));
 });
 await page.locator('#explain').click();await pollingA.promise;await page.locator('#close').click();await page.evaluate(id=>openDetail(id),eventB);
 await expect(page.locator('#detail-title')).toHaveText('Publication française B');
 await page.evaluate(()=>{window.__analysisContamination=[];new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)if(node.textContent.includes('RESULTAT_RESERVE_A'))window.__analysisContamination.push(node.textContent);}).observe(document.querySelector('#ai-result'),{childList:true,subtree:true,characterData:true});});
 await page.locator('#explain').click();await expect(page.locator('#explain')).toBeDisabled();releaseA.resolve();
 await expect(page.locator('#ai-result')).toContainText('RESULTAT_RESERVE_B');await expect(page.locator('#detail-title')).toHaveText('Publication française B');
 expect(await page.evaluate(()=>window.__analysisContamination)).toEqual([]);expect(fixture.posts).toHaveLength(2);expect(new Set(fixture.posts.map(post=>post.eventId))).toEqual(new Set([eventA,eventB]));assertClean(fixture);
});

test('Le suivi rend visibles les étapes de préparation et de génération',async({page})=>{
 const generating=deferred(),finished=deferred();let polls=0;
 const fixture=await analysisFixture(page,async({route,method,body,url})=>{
  if(method==='POST')return json(route,{jobId:body.requestId,status:'queued',stage:'queued'},202);
  polls++;if(polls===1)return json(route,{jobId:url.searchParams.get('jobId'),status:'preparing',stage:'resolving_sources'});
  if(polls===2){await generating.promise;return json(route,{jobId:url.searchParams.get('jobId'),status:'generating',stage:'calling_provider'});}
  await finished.promise;return json(route,complete(url.searchParams.get('jobId'),'Analyse achevée avec étapes visibles.'));
 });
 await page.locator('#explain').click();await expect(page.locator('#ai-result')).toContainText(/extraits enregistrés/i);
 generating.resolve();await expect(page.locator('#ai-result')).toContainText('Gemini prépare votre analyse');
 finished.resolve();await expect(page.locator('#ai-result')).toContainText('Analyse achevée avec étapes visibles.');assertClean(fixture);
});

test('Une vraie401 permet de vérifier la session sans rejouer le job automatiquement',async({page})=>{
 let attempts=0,generations=0;
 const fixture=await analysisFixture(page,({route,method,body,url})=>{
  if(method==='POST'){attempts++;if(attempts===1)return json(route,{error:'Une nouvelle connexion est nécessaire.',code:'access_expired'},401);generations++;}
  return json(route,complete(body?.requestId||url.searchParams.get('jobId'),'Analyse après action explicite et session vérifiée.'));
 });
 await page.locator('#explain').click();await expect(page.locator('#ai-result [data-reconnect]')).toBeVisible();expect(generations).toBe(0);
 await page.locator('#ai-result [data-reconnect]').click();await expect(page.locator('#ai-result')).toContainText(/connexion.*vérifi/i);
 expect(fixture.posts).toHaveLength(1);expect(generations).toBe(0);await page.locator('#explain').click();await expect(page.locator('#ai-result')).toContainText('Analyse après action explicite et session vérifiée.');
 expect(generations).toBe(1);assertStableRequests(fixture.posts);assertClean(fixture);
});


for(const interruptedAt of ['post-ack','poll'])test('Le suivi reprend après rechargement et interruption '+interruptedAt+' avec le même identifiant',async({page})=>{
 const accepted=new Set();let generations=0,posts=0,polls=0;
 const fixture=await analysisFixture(page,({route,method,body,url})=>{
  if(method==='POST'){
   posts++;if(!accepted.has(body.requestId)){accepted.add(body.requestId);generations++;}
   if(interruptedAt==='post-ack'&&posts===1)return route.fulfill({status:503,contentType:'text/html',body:'<html><title>Service unavailable</title>Lost acknowledgement</html>'});
   return json(route,{jobId:body.requestId,status:'queued',stage:'queued'},202);
  }
  polls++;if(interruptedAt==='poll'&&polls===1)return route.fulfill({status:503,contentType:'text/html',body:'<html><title>Service unavailable</title>Lost follow-up response</html>'});
  return json(route,complete(url.searchParams.get('jobId'),'Analyse retrouvée après rechargement.'));
 });
 await page.locator('#explain').click();await expect(page.locator('#ai-result')).toContainText('503');await expect(page.locator('#explain')).toBeEnabled();
 const originalId=fixture.posts[0].requestId;expect(generations).toBe(1);
 await page.reload();await page.waitForFunction(()=>connectionState==='connected'&&!feedLoading&&!socialLoading);await openAnalysisSelection(page);
 await page.locator('#explain').click();await expect(page.locator('#ai-result')).toContainText('Analyse retrouvée après rechargement.');
 assertStableRequests(fixture.posts);expect(fixture.posts[1].requestId).toBe(originalId);expect(generations).toBe(1);assertClean(fixture);
});

test('Une issue incertaine conserve la demande et exige confirmation avant un nouvel essai',async({page})=>{
 let initialId=null,generations=0;const accepted=new Set(),confirmations=[];
 const fixture=await analysisFixture(page,({route,method,body,url})=>{
  const id=body?.requestId||url.searchParams.get('jobId');
  if(method==='POST'&&!accepted.has(id)){accepted.add(id);generations++;if(!initialId)initialId=id;}
  if(id===initialId)return json(route,{jobId:id,status:'uncertain',stage:'generating',code:'analysis_uncertain',error:'Issue fournisseur incertaine : aucun nouvel appel automatique.'});
  return json(route,complete(id,'Analyse issue d’une nouvelle demande confirmée.'));
 });
 await page.locator('#explain').click();await expect(page.locator('#ai-result')).toContainText('Issue fournisseur incertaine');await expect(page.locator('#ai-result [data-analysis-new]')).toBeVisible();
 expect(fixture.posts).toHaveLength(1);expect(generations).toBe(1);
 await page.locator('#explain').click();await expect(page.locator('#ai-result')).toContainText('Issue fournisseur incertaine');
 expect(fixture.posts).toHaveLength(2);assertStableRequests(fixture.posts);expect(generations).toBe(1);
 page.on('dialog',async dialog=>{expect(dialog.type()).toBe('confirm');confirmations.push(dialog.message());if(confirmations.length===1)await dialog.dismiss();else await dialog.accept();});
 await page.locator('#ai-result [data-analysis-new]').click();expect(confirmations).toHaveLength(1);expect(fixture.posts).toHaveLength(2);expect(generations).toBe(1);
 await page.locator('#ai-result [data-analysis-new]').click();await expect(page.locator('#ai-result')).toContainText('Analyse issue d’une nouvelle demande confirmée.');
 expect(confirmations).toHaveLength(2);for(const message of confirmations)expect(message).toContain('quota');
 expect(fixture.posts).toHaveLength(3);expect(fixture.posts[0].requestId).toBe(initialId);expect(fixture.posts[1].requestId).toBe(initialId);expect(fixture.posts[2].requestId).not.toBe(initialId);expect(generations).toBe(2);assertClean(fixture);
});
