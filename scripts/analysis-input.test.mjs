import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareStoredAnalysis,MAX_ANALYSIS_BYTES} from '../worker/analysis-input.js';
import {bookmarkSnapshot} from '../worker/personal.js';

const owner='a'.repeat(64),other='b'.repeat(64);
const source={id:'certfr',name:'CERT-FR',url:'https://www.cert.ssi.gouv.fr/feed/',enabled:true};
const article=(id,extra={})=>({id:'https://www.cert.ssi.gouv.fr/alerte/'+id+'/',url:'https://www.cert.ssi.gouv.fr/alerte/'+id+'/',title:'Publication collectée '+id,summary:'Extrait fiable en tant que copie de publication ; faits à vérifier.',source:'CERT-FR',sourceId:'certfr',date:'2026-10-23T10:00:00.000Z',cves:[],references:[],...extra});
const feed=articles=>({source:source.id,sourceUrl:source.url,status:'ok',articles});
function storage(entries=[]){const rows=new Map(entries),calls=[];return {calls,get:async key=>{calls.push(['get',key]);return rows.get(key);},list:async options=>{calls.push(['list',options.prefix]);return new Map([...rows].filter(([key])=>key.startsWith(options.prefix)).slice(0,options.limit));}};}
async function postKey(url){const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(url));return 'post:'+Array.from(new Uint8Array(hash),byte=>byte.toString(16).padStart(2,'0')).join('');}
const rejection=code=>error=>error.code===code&&error.status===(code==='source_missing'?404:400);

