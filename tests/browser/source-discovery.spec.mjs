import {test,expect} from '@playwright/test';

const owner='local-runtime-test-owner-token-2026';
let fixtureClient=0;
const searchURL='**/api/source-search**';
const candidate=(platform,name,url,extra={})=>({platform,name,url,origin:'search',verification:'candidate',message:'Adresse proposée, vérification nécessaire.',...extra});
const options=page=>page.locator('[data-source-results]:visible [data-source-option]');

async function enterAdmin(page){
 // Contexts share the local Durable Object; model a separate client per scenario
 // so unrelated tests do not consume the same 20-per-minute login bucket.
 await page.context().setExtraHTTPHeaders({'CF-Connecting-IP':'198.51.100.'+(++fixtureClient)});
 const failures=[];page.on('response',async response=>{const path=new URL(response.url()).pathname;if(!path.startsWith('/api/')||![401,429].includes(response.status()))return;try{const value=await response.json();failures.push({path,status:response.status(),code:value.code||null,error:value.error||null});}catch{failures.push({path,status:response.status()});}});
 await page.addInitScript(token=>sessionStorage.setItem('cyberveille-access',token),owner);
 await page.goto('/');await page.locator('#admin-open').click();
 try{await expect(page.locator('#admin-content')).toContainText('sources au catalogue');}
 catch(error){console.error('Source-discovery admin startup failure:',JSON.stringify({failures,adminStatus:await page.locator('#admin-status').textContent(),connection:await page.evaluate(()=>({state:typeof connectionState==='undefined'?null:connectionState,failures:typeof connectionFailures==='undefined'?null:connectionFailures,result:document.querySelector('#connection-result')?.textContent||null}))}));throw error;}
}
async function openAdder(page,platform='site'){
 await page.locator('#admin-add').click();await expect(page.locator('#admin-editor')).toBeVisible();
 await page.locator('#admin-source-kind').selectOption(platform);
}
async function captureAdminWrites(page){
 const writes=[];let profiles=null,revision=null;
 await page.route('**/api/admin',async route=>{
  if(route.request().method()==='GET'){
   const response=await route.fetch(),data=await response.json();
   if(profiles){data.profiles=profiles;data.configuration={...data.configuration,profiles,profilesConfigured:true};data.revision=revision;}
   await route.fulfill({response,json:data});return;
  }
  const command=route.request().postDataJSON();writes.push(command);
  revision=(command.revision||0)+1;if(command.action==='profiles')profiles=command.profiles;
  await route.fulfill({json:{ok:true,revision}});
 });
 return writes;
}

test('La recherche respecte le seuil et le debounce puis remplit un flux vérifié au clavier',async({page})=>{
 const queries=[],verifications=[],writes=await captureAdminWrites(page),feedUrl='https://www.cyber-audit-fixture.fr/feed/';
 await page.route(searchURL,async route=>{
  if(route.request().method()==='POST'){
   verifications.push(route.request().postDataJSON());await route.fulfill({json:{status:'verified',httpStatus:200,name:'Cyber Audit RSS',url:'https://www.cyber-audit-fixture.fr/',home:'https://www.cyber-audit-fixture.fr/',feedUrl,feeds:[{url:feedUrl,title:'RSS',verified:true}],message:'Flux RSS reconnu.'}});return;
  }
  queries.push(new URL(route.request().url()).searchParams.get('q'));
  await route.fulfill({json:{status:'ok',results:[candidate('site','Cyber Audit','https://www.cyber-audit-fixture.fr/'),candidate('site','Autre source','https://www.other-audit-fixture.fr/')]}});
 });
 await enterAdmin(page);await openAdder(page);
 const query=page.locator('#admin-source-query');await expect(query).toHaveAttribute('role','combobox');
 await query.fill('c');await page.waitForTimeout(500);expect(queries).toEqual([]);
 await query.fill('');await query.pressSequentially('cyber',{delay:60});await expect(options(page)).toHaveCount(2);expect(queries).toEqual(['cyber']);
 await expect(options(page).first()).toContainText('Cyber Audit');
 await query.press('ArrowUp');await expect(options(page).last()).toHaveAttribute('aria-selected','true');await query.press('ArrowDown');await expect(options(page).first()).toHaveAttribute('aria-selected','true');await query.press('Enter');
 await expect(page.locator('#admin-source-verification')).toContainText('Flux RSS reconnu');
 await expect(page.locator('#admin-url')).toHaveValue(feedUrl);await expect(page.locator('#admin-home')).toHaveValue('https://www.cyber-audit-fixture.fr/');await expect(page.locator('#admin-name')).toHaveValue('Cyber Audit RSS');
 expect(verifications).toEqual([{platform:'site',url:'https://www.cyber-audit-fixture.fr/'}]);
 await page.locator('#admin-editor button[type="submit"]').click();
 await expect.poll(()=>writes.filter(w=>w.action==='save').length).toBe(1);
 expect(writes.find(w=>w.action==='save').source).toMatchObject({name:'Cyber Audit RSS',url:feedUrl,home:'https://www.cyber-audit-fixture.fr/'});
});

