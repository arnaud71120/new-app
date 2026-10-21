import {test,expect} from '@playwright/test';

const ownerToken='local-runtime-test-owner-token-2026';
const fixtureId='cve:CVE-2026-44211';
const fixtureTitle='Microsoft Defender : une faille de sécurité à vérifier';

async function publicFeed(page){
 const errors=[];page.on('pageerror',error=>{errors.push(error.message);console.error('Navigation page error:',error.message);});
 await page.addInitScript(token=>{sessionStorage.setItem('cyberveille-access',token);localStorage.setItem('cyberveille-ai-workload','manual');},ownerToken);
 await page.route('**/api/feed?*',route=>{
  const article={id:'navigation-source-item',url:'https://www.cert.ssi.gouv.fr/alerte/navigation-fixture/',title:fixtureTitle,summary:'Cette publication pour Microsoft Defender permet de vérifier la recherche et les filtres du fil.',date:new Date().toISOString(),source:'CERT-FR',sourceId:'cert-fr',language:'fr',score:60,type:'Vulnérabilité',topic:'Microsoft',topics:['Microsoft'],technical:false,reasons:['Publication de test'],cves:['CVE-2026-44211'],references:[]};
  return route.fulfill({contentType:'application/json',body:JSON.stringify({mode:'live',events:[{...article,id:fixtureId,articles:[article]}],sources:[{source:'cert-fr',status:'ok',count:1,checkedAt:new Date().toISOString()}],catalog:[{id:'cert-fr',name:'CERT-FR',enabled:true,url:'https://www.cert.ssi.gouv.fr/feed/',language:'fr'}],pendingSources:0,batchSize:4,totalSources:1,updatedAt:new Date().toISOString()})});
 });
 return errors;
}

test('Les filtres, la recherche et le tri sont conservés au rechargement',async({page})=>{
 const errors=await publicFeed(page);await page.goto('/');
 await page.locator('[data-view="feed"]:visible').first().click();
 await page.locator('[data-filter="Microsoft"]').click();await page.locator('#search').fill('Defender');await page.locator('#sort').selectOption('priority');
 await expect(page.locator('#events')).toContainText(fixtureTitle);
 await expect(page).toHaveURL(/sort=priority/);
 await page.reload();
 await expect(page.locator('#search')).toHaveValue('Defender');await expect(page.locator('#sort')).toHaveValue('priority');
 await expect(page.locator('[data-filter="Microsoft"]')).toHaveClass(/active/);await expect(page.locator('#events')).toContainText(fixtureTitle);
 // A clean URL restores the same display preferences from this device.
 await page.goto('/');await expect(page.locator('#search')).toHaveValue('Defender');await expect(page.locator('#sort')).toHaveValue('priority');
 await expect(page.locator('[data-filter="Microsoft"]')).toHaveClass(/active/);expect(errors).toEqual([]);
});

test('Un lien direct ouvre la fiche et le clavier permet de fermer le dialogue',async({page})=>{
 const errors=await publicFeed(page),hash=new URLSearchParams({view:'feed',filter:'Tous',event:fixtureId});
 await page.goto('/#'+hash.toString());
 await expect(page.locator('#detail')).toBeVisible();await expect(page.locator('#detail-title')).toHaveText(fixtureTitle);
 await expect(page.locator('#copy-event-link')).toBeVisible();expect(new URLSearchParams(new URL(page.url()).hash.slice(1)).get('event')).toBe(fixtureId);
 await page.keyboard.press('Escape');await expect(page.locator('#detail')).not.toBeVisible();
 await page.locator('#search').focus();await page.keyboard.press('Tab');await expect(page.locator('#sort')).toBeFocused();
 expect(errors).toEqual([]);
});

test('Une source supprimée peut être restaurée depuis sa sauvegarde puis vérifiée dans l’administration',async({page,request})=>{
 const errors=[];page.on('pageerror',error=>{errors.push(error.message);console.error('Navigation page error:',error.message);});
 const headers={Authorization:'Bearer '+ownerToken,Origin:'http://localhost:4173','Content-Type':'application/json'};
 const readAdmin=async()=>{const response=await request.get('/api/admin',{headers});expect(response.ok()).toBe(true);return response.json();};
 const mutate=async command=>{const state=await readAdmin(),response=await request.post('/api/admin',{headers,data:{...command,revision:state.revision}});expect(response.ok(),await response.text()).toBe(true);return response.json();};
 const id='custom-browser-backup',name='Source temporaire pour recette de restauration';
 try{
  await mutate({action:'save',source:{id,name,url:'https://www.cisa.gov/browser-backup-feed.xml',home:'https://www.cisa.gov/',language:'fr',intervalMinutes:60,enabled:false}});
  const saved=await readAdmin();expect(saved.sources.some(source=>source.id===id)).toBe(true);
  await mutate({action:'delete',id});const deleted=await readAdmin();expect(deleted.sources.some(source=>source.id===id)).toBe(false);expect(deleted.configuration.trash[id].source.name).toBe(name);
  const operationsResponse=await request.get('/api/operations',{headers});expect(operationsResponse.ok()).toBe(true);const operations=await operationsResponse.json();
  const backup=operations.backups.find(item=>item.revision===saved.revision);expect(backup).toBeTruthy();
  await page.addInitScript(token=>sessionStorage.setItem('cyberveille-access',token),ownerToken);await page.goto('/');
  await page.locator('#admin-open').click();await page.locator('[data-admin-tab="backups"]').click();
  await expect(page.locator('#admin-content')).toContainText(name);
  await expect(page.locator('[data-admin-backup="'+backup.id+'"]')).toBeVisible();
  await mutate({action:'restore-backup',backupId:backup.id});
  await page.locator('#admin-reload').click();await page.locator('[data-admin-tab="sources"]').click();
  await page.locator('#admin-search').fill(name);await expect(page.locator('#admin-source-list')).toContainText(name);
  await expect(page.locator('[data-admin-delete="'+id+'"]').first()).toBeVisible();
  const restored=await readAdmin();expect(restored.sources.some(source=>source.id===id)).toBe(true);expect(restored.configuration.trash?.[id]).toBeUndefined();
  await page.locator('#admin-close').focus();await page.keyboard.press('Enter');await expect(page.locator('#admin-dialog')).not.toBeVisible();expect(errors).toEqual([]);
 }finally{
  const current=await readAdmin();if(current.sources.some(source=>source.id===id))await mutate({action:'delete',id});
 }
});
