import {test,expect} from '@playwright/test';
const owner='local-runtime-test-owner-token-2026',endpoint='**/api/sync**',storageKey='cyberveille-sync-job';let client=150;
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
async function open(page){
 await page.context().setExtraHTTPHeaders({'CF-Connecting-IP':'203.0.113.'+(++client)});
 await page.addInitScript(token=>sessionStorage.setItem('cyberveille-access',token),owner);
 await page.goto('/');await expect(page.locator('#sync-now')).toBeVisible();await page.waitForFunction(()=>connectionState==='connected');
}
function complete(jobId,platform='all',overrides={}){return {jobId,platform,status:'complete',result:{platforms:Object.fromEntries((platform==='all'?['x','linkedin']:[platform]).map(name=>[name,{status:'ready',message:'Résultat reçu.',pending:false,count:5,newCount:2}]))},...overrides};}
async function queue(route,body){await route.fulfill({status:202,json:{jobId:body.requestId,platform:body.platform,status:'queued',retryAfterSeconds:0.5}});}

test('Le bouton lance immédiatement une seule demande et suit son exécution',async({page})=>{
 const posts=[];let polls=0;
 await page.route(endpoint,async route=>{
  if(route.request().method()==='POST'){const body=route.request().postDataJSON();posts.push(body);await queue(route,body);return;}
  const jobId=new URL(route.request().url()).searchParams.get('jobId');polls++;
  await route.fulfill({json:polls===1?{jobId,platform:'all',status:'running',retryAfterSeconds:0.5}:complete(jobId)});
 });
 await open(page);await page.locator('#sync-now').evaluate(button=>{button.click();button.click();});
 await expect(page.locator('#sync-now')).toBeDisabled();await expect(page.locator('#sync-progress')).toContainText('démarrage en attente');
 await expect(page.locator('#sync-progress')).toHaveAttribute('data-tone','complete');
 expect(posts).toHaveLength(1);expect(posts[0]).toMatchObject({platform:'all'});expect(posts[0].requestId).toMatch(uuid);expect(polls).toBe(2);
 await expect(page.locator('#sync-progress')).toContainText('X / Twitter');await expect(page.locator('#sync-progress')).toContainText('LinkedIn');await expect(page.locator('#sync-progress')).toContainText('2 nouvelle(s)');
 await expect(page.locator('#sync-now')).toBeEnabled();expect(await page.evaluate(key=>sessionStorage.getItem(key),storageKey)).toBeNull();
});

test('Les commandes de l’administration ciblent X ou LinkedIn sans perdre les brouillons',async({page})=>{
 const posts=[];
 await page.route(endpoint,async route=>{if(route.request().method()==='POST'){const body=route.request().postDataJSON();posts.push(body);await queue(route,body);return;}const id=new URL(route.request().url()).searchParams.get('jobId');await route.fulfill({json:complete(id,posts.at(-1).platform)});});
 await open(page);await page.locator('#admin-open').click();await expect(page.locator('#admin-content')).toContainText('sources au catalogue');
 await page.locator('[data-admin-tab="profiles"]').click();const name=page.locator('[data-profile-name]').first();await name.fill('Brouillon à conserver');
 await page.locator('#admin-content [data-sync-platform="x"]').click();await expect(page.locator('#admin-content [data-sync-status]')).toHaveAttribute('data-tone','complete');
 await expect(name).toHaveValue('Brouillon à conserver');
 await page.locator('#admin-content [data-sync-platform="linkedin"]').click();await expect.poll(()=>posts.length).toBe(2);await expect(page.locator('#admin-content [data-sync-status]')).toHaveAttribute('data-tone','complete');
 expect(posts.map(row=>row.platform)).toEqual(['x','linkedin']);await expect(name).toHaveValue('Brouillon à conserver');
 await page.locator('[data-admin-tab="services"]').click();await expect(page.locator('#admin-content [data-sync-platform="x"]')).toBeVisible();await expect(page.locator('#admin-content [data-sync-platform="linkedin"]')).toBeVisible();
});