test('Une ancienne réponse de recherche ne remplace pas les suggestions de la nouvelle saisie',async({page})=>{
 let oldRoute,releaseOld;const oldArrived=new Promise(resolve=>{releaseOld=resolve;});
 await page.route(searchURL,async route=>{
  const q=new URL(route.request().url()).searchParams.get('q');
  if(q==='ancien'){oldRoute=route;releaseOld();return;}
  await route.fulfill({json:{status:'ok',results:[candidate('site','Résultat actuel','https://www.current-cyber-fixture.fr/')]}});
 });
 await enterAdmin(page);await openAdder(page);
 const query=page.locator('#admin-source-query');await query.fill('ancien');await oldArrived;
 await query.fill('nouveau');await expect(options(page)).toContainText(['Résultat actuel']);
 await oldRoute.fulfill({json:{status:'ok',results:[candidate('site','Résultat obsolète','https://www.old-cyber-fixture.fr/')]}}).catch(()=>{});
 await page.waitForTimeout(150);await expect(options(page)).toContainText(['Résultat actuel']);await expect(page.locator('[data-source-results]:visible')).not.toContainText('Résultat obsolète');
 await query.press('Escape');await expect(page.locator('[data-source-results]:visible')).toHaveCount(0);
});

for(const platform of ['x','linkedin'])test(`Un profil ${platform} bloqué en HTTP 403 reste non vérifié et n’est ajouté qu’une fois`,async({page})=>{
 const writes=await captureAdminWrites(page),handle=platform==='x'?'audit_live':null,url=platform==='x'?'https://x.com/audit_live':'https://www.linkedin.com/in/audit-research-live/',name=platform==='x'?'Audit recherche X':'Audit recherche LinkedIn';
 await page.route(searchURL,async route=>{
  if(route.request().method()==='POST'){expect(route.request().postDataJSON()).toEqual({platform,url});await route.fulfill({json:{status:'unverified',httpStatus:403,name,url,...(handle?{handle}:{}),message:'HTTP 403 : le site bloque la vérification publique. Le profil reste non vérifié.'}});return;}
  expect(new URL(route.request().url()).searchParams.get('platform')).toBe(platform);
  await route.fulfill({json:{status:'partial',results:[candidate(platform,name,url,handle?{handle}:{})],message:'Résultats proposés, vérification nécessaire.'}});
 });
 await enterAdmin(page);await openAdder(page,platform);await page.locator('#admin-source-query').fill('audit recherche');await expect(options(page)).toHaveCount(1);await options(page).first().click();
 const status=page.locator('#admin-source-verification');await expect(status).toContainText('403');await expect(status).toContainText('non vérifié');await expect(status).toHaveAttribute('data-status','unverified');await expect(status).not.toHaveClass(/(?:^|\s)(?:green|success|verified)(?:\s|$)/);
 await page.locator('#admin-editor button[type="submit"]').click();
 await expect.poll(()=>writes.filter(w=>w.action==='profiles').length).toBe(1);
 const command=writes.find(w=>w.action==='profiles'),added=command.profiles.filter(p=>platform==='x'?p.x===handle:p.linkedin===url);
 expect(added).toHaveLength(1);expect(added[0].name).toBe(name);expect(added[0].enabled).toBe(true);
 expect(writes.some(w=>w.action==='save')).toBe(false);
 await openAdder(page,platform);await page.locator('#admin-source-query').fill('audit recherche');await expect(options(page)).toHaveCount(1);await options(page).first().click();
 await expect(status).toContainText('403');
 await page.locator('#admin-editor button[type="submit"]').click();await page.waitForTimeout(200);
 expect(writes.filter(w=>w.action==='profiles')).toHaveLength(1);await expect(page.locator('#admin-status')).toContainText(/déjà|existe|suivi/i);
});

test('La recherche dans les profils conserve les autres brouillons et les horaires',async({page})=>{
 await page.route(searchURL,async route=>{
  if(route.request().method()==='POST'){await route.fulfill({json:{status:'unverified',httpStatus:403,name:'Profil public',url:'https://x.com/draft_research',handle:'draft_research',message:'HTTP 403 : profil non vérifié.'}});return;}
  await route.fulfill({json:{status:'ok',results:[candidate('x','Profil public','https://x.com/draft_research',{handle:'draft_research'})]}});
 });
 await enterAdmin(page);await page.locator('[data-admin-tab="profiles"]').click();
 const first=page.locator('[data-profile-row]').first();await first.locator('[data-profile-name]').fill('Nom en cours de modification');await page.locator('#social-x-hours').fill('13');
 const handleInput=first.locator('[data-profile-x]');await handleInput.fill('draft recherche');await expect(options(page)).toHaveCount(1);await options(page).first().click();
 await expect(first.locator('[data-source-verification]:visible')).toContainText('403');
 await expect(first.locator('[data-profile-name]')).toHaveValue('Nom en cours de modification');await expect(page.locator('#social-x-hours')).toHaveValue('13');await expect(handleInput).toHaveValue('draft_research');
});