test('Une sélection ciblée lit uniquement le flux demandé et ignore le contenu forgé du client',async()=>{
 const stored=article('CERTFR-2026-ALE-001'),s=storage([['feed:certfr',feed([stored])]]);
 const result=await prepareStoredAnalysis(s,{eventId:'publication quelconque',sourceIds:['certfr'],urls:[stored.url],summary:'Texte client inventé',articles:[{...stored,summary:'Inventé'}]});
 assert.equal(result[0].summary,stored.summary);assert.deepEqual(s.calls,[['get','feed:certfr']]);
});
test('Les posts sociaux sont retrouvés directement par SHA de leur URL, sans exporter tous les posts',async()=>{
 const stored=article('social',{url:'https://x.com/i/web/status/123',sourceId:'x-brightdata'}),s=storage([[await postKey(stored.url),stored]]);
 const result=await prepareStoredAnalysis(s,{sourceIds:['x-brightdata'],urls:[stored.url,stored.url]});assert.equal(result.length,1);assert.equal(result[0].url,stored.url);assert.ok(!s.calls.some(([operation])=>operation==='list'));
});
test('Deux sources du même ensemble de CVE sont trouvées sans confondre un ensemble différent',async()=>{
 const a=article('one',{cves:['CVE-2026-11111','CVE-2026-22222']}),b=article('two',{cves:['CVE-2026-22222','CVE-2026-11111']}),c=article('three',{cves:['CVE-2026-11111']}),s=storage([['feed:certfr',feed([a,b,c])]]);
 const result=await prepareStoredAnalysis(s,{id:'cve:CVE-2026-11111,CVE-2026-22222'});assert.deepEqual(result.map(row=>row.url),[a.url,b.url]);
});
test('Un client ancien peut retrouver la clé de titre normalisé et une URL brute',async()=>{
 const a=article('one',{title:'Échec : contrôle d’accès !'}),s=storage([['feed:certfr',feed([a])]]);
 assert.equal((await prepareStoredAnalysis(s,{eventId:'echec controle d acces'}))[0].url,a.url);
 assert.equal((await prepareStoredAnalysis(s,{idlegacy:a.url}))[0].title,a.title);
});
test('Les archives riches privées restent utilisables sans les autres favoris ni les caches globaux',async()=>{
 const a=article('archive',{references:['https://www.cisa.gov/news-events/alerts/'],provenance:[{url:'https://www.cisa.gov/news-events/alerts/',extrait:'Preuve conservée',citedBy:[article('origin').url]}]}),bookmark=bookmarkSnapshot({...a,id:'archived-group',articles:[a]}),s=storage([['personal:'+owner,{bookmarks:{'archived-group':bookmark}}]]);
 const result=await prepareStoredAnalysis(s,{eventId:'archived-group',sourceIds:['personal-archive'],urls:[a.url]},{user:owner});assert.equal(result[0].provenance[0].extrait,'Preuve conservée');assert.deepEqual(result[0].references,a.references);assert.ok(!s.calls.some(([operation])=>operation==='list'));
 const stranger=storage([['personal:'+owner,{bookmarks:{'archived-group':bookmark}}]]);await assert.rejects(prepareStoredAnalysis(stranger,{sourceIds:['personal-archive'],urls:[a.url]},{user:other}),rejection('source_missing'));assert.ok(!stranger.calls.some(([,key])=>key==='personal:'+owner));
});
test('Les anciens favoris sans articles sont également lisibles',async()=>{
 const a=article('legacy-archive'),s=storage([['personal:'+owner,{bookmarks:{legacy:a}}]]);const result=await prepareStoredAnalysis(s,{eventId:'legacy'},{user:owner});assert.equal(result[0].url,a.url);
});
test('Une sélection explicite incomplète reste une erreur au lieu d’envoyer un contexte silencieusement partiel',async()=>{
 const a=article('available'),s=storage([['feed:certfr',feed([a])]]);await assert.rejects(prepareStoredAnalysis(s,{sourceIds:['certfr'],urls:[a.url,article('missing').url]}),rejection('source_missing'));assert.ok(!s.calls.some(([operation])=>operation==='list'));
});
test('Une source désactivée ou dont le flux a changé ne ressuscite pas son ancien cache',async()=>{
 const a=article('stale'),s=storage([['feed:certfr',feed([a])],['admin:config',{overrides:{},deleted:['certfr']}]]);
 await assert.rejects(prepareStoredAnalysis(s,{sourceIds:['certfr'],urls:[a.url]},{baseSources:[source]}),rejection('source_missing'));
 const changed=storage([['feed:certfr',feed([a])],['admin:config',{overrides:{certfr:{...source,url:'https://www.cert.ssi.gouv.fr/new-feed/'}},deleted:[]}]]);await assert.rejects(prepareStoredAnalysis(changed,{sourceIds:['certfr'],urls:[a.url]},{baseSources:[source]}),rejection('source_missing'));
});
test('Les entrées excessives, URL privées et identifiants dangereux sont refusés avant stockage',async()=>{
 for(const input of [null,[],{}, {urls:Array(13).fill(article('one').url)},{urls:['https://localhost./']},{urls:['https://user:pass@www.cisa.gov/']},{urls:['https://www.cisa.gov/?api_key=secret']},{urls:[article('one').url],sourceIds:['../../personal']},{eventId:'__proto__'}]){const s=storage();await assert.rejects(prepareStoredAnalysis(s,input),rejection('selection_invalid'));assert.equal(s.calls.length,0);}
 await assert.rejects(prepareStoredAnalysis(storage(),{eventId:'a'},{user:'invalid'}),rejection('selection_invalid'));
});
test('Le contexte Unicode, les références et la provenance restent bornés sur douze publications',async()=>{
 const articles=Array.from({length:12},(_,index)=>article('unicode-'+index,{title:'🔐'.repeat(500),summary:'⚠️ Données non fiables "\\\n'.repeat(500),references:Array.from({length:30},(_,n)=>'https://www.cisa.gov/'+('long-path-'.repeat(50))+n),provenance:Array.from({length:10},()=>({url:'https://www.cisa.gov/',extrait:'🧪'.repeat(2000),citedBy:['https://www.cert.ssi.gouv.fr/']}))})),s=storage([['feed:certfr',feed(articles)]]);
 const result=await prepareStoredAnalysis(s,{sourceIds:['certfr'],urls:articles.map(row=>row.url)});assert.equal(result.length,12);assert.ok(new TextEncoder().encode(JSON.stringify(result)).length<=MAX_ANALYSIS_BYTES);assert.ok(result.every(row=>row.title.length<=400&&row.summary.length<=2400&&row.references.length<=12&&row.provenance.length<=2));assert.ok(result.some(row=>row.analysisTruncated));assert.ok(articles[0].summary.length>2400);
});
test('Une grande collection utilise les seules lectures ciblées et ne fait aucun fetch réseau',async()=>{
 const target=article('target'),entries=Array.from({length:200},(_,index)=>['feed:source-'+index,{source:'source-'+index,articles:Array.from({length:100},(_,j)=>article('other-'+index+'-'+j))}]);entries.push(['feed:certfr',feed([target])]);const s=storage(entries),original=globalThis.fetch;globalThis.fetch=()=>{throw Error('Network access forbidden');};try{assert.equal((await prepareStoredAnalysis(s,{sourceIds:['certfr'],urls:[target.url]}))[0].url,target.url);assert.deepEqual(s.calls,[['get','feed:certfr']]);}finally{globalThis.fetch=original;}
});
test('Un extrait manuel doit être validé par le validateur LinkedIn fourni',async()=>{
 const input={url:'https://www.linkedin.com/feed/update/urn:li:activity:123/',summary:'Un extrait LinkedIn explicitement fourni par le propriétaire.'},validated={...article('manual'),url:input.url,summary:input.summary,id:'manual:'+input.url};
 const result=await prepareStoredAnalysis(storage(),{manual:input},{manualEvent:value=>value.url===input.url?validated:null});assert.equal(result[0].summary,input.summary);
 await assert.rejects(prepareStoredAnalysis(storage(),{manual:input}),rejection('selection_invalid'));await assert.rejects(prepareStoredAnalysis(storage(),{manual:input},{manualEvent:()=>null}),rejection('selection_invalid'));
});

test('Un identifiant social ancien fonctionne également avec un indice de source sans URL',async()=>{
 const a=article('legacy-social',{url:'https://x.com/i/web/status/987',sourceId:'x-brightdata',cves:['CVE-2026-33333']}),s=storage([[await postKey(a.url),a]]);
 assert.equal((await prepareStoredAnalysis(s,{eventId:'cve:CVE-2026-33333',sourceIds:['x-brightdata']}))[0].url,a.url);
 assert.ok(!s.calls.some(([operation,prefix])=>operation==='list'&&prefix==='feed:'));
});