test('Une collecte fournisseur en attente reste en cours après la fin de la commande',async({page})=>{
 let body;
 await page.route(endpoint,async route=>{if(route.request().method()==='POST'){body=route.request().postDataJSON();await queue(route,body);return;}await route.fulfill({json:complete(body.requestId,'all',{result:{platforms:{x:{status:'started',pending:true,count:0,newCount:0,message:'Snapshot déjà en cours.'},linkedin:{status:'paused',pending:false,message:'Collecte LinkedIn suspendue.'}}}})});});
 await open(page);await page.locator('#sync-now').click();
 await expect(page.locator('#sync-progress')).toContainText('action nécessaire');await expect(page.locator('#sync-progress')).toContainText('collecte encore en cours');await expect(page.locator('#sync-progress')).toContainText('suspendue');await expect(page.locator('#sync-progress')).toHaveAttribute('data-tone','warning');
 await expect(page.locator('#sync-progress')).not.toHaveAttribute('data-tone','complete');await expect(page.locator('#sync-progress')).not.toContainText('à jour');await expect(page.locator('#sync-progress')).not.toContainText('0 nouvelle(s)');
});

test('Une collecte incertaine reste un avertissement même si le fournisseur a une demande en attente',async({page})=>{
 let requestId;
 await page.route(endpoint,async route=>{if(route.request().method()==='POST'){const body=route.request().postDataJSON();requestId=body.requestId;await queue(route,body);return;}await route.fulfill({json:complete(requestId,'x',{result:{platforms:{x:{status:'uncertain',pending:true,count:0,newCount:0,code:'sync_uncertain',message:'Le lancement doit être vérifié chez le fournisseur.'}}}})});});
 await open(page);await page.locator('#sync-now').click();
 await expect(page.locator('#sync-progress')).toHaveAttribute('data-tone','warning');
 await expect(page.locator('#sync-progress')).toContainText('action nécessaire');
 await expect(page.locator('#sync-progress')).toContainText('doit être vérifié');
 await expect(page.locator('#sync-progress')).not.toContainText('fournisseur collecte encore');
});

test('Une réponse POST perdue se récupère par GET sans relancer la collecte',async({page})=>{
 const posts=[];let gets=0;
 await page.route(endpoint,async route=>{if(route.request().method()==='POST'){posts.push(route.request().postDataJSON());await route.abort('failed');return;}gets++;await route.fulfill({json:complete(posts[0].requestId)});});
 await open(page);await page.locator('#sync-now').click();
 await expect(page.locator('#sync-progress')).toContainText('Reprenez le suivi');await expect(page.locator('#sync-now')).toHaveText('Reprendre le suivi');
 const saved=await page.evaluate(key=>JSON.parse(sessionStorage.getItem(key)),storageKey);expect(saved.requestId).toBe(posts[0].requestId);expect(gets).toBe(0);
 await page.locator('#sync-now').click();await expect(page.locator('#sync-progress')).toHaveAttribute('data-tone','complete');expect(posts).toHaveLength(1);expect(gets).toBe(1);
});

test('Une demande absente peut être renvoyée manuellement avec le même identifiant',async({page})=>{
 const posts=[];let gets=0;
 await page.route(endpoint,async route=>{
  if(route.request().method()==='POST'){const body=route.request().postDataJSON();posts.push(body);if(posts.length===1)await route.abort('failed');else await queue(route,body);return;}
  gets++;await route.fulfill(gets===1?{status:404,json:{error:'Demande absente.',code:'sync_job_not_found'}}:{json:complete(posts.at(-1).requestId)});
 });
 await open(page);await page.locator('#sync-now').click();await expect(page.locator('#sync-now')).toHaveText('Reprendre le suivi');await page.locator('#sync-now').click();
 await expect(page.locator('#sync-now')).toHaveText('Réessayer la même demande');await expect(page.locator('#sync-progress')).toContainText('Aucune demande retrouvée');expect(posts).toHaveLength(1);
 await page.locator('#sync-now').click();await expect(page.locator('#sync-progress')).toHaveAttribute('data-tone','complete');expect(posts).toHaveLength(2);expect(posts[1]).toEqual(posts[0]);
});

test('Les refus de droit, de budget et de pause gardent leur diagnostic sans afficher un succès',async({page})=>{
 const failures=[{status:403,code:'admin_required',error:'Droit administrateur requis.'},{status:429,code:'sync_budget_exhausted',error:'Enveloppe gratuite épuisée.'},{status:409,code:'owner_paused',error:'Appels externes suspendus.'}];let posts=0,gets=0;
 await page.route(endpoint,async route=>{if(route.request().method()==='GET'){gets++;await route.fulfill({status:404,json:{error:'Aucune demande.'}});return;}const failure=failures[posts++];await route.fulfill({status:failure.status,json:{...failure,requestId:'sync-error-'+posts,service:'synchronization',stage:'permissions'}});});
 await open(page);
 for(let i=0;i<failures.length;i++){await page.locator('#sync-now').click();await expect(page.locator('#sync-progress')).toContainText(failures[i].error);await expect(page.locator('#sync-progress')).toContainText('Référence : sync-error-'+(i+1));await expect(page.locator('#sync-progress')).toHaveAttribute('data-tone','error');await expect(page.locator('#sync-now')).toHaveText('Synchroniser maintenant');}
 expect(posts).toBe(3);expect(gets).toBe(0);
});

