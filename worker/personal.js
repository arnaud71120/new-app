import {adminURL} from './admin.js';
const empty=()=>({revision:0,bookmarks:{},notes:{},read:[],watchlist:[],progress:[],preferences:{},cases:{},alerts:[],notified:[]});
const texts=(value,limit=20,length=300)=>(Array.isArray(value)?value:[]).filter(x=>typeof x==='string').slice(0,limit).map(x=>x.slice(0,length));
const stamp=value=>Number.isFinite(Date.parse(value))?new Date(value).toISOString():null;
function references(value){return (Array.isArray(value)?value:[]).slice(0,40).flatMap(item=>{try{const url=adminURL(typeof item==='string'?item:item?.url);return [typeof item==='string'?url:{url,kind:String(item.kind||'Référence').slice(0,150),...(item.citedBy?{citedBy:adminURL(item.citedBy)}:{})}];}catch{return [];}});}
function articleSnapshot(event,summaryLimit=4000){
 if(!event||['__proto__','constructor','prototype'].includes(event.id)||typeof event.id!=='string'||event.id.length>600||typeof event.title!=='string')throw Error('Publication invalide.');
 const result={id:event.id,title:event.title.slice(0,400),summary:String(event.summary||'').slice(0,summaryLimit),url:adminURL(event.url),source:String(event.source||'').slice(0,150),date:stamp(event.date),cves:texts(event.cves).filter(c=>/^CVE-\d{4}-\d{4,}$/i.test(c)),type:String(event.type||'Veille générale').slice(0,100),score:Number.isFinite(event.score)?Math.max(0,Math.min(100,event.score)):30,reasons:texts(event.reasons),references:references(event.references),sourceId:String(event.sourceId||'personal-archive').slice(0,100),topics:texts(event.topics,20,100),technical:!!event.technical};
 if(event.topic)result.topic=String(event.topic).slice(0,100);
 for(const key of ['collectedAt','firstCollectedAt'])if(stamp(event[key]))result[key]=stamp(event[key]);
 for(const key of ['language','collector','followedPerson'])if(typeof event[key]==='string')result[key]=event[key].slice(0,150);
 if(typeof event.knownExploited==='boolean')result.knownExploited=event.knownExploited;
 if(Number.isFinite(event.cvss))result.cvss=Math.max(0,Math.min(10,event.cvss));
 result.disclosures=(Array.isArray(event.disclosures)?event.disclosures:[]).slice(0,10).map(d=>({platform:String(d.platform||'').slice(0,150),evidence:String(d.evidence||'').slice(0,1500),reportedBy:references([d.reportedBy])[0]||result.url,citedLinks:references(d.citedLinks),reportedStatus:String(d.reportedStatus||'mention').slice(0,100),verified:false,status:String(d.status||'Mention archivée ; authenticité à vérifier').slice(0,400)}));
 result.provenance=(Array.isArray(event.provenance)?event.provenance:[]).slice(0,8).flatMap(p=>{try{return [{url:adminURL(p.url),extrait:String(p.extrait||'').slice(0,2000),citedBy:references(p.citedBy)}];}catch{return [];}});
 result.images=(Array.isArray(event.images)?event.images:[]).slice(0,8).flatMap(i=>{try{return [{url:adminURL(i.url),alt:String(i.alt||'').slice(0,400),source:references([i.source])[0]||result.url}];}catch{return [];}});
 return result;
}
export function bookmarkSnapshot(event){
 const result=articleSnapshot(event),articles=Array.isArray(event.articles)&&event.articles.length?event.articles:[event];
 result.articles=articles.slice(0,20).map(a=>articleSnapshot({...a,id:a.id||a.url},2000));
 return {...result,archiveVersion:2,savedAt:stamp(event.savedAt)||new Date().toISOString(),archiveTruncated:!!event.archiveTruncated||articles.length>20||String(event.summary||'').length>4000||articles.some(a=>String(a.summary||'').length>2000||(a.references?.length||0)>40||(a.provenance?.length||0)>8),articleCount:Math.max(articles.length,Number(event.articleCount)||0)};
}
export function archivedBookmarkEvent(bookmark){
 const result=bookmarkSnapshot(bookmark);return {...result,reasons:result.reasons.length?result.reasons:['Favori conservé'],articles:result.articles,archived:true};
}
export function sourceAlertIncidents(sources,previous=[],now=new Date().toISOString()){
 const rows=previous.filter(a=>a?.kind==='source'&&a.id&&a.source).map(a=>({...a}));
 const hash=text=>{let n=2166136261;for(let i=0;i<text.length;i++)n=Math.imul(n^text.charCodeAt(i),16777619);return (n>>>0).toString(36);};
 for(const source of sources||[]){const id=String(source.source||source.id||'');if(!id)continue;
  const checkedAt=Number.isFinite(Date.parse(source.checkedAt))?new Date(source.checkedAt).toISOString():null;
  const latest=[...rows].reverse().find(a=>a.source===id);if(checkedAt&&latest&&checkedAt<latest.lastSeenAt)continue;
  const open=[...rows].reverse().find(a=>a.source===id&&a.state==='open');
  if(source.status==='error'){
   const signature=String(source.code??source.lastHttpStatus??source.message??'error').slice(0,399)+'|'+String(source.stage||'').slice(0,100);
   if(open&&open.signature===signature){if(checkedAt&&checkedAt>open.lastSeenAt)open.lastSeenAt=checkedAt;continue;}
   if(open){open.state='resolved';open.resolvedAt=checkedAt||now;open.resolution='changed';}
   const at=checkedAt||now;rows.push({id:'source:'+id+':'+hash(at+'|'+signature),kind:'source',source:id,state:'open',signature,startedAt:at,lastSeenAt:at,at,message:'Source '+id+' : '+String(source.code||source.message||'erreur').slice(0,300)});
  }else if(open&&['ok','ready'].includes(source.status)&&checkedAt&&checkedAt>=open.lastSeenAt){open.state='resolved';open.resolvedAt=checkedAt;open.lastSeenAt=checkedAt;open.resolution='recovered';}
 }
 return rows.slice(-100);
}
function validPreferences(value){return value&&typeof value==='object'&&!Array.isArray(value)&&JSON.stringify(value).length<=8000&&(!Object.hasOwn(value,'technologies')||Array.isArray(value.technologies)&&value.technologies.length<=50&&value.technologies.every(t=>typeof t==='string'&&t.trim().length>=2&&t.length<=100));}
export async function personalOperation(storage,user,input){
 const key='personal:'+user,current={...empty(),...await storage.get(key)};if(input.action==='read')return current;
 if(input.revision!==current.revision)return {error:'Vos données ont changé sur un autre appareil. Rechargez puis réessayez.',status:409};
 const data=structuredClone(current);
 try{
  if(input.action==='bookmark'){const item=bookmarkSnapshot(input.event);if(input.remove)delete data.bookmarks[item.id];else data.bookmarks[item.id]=item;}
  else if(input.action==='remove-bookmark')delete data.bookmarks[String(input.id)];
  else if(input.action==='note'){if(['__proto__','constructor','prototype'].includes(input.id)||typeof input.id!=='string'||input.id.length>600||typeof input.text!=='string'||input.text.length>5000)throw Error('Note invalide.');data.notes[input.id]={text:input.text,tags:Array.isArray(input.tags)?input.tags.map(String).filter(t=>t.length<=40).slice(0,10):[],updatedAt:new Date().toISOString()};}
  else if(input.action==='read-items'){if(!Array.isArray(input.ids)||input.ids.length>1000)throw Error('Sélection invalide.');data.read=[...new Set([...data.read,...input.ids.filter(x=>typeof x==='string'&&x.length<=600)])].slice(-2000);}
  else if(input.action==='watchlist'){if(!Array.isArray(input.items)||input.items.length>50||input.items.some(x=>typeof x!=='string'||x.length>100))throw Error('Surveillance limitée à 50 termes de 100 caractères.');data.watchlist=[...new Set(input.items.map(x=>x.trim()).filter(Boolean))];}
  else if(input.action==='progress'){if(!Array.isArray(input.ids)||input.ids.length>200||input.ids.some(x=>typeof x!=='string'||x.length>100))throw Error('Progression invalide.');data.progress=[...new Set(input.ids)];}
  else if(input.action==='preferences'){if(!validPreferences(input.values))throw Error('Préférences invalides.');data.preferences={...data.preferences,...input.values};}
  else if(input.action==='case'){if(typeof input.name!=='string'||!input.name.trim()||input.name.length>120||!Array.isArray(input.events)||input.events.length>20)throw Error('Dossier limité à 20 publications.');const id=input.id||crypto.randomUUID();if(typeof id!=='string'||id.length>100||['__proto__','constructor','prototype'].includes(id))throw Error('Identifiant invalide');data.cases[id]={id,name:input.name,events:input.events.map(bookmarkSnapshot),updatedAt:new Date().toISOString()};}
  else if(input.action==='delete-case')delete data.cases[input.id];
  else if(input.action==='source-incidents'){
   if(!Array.isArray(input.items)||input.items.length>100)throw Error('Historique des incidents invalide.');
   data.alerts=input.items.map(item=>{if(!item||typeof item.id!=='string'||item.id.length>600||typeof item.source!=='string'||item.source.length>100||!['open','resolved'].includes(item.state)||!stamp(item.startedAt)||!stamp(item.lastSeenAt))throw Error('Incident invalide.');return {id:item.id,kind:'source',source:item.source,state:item.state,signature:String(item.signature||'').slice(0,500),startedAt:stamp(item.startedAt),lastSeenAt:stamp(item.lastSeenAt),at:stamp(item.startedAt),message:String(item.message||'').slice(0,500),...(stamp(item.resolvedAt)?{resolvedAt:stamp(item.resolvedAt),resolution:item.resolution==='recovered'?'recovered':'changed'}:{})};});
  }
  else if(input.action==='notified'){if(!Array.isArray(input.ids)||input.ids.length>100)throw Error('Notifications invalides.');data.notified=[...new Set([...data.notified,...input.ids.filter(id=>typeof id==='string'&&id.length<=600)])].slice(-300);}
  else if(input.action==='alerts'){if(!Array.isArray(input.items)||input.items.length>100)throw Error('Alertes invalides.');data.alerts=input.items.map(a=>({id:String(a.id).slice(0,600),message:String(a.message).slice(0,500),at:new Date().toISOString()}));}
  else if(input.action==='import'){
   const value=input.data;if(!value||!value.bookmarks||typeof value.bookmarks!=='object')throw Error('Sauvegarde personnelle invalide.');
   for(const item of Object.values(value.bookmarks).slice(0,200)){const safe=bookmarkSnapshot(item);data.bookmarks[safe.id]=safe;}
   if(Array.isArray(value.watchlist))data.watchlist=[...new Set([...data.watchlist,...value.watchlist.filter(x=>typeof x==='string'&&x.length<=100)])].slice(0,50);
   if(value.notes&&typeof value.notes==='object')for(const [id,note] of Object.entries(value.notes)){if(['__proto__','constructor','prototype'].includes(id)||id.length>600||typeof note.text!=='string'||note.text.length>5000)throw Error('Note importée invalide.');data.notes[id]={text:note.text,tags:Array.isArray(note.tags)?note.tags.map(String).filter(t=>t.length<=40).slice(0,10):[],updatedAt:new Date().toISOString()};}
   if(value.cases&&typeof value.cases==='object')for(const [id,item] of Object.entries(value.cases)){if(!/^[a-zA-Z0-9-]{1,100}$/.test(id)||['constructor','prototype'].includes(id)||typeof item.name!=='string'||item.name.length>120||!Array.isArray(item.events)||item.events.length>20)throw Error('Dossier importé invalide.');data.cases[id]={id,name:item.name,events:item.events.map(bookmarkSnapshot),updatedAt:new Date().toISOString()};}
   if(Array.isArray(value.read))data.read=[...new Set([...data.read,...value.read.filter(id=>typeof id==='string'&&id.length<=600)])].slice(-2000);
   if(value.preferences){if(!validPreferences(value.preferences))throw Error('Préférences importées invalides.');data.preferences=JSON.parse(JSON.stringify(value.preferences));}
   if(Array.isArray(value.progress))data.progress=[...new Set([...data.progress,...value.progress.filter(x=>typeof x==='string'&&x.length<=100)])].slice(0,200);
  }else if(input.action==='erase')Object.assign(data,empty(),{revision:current.revision});
  else throw Error('Action inconnue.');
  if(Object.keys(data.bookmarks).length>200||Object.keys(data.cases).length>30||new TextEncoder().encode(JSON.stringify(data)).length>110000)throw Error('Capacité personnelle atteinte. Exportez et retirez des éléments.');
 }catch(e){return {error:e.message,status:400};}
 data.revision++;data.updatedAt=new Date().toISOString();await storage.put(key,data);return {ok:true,revision:data.revision};
}
export function watchMatches(event,terms){const text=[event.title,event.summary,...event.cves||[]].join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();return terms.filter(t=>text.includes(t.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()));}
export function localBriefing(events,now=Date.now()){
 const recent=events.filter(e=>Number.isFinite(Date.parse(e.date))&&now-Date.parse(e.date)>=0&&now-Date.parse(e.date)<86400000).sort((a,b)=>(b.score||0)-(a.score||0));
 return '# Briefing Cyberveille — '+new Date(now).toLocaleDateString('fr-FR')+'\n\n'+recent.length+' dossiers dans les dernières 24 heures. Publications collectées, faits à vérifier.\n\n'+recent.slice(0,20).map(e=>'## '+e.title+'\n\n'+String(e.summary||'').slice(0,500)+'\n\nSources : '+[...new Set((e.articles||[e]).map(a=>a.url))].join(' · ')+'\n').join('\n');
}
