import {test,expect} from '@playwright/test';

const json=(route,value,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(value)});

async function sessionFixture(page,explain){
 const errors=[],unexpected=[],calls=[];page.on('pageerror',error=>errors.push(error.message));
 await page.context().addCookies([{name:'CF_Authorization',value:'browser-cookie-fixture',url:'http://localhost:4173',sameSite:'Lax'}]);
 await page.addInitScript(()=>{
  localStorage.setItem('cyberveille-ai-workload','manual');
  const nativeFetch=window.fetch.bind(window);window.__networkOptions=[];
  window.fetch=(url,options={})=>{window.__networkOptions.push({url:String(url),authorization:new Headers(options.headers||{}).get('Authorization'),credentials:options.credentials});return nativeFetch(url,options);};
 });
 await page.route('**/api/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  calls.push({path,headers:route.request().headers(),body:route.request().postData()});
  if(path==='/api/status')return json(route,{ai:true,gemini:true,geminiConfigured:true,geminiModel:'gemini-2.5-flash',access:true,accessDiagnostic:{code:'verified',source:'header'},protected:true,brightdata:false,freeOnly:true,socialStorage:true,followedProfiles:16,xAccounts:10,version:'browser-fixture',role:'admin'});
  if(path==='/api/session')return json(route,{ok:true,access:true,token:'cloudflare-access'});
  if(path==='/api/logout')return json(route,{ok:true});
  if(path==='/api/feed')return json(route,{events:[],sources:[],mode:'live',pendingSources:0,totalSources:0,updatedAt:new Date().toISOString()});
  if(path==='/api/social'||path==='/api/social/auto')return json(route,{articles:[],configured:false,freeOnlyConfirmed:false,storage:true,platforms:{}});
  if(path==='/api/user')return json(route,{revision:0,bookmarks:{},notes:{},read:[],watchlist:[],progress:[],preferences:{},cases:{},alerts:[]});
  if(path==='/api/explain')return explain(route,calls.filter(call=>call.path==='/api/explain').length);
  unexpected.push(path);return json(route,{error:'Unexpected route in browser regression fixture'},500);
 });
 await page.goto('/');
 await page.waitForFunction(()=>connectionState==='connected'&&!feedLoading&&!socialLoading);
 await page.evaluate(()=>{
  const article={id:'session-fixture',url:'https://www.cert.ssi.gouv.fr/alerte/session-fixture/',title:'Une faille de sécurité à vérifier',summary:'Une publication pour vérifier le traitement des réponses et la connexion avec cette application.',date:new Date().toISOString(),source:'CERT-FR',sourceId:'cert-fr',language:'fr',score:60,type:'Vulnérabilité',reasons:['Publication de test'],cves:[],references:[]};
  data={...data,mode:'live',events:[{...article,articles:[article]}]};ai=true;accessToken='cloudflare-access';translationPaused=true;openDetail(article.id);
 });
 await expect(page.locator('#detail')).toBeVisible();
 return {errors,unexpected,calls};
}

for(const status of [503,403])test('Une page HTML HTTP '+status+' ne devient pas une session expirée',async({page})=>{
 const fixture=await sessionFixture(page,route=>route.fulfill({status,contentType:'text/html',headers:{'CF-Ray':'browser-error-fixture'},body:status===503?'<html><title>Service unavailable</title><p>Cloudflare gateway unavailable.</p></html>':'<html><title>Forbidden</title><p>Cloudflare security policy blocked this request.</p></html>'}));
 await page.locator('#explain').click();await expect(page.locator('#ai-result')).toContainText('HTTP '+status);
 const message=await page.locator('#ai-result').innerText();expect(message).not.toMatch(/Session Cloudflare Access expirée|rechargez cette page pour vous reconnecter/i);
 if(status===503)expect(message).toContain('indisponible');else expect(message).toMatch(/refus|blocage|bloqu/i);
 await expect(page.locator('#explain')).toBeEnabled();
 expect(fixture.calls.filter(call=>call.path==='/api/explain')).toHaveLength(1);
 expect(fixture.errors).toEqual([]);expect(fixture.unexpected).toEqual([]);
});

test('La connexion Access utilise le cookie, sans faux jeton Bearer sur le réseau',async({page})=>{
 const fixture=await sessionFixture(page,route=>json(route,{text:'Analyse de test reçue.',model:'gemini-fixture'}));
 await page.locator('#explain').click();await expect(page.locator('#ai-result')).toContainText('Analyse de test reçue.');
 const outgoing=fixture.calls.filter(call=>['/api/session','/api/explain','/api/user','/api/social/auto'].includes(call.path));
 expect(outgoing.some(call=>call.path==='/api/session')).toBe(true);expect(outgoing.some(call=>call.path==='/api/explain')).toBe(true);
 for(const call of outgoing){expect(call.headers.authorization).toBeUndefined();expect(call.headers.cookie).toContain('CF_Authorization=browser-cookie-fixture');}
 const networkOptions=await page.evaluate(()=>window.__networkOptions.filter(item=>item.url.startsWith('/api/')));
 expect(networkOptions.length).toBeGreaterThan(0);for(const options of networkOptions){expect(options.credentials).toBe('same-origin');expect(options.authorization).toBeNull();}
 expect(fixture.errors).toEqual([]);expect(fixture.unexpected).toEqual([]);
});

for(const mode of ['html-login','json-401'])test('Reconnexion '+mode+' sans rejeu automatique d’une demande Gemini',async({page})=>{
 const fixture=await sessionFixture(page,(route,count)=>count===1?(mode==='html-login'?route.fulfill({status:200,contentType:'text/html',body:'<html><title>Cloudflare Access</title><form action="https://team.cloudflareaccess.com/cdn-cgi/access/login/application">Sign in with your email</form></html>'}):json(route,{error:'Une nouvelle connexion est nécessaire.',code:'access_expired'},401)):json(route,{text:'Analyse après nouvelle action explicite.',model:'gemini-fixture'}));
 await page.locator('#explain').click();await expect(page.locator('#ai-result')).toContainText('connexion');
 const reconnect=page.locator('#ai-result [data-reconnect]');await expect(reconnect).toBeVisible();await reconnect.click();
 await expect(page.locator('#ai-result')).toContainText(/connexion.*(?:valid|vérifi|rétabli)|session.*valid/i);
 expect(fixture.calls.filter(call=>call.path==='/api/explain')).toHaveLength(1);
 await expect(page.locator('#explain')).toBeEnabled();await page.locator('#explain').click();
 await expect(page.locator('#ai-result')).toContainText('Analyse après nouvelle action explicite.');
 expect(fixture.calls.filter(call=>call.path==='/api/explain')).toHaveLength(2);
 expect(fixture.errors).toEqual([]);expect(fixture.unexpected).toEqual([]);
});


test('Fermer la session Access ne transmet pas non plus le marqueur au logout',async({page})=>{
 const fixture=await sessionFixture(page,route=>json(route,{text:'Unused analysis fixture',model:'fixture'}));
 const loggedOut=page.waitForRequest(request=>new URL(request.url()).pathname==='/api/logout');
 await page.evaluate(()=>clearPrivateSession());const request=await loggedOut;
 expect(request.headers().authorization).toBeUndefined();expect(request.headers().cookie).toContain('CF_Authorization=browser-cookie-fixture');
 await expect(page.locator('#detail')).not.toBeVisible();expect(fixture.calls.filter(call=>call.path==='/api/explain')).toHaveLength(0);
 expect(fixture.errors).toEqual([]);expect(fixture.unexpected).toEqual([]);
});