test('Un travail en cours réutilisé affiche et suit sa portée réelle',async({page})=>{
 const actual='11111111-1111-4111-8111-111111111111';let followed;
 await page.route(endpoint,async route=>{if(route.request().method()==='POST'){expect(route.request().postDataJSON().platform).toBe('all');await route.fulfill({status:202,json:{jobId:actual,platform:'x',status:'running',retryAfterSeconds:0.5,message:'La demande X existante est suivie.'}});return;}followed=new URL(route.request().url()).searchParams.get('jobId');await route.fulfill({json:complete(actual,'x')});});
 await open(page);await page.locator('#sync-now').click();await expect(page.locator('#sync-progress')).toHaveAttribute('data-tone','complete');expect(followed).toBe(actual);await expect(page.locator('#sync-progress')).toContainText('X / Twitter');await expect(page.locator('#sync-progress')).not.toContainText('LinkedIn');
});

test('La fermeture de session efface le suivi et ignore une ancienne réponse',async({page})=>{
 let routePending,markStarted;const started=new Promise(resolve=>markStarted=resolve);let body;
 await page.route(endpoint,async route=>{if(route.request().method()==='POST'){body=route.request().postDataJSON();await queue(route,body);return;}routePending=route;markStarted();});
 await open(page);await page.locator('#sync-now').click();await started;await page.evaluate(()=>clearPrivateSession());
 await routePending.fulfill({json:complete(body.requestId)}).catch(()=>{});await page.waitForTimeout(100);
 await expect(page.locator('#sync-progress')).toBeHidden();expect(await page.evaluate(key=>sessionStorage.getItem(key),storageKey)).toBeNull();await expect(page.locator('#sync-now')).toBeEnabled();
});


test('Une demande expirée libère le bouton sans créer automatiquement une autre collecte',async({page})=>{
 const posts=[];
 await page.route(endpoint,async route=>{if(route.request().method()==='POST'){const body=route.request().postDataJSON();posts.push(body);await queue(route,body);return;}await route.fulfill({status:410,json:{error:'Demande expirée.',code:'sync_job_expired'}});});
 await open(page);await page.locator('#sync-now').click();await expect(page.locator('#sync-progress')).toContainText('La demande a expiré');await expect(page.locator('#sync-now')).toHaveText('Synchroniser maintenant');expect(posts).toHaveLength(1);
 await page.locator('#sync-now').click();await expect.poll(()=>posts.length).toBe(2);expect(posts[1].requestId).not.toBe(posts[0].requestId);
});

test('Le bouton du diagnostic LinkedIn utilise également la synchronisation immédiate',async({page})=>{
 const posts=[];let legacyPosts=0;
 const health={summary:{green:0,orange:0,red:1},scope:'Recette du diagnostic',checks:[{id:'linkedin',name:'LinkedIn',state:'red',code:'import_error',message:'Ancien résultat vide.'}]};
 await page.route('**/api/health',route=>route.fulfill({json:health}));
 await page.route('**/api/social/linkedin',async route=>{if(route.request().method()==='POST')legacyPosts++;await route.fulfill({json:{articles:[],platforms:{}}});});
 await page.route(endpoint,async route=>{if(route.request().method()==='POST'){const body=route.request().postDataJSON();posts.push(body);await queue(route,body);return;}await route.fulfill({json:complete(posts[0].requestId,'linkedin')});});
 await open(page);await page.evaluate(value=>{view='sources';healthData=value;render();renderHealth();},health);
 const button=page.locator('#health-results [data-sync-platform="linkedin"]');await expect(button).toBeVisible();await expect(page.locator('[data-social-retry]')).toHaveCount(0);await button.click();
 await expect(page.locator('#sync-progress')).toHaveAttribute('data-tone','complete');expect(posts.map(row=>row.platform)).toEqual(['linkedin']);expect(legacyPosts).toBe(0);
});
