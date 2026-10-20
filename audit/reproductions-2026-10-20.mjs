// Revue locale : aucun appel fournisseur réel. Les lectures réseau sont simulées.
import worker,{SocialStore,FOLLOWED_PEOPLE,SOURCES,parseOfficialJSON,normalizeSocialRows} from '../worker/index.js';
import {adminURL,adminOperation} from '../worker/admin.js';
import {gzipSync} from 'node:zlib';
const values=new Map();
const storage={get:async k=>structuredClone(values.get(k)),put:async(k,v)=>values.set(k,structuredClone(v)),delete:async k=>values.delete(k),list:async({prefix=''})=>new Map([...values].filter(([k])=>k.startsWith(prefix))),setAlarm:async()=>{}};
const result={reviewDate:'2026-10-20',network:'simulated',sourceCount:SOURCES.length,enabledSources:SOURCES.filter(s=>s.enabled).length};
result.urlValidation=['https://localhost./','https://service.internal./rss'].map(url=>{try{return {url,accepted:!!adminURL(url)};}catch{return {url,accepted:false};}});
const obj=new SocialStore({storage},{}),post={user_posted:'fuitesinfos',description:'Publication publique fictive pour audit.',url:'https://x.com/fuitesinfos/status/12345678',date_posted:'2026-10-14T00:00:00Z'};
result.duplicateImport={reported:await obj.saveArticles('x',[post,post]),stored:(await storage.list({prefix:'post:'})).size};
result.reposts={acceptedDespiteProviderFlag:normalizeSocialRows('x',[{...post,is_repost:true}]).length};
result.nvdCvssV4={criticalV4OnlyAccepted:parseOfficialJSON({vulnerabilities:[{cve:{id:'CVE-2026-12345',published:'2026-10-20T00:00:00Z',descriptions:[{lang:'en',value:'Critical sample'}],metrics:{cvssMetricV40:[{cvssData:{baseScore:9.8}}]}}}]},SOURCES.find(s=>s.kind==='nvd')).length};
const original=globalThis.fetch;let requests=0;
globalThis.fetch=async()=>{requests++;return new Response('<rss><channel><item><title>Article fictif de sécurité</title><link>https://www.cisa.gov/audit-example</link><description>Exemple local.</description></item></channel></rss>');};
try{const response=await worker.fetch(new Request('https://test/api/feed?continue=1'),{EXTERNAL_CALLS_PAUSED:'true'},{});result.runtimePause={status:response.status,externalFetchesDespitePause:requests};}finally{globalThis.fetch=original;}
const html=await(await worker.fetch(new Request('https://test/'),{},{})).text();
result.page={bytes:Buffer.byteLength(html),gzipEstimateBytes:gzipSync(html).length,inlineScriptBytes:Buffer.byteLength(html.match(/<script[^>]*>([\s\S]*)<\/script>/)[1])};
result.accessibleLabels=['search','sort','translate-provider'].map(id=>({id,hasExplicitLabel:html.includes('for="'+id+'"'),hasAriaLabel:new RegExp('id="'+id+'"[^>]*aria-label=').test(html)}));
result.socialBudget={xProfiles:FOLLOWED_PEOPLE.filter(p=>p.x).length,linkedinProfiles:FOLLOWED_PEOPLE.filter(p=>p.linkedin).length,reservation31Days:FOLLOWED_PEOPLE.filter(p=>p.x).length*3*4*31+FOLLOWED_PEOPLE.filter(p=>p.linkedin).length*31,applicationCap:4000};
const failedWrites=new Map(),unstable={get:async k=>structuredClone(failedWrites.get(k)),put:async(k,v)=>{if(k==='admin:journal')throw Error('Panne de journal simulée');failedWrites.set(k,structuredClone(v));},delete:async()=>{}};
try{await adminOperation(unstable,SOURCES,{action:'pause',revision:0,target:'feedsPaused',value:true});}catch{result.nonAtomicAdminWrite={operationFailed:true,persistedRevision:failedWrites.get('admin:config')?.revision,feedsPaused:failedWrites.get('admin:config')?.feedsPaused};}
console.log(JSON.stringify(result,null,2));