test('Changer de site efface les anciens résultats vérifiés et impose le choix entre plusieurs flux',async({page})=>{
 const firstHome='https://www.alpha-discovery-fixture.fr/',firstFeed=firstHome+'feed/',secondHome='https://www.beta-discovery-fixture.fr/',thirdHome='https://www.gamma-discovery-fixture.fr/',thirdFeeds=[thirdHome+'rss/security.xml',thirdHome+'rss/news.xml'];
 await page.route(searchURL,async route=>{
  if(route.request().method()==='POST'){
   const {url}=route.request().postDataJSON();
   if(url===firstHome){await route.fulfill({json:{status:'verified',httpStatus:200,name:'Site Alpha',url,home:url,feedUrl:firstFeed,feeds:[{url:firstFeed,verified:true}],message:'Flux Alpha confirmé.'}});return;}
   if(url===secondHome){await route.fulfill({json:{status:'verified',httpStatus:200,name:'Site Beta',url,home:url,feeds:[],message:'Page Beta accessible, sans flux RSS reconnu.'}});return;}
   expect(url).toBe(thirdHome);await route.fulfill({json:{status:'verified',httpStatus:200,name:'Site Gamma',url,home:url,feeds:thirdFeeds.map((url,index)=>({url,name:'Flux Gamma '+(index+1),verified:true})),message:'Deux flux Gamma reconnus.'}});return;
  }
  const query=new URL(route.request().url()).searchParams.get('q'),name=query==='alpha'?'Site Alpha':query==='beta'?'Site Beta':'Site Gamma',url=query==='alpha'?firstHome:query==='beta'?secondHome:thirdHome;
  await route.fulfill({json:{status:'ok',results:[candidate('site',name,url)]}});
 });
 await enterAdmin(page);await openAdder(page);const query=page.locator('#admin-source-query'),verification=page.locator('#admin-source-verification'),feed=page.locator('#admin-url');
 await query.fill('alpha');await expect(options(page)).toHaveCount(1);await options(page).first().click();await expect(feed).toHaveValue(firstFeed);await expect(verification).toHaveAttribute('data-status','verified');
 await query.fill('beta');await expect(options(page)).toHaveCount(1);await expect(feed).toHaveValue('');await expect(verification).not.toHaveAttribute('data-status','verified');await expect(verification).not.toContainText('Flux Alpha confirmé');
 await options(page).first().click();await expect(verification).toContainText('Aucun flux');await expect(verification).toHaveAttribute('data-status','unverified');await expect(feed).toHaveValue('');
 await query.fill('gamma');await expect(options(page)).toHaveCount(1);await options(page).first().click();
 const choice=page.locator('#admin-feed-choice');await expect(choice).toBeVisible();await expect(choice.locator('option')).toHaveCount(3);await expect(choice).toHaveValue('');await expect(feed).toHaveValue('');await choice.selectOption(thirdFeeds[1]);await expect(feed).toHaveValue(thirdFeeds[1]);
});

test('Une vérification différée ne remplace pas une adresse de flux saisie manuellement entre-temps',async({page})=>{
 const site='https://www.pending-alpha-fixture.fr/',oldFeed=site+'feed/',manualFeed='https://www.manual-beta-fixture.fr/rss.xml';
 let verificationRoute,markVerificationStarted;const verificationStarted=new Promise(resolve=>{markVerificationStarted=resolve;});
 await page.route(searchURL,async route=>{
  if(route.request().method()==='POST'){verificationRoute=route;markVerificationStarted();return;}
  await route.fulfill({json:{status:'ok',results:[candidate('site','Site Alpha différé',site)]}});
 });
 await enterAdmin(page);await openAdder(page);await page.locator('#admin-source-query').fill('alpha différé');await expect(options(page)).toHaveCount(1);await options(page).first().click();await verificationStarted;
 const feed=page.locator('#admin-url'),verification=page.locator('#admin-source-verification');
 await feed.fill(manualFeed);
 await verificationRoute.fulfill({json:{status:'verified',httpStatus:200,name:'Site Alpha différé',url:site,home:site,feedUrl:oldFeed,feeds:[{url:oldFeed,verified:true}],message:'Ancien flux Alpha confirmé.'}}).catch(()=>{});
 await page.waitForTimeout(150);
 await expect(feed).toHaveValue(manualFeed);await expect(verification).not.toHaveAttribute('data-status','verified');await expect(verification).not.toContainText('Ancien flux Alpha confirmé');
});
