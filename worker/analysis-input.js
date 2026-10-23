import {mergedCatalog} from './admin.js';

// Select existing documents inside the Durable Object. No grouping, crawling or
// caller-supplied article body is needed to prepare one analysis.
export const MAX_ANALYSIS_BYTES=40000;
const MAX_ARTICLES=12,MAX_FEEDS=200,MAX_POSTS=1000;
const encoder=new TextEncoder();
const reserved=new Set(['__proto__','constructor','prototype']);
const error=(code,status,message)=>Object.assign(new Error(message),{code,status});
const invalid=()=>error('selection_invalid',400,'Sélection de publications invalide.');
const missing=()=>error('source_missing',404,'Une publication sélectionnée n’est plus disponible dans le cache ni dans vos favoris. Actualisez le fil ou ouvrez votre archive.');
const own=(object,key)=>object&&Object.prototype.hasOwnProperty.call(object,key);
export function analysisDocumentURL(value){
 if(typeof value!=='string'||value.length>2048)return null;
 try{
  const url=new URL(value),host=url.hostname.toLowerCase().replace(/\.+$/,'');
  if(!['https:','http:'].includes(url.protocol)||url.username||url.password||url.port&&!['80','443'].includes(url.port)||!host.includes('.')||host.includes(':')||/^\d+\.\d+\.\d+\.\d+$/.test(host)||/(?:^|\.)(localhost|local|internal|lan|home|test|invalid|example)$/.test(host))return null;
  if([...url.searchParams.keys()].some(key=>/^(?:access_token|token|secret|password|api[_-]?key|authorization|auth)$/i.test(key)))return null;
  url.hostname=host;return url.href.length<=2048?url.href:null;
 }catch{return null;}
}
async function postKey(url){const hash=await crypto.subtle.digest('SHA-256',encoder.encode(url));return 'post:'+Array.from(new Uint8Array(hash),byte=>byte.toString(16).padStart(2,'0')).join('');}
function legacyKey(article){
 const cves=(Array.isArray(article.cves)?article.cves:[]).slice(0,50).filter(value=>typeof value==='string'&&/^CVE-\d{4}-\d{4,}$/i.test(value));
 return cves.length?'cve:'+cves.sort().join(','):String(article.title||'').toLocaleLowerCase('fr').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim()||article.url;
}
const values=rows=>typeof rows?.values==='function'?rows.values():Object.values(rows||{});
const articleRows=record=>Array.isArray(record?.articles)?record.articles:[];
const archiveRows=bookmark=>Array.isArray(bookmark?.articles)&&bookmark.articles.length?bookmark.articles.slice(0,20):bookmark?[bookmark]:[];
const string=(value,length)=>typeof value==='string'?value.slice(0,length):'';
function byteString(value,limit){let result='',bytes=0;for(const character of value){const size=encoder.encode(character).length;if(bytes+size>limit)break;bytes+=size;result+=character;}return result;}
function references(rows,limit=12){
 const result=[],seen=new Set();
 for(const row of (Array.isArray(rows)?rows:[]).slice(0,limit)){const url=analysisDocumentURL(typeof row==='string'?row:row?.url);if(url&&url.length<=1024&&!seen.has(url)){seen.add(url);result.push(url);}}
 return result;
}
function compactArticle(article){
 const date=Date.parse(article.date),result={title:string(article.title,400),summary:string(article.summary,2400),url:analysisDocumentURL(article.url),source:byteString(string(article.source,150),150),sourceId:byteString(string(article.sourceId,100),100),date:Number.isFinite(date)?new Date(date).toISOString():null,cves:(Array.isArray(article.cves)?article.cves:[]).slice(0,12).filter(value=>typeof value==='string'&&/^CVE-\d{4}-\d{4,}$/i.test(value)&&value.length<=32),references:references(article.references),provenance:[]};
 for(const page of (Array.isArray(article.provenance)?article.provenance:[]).slice(0,2)){const url=analysisDocumentURL(page?.url);if(url&&url.length<=1024)result.provenance.push({url,extrait:string(page.extrait,1200),citedBy:references(page.citedBy,4)});}
 if(Array.isArray(article.relatedReasons))result.relatedReasons=article.relatedReasons.slice(0,8).map(reason=>string(reason,180)).filter(Boolean);
 if(typeof article.knownExploited==='boolean')result.knownExploited=article.knownExploited;
 if(Number.isFinite(article.cvss)&&article.cvss>=0&&article.cvss<=10)result.cvss=article.cvss;
 return result;
}
const bytes=value=>encoder.encode(JSON.stringify(value)).length;
function fitArticle(article,budget){
 if(bytes(article)<=budget)return article;
 article.analysisTruncated=true;
 while(article.provenance.length&&bytes(article)>budget)article.provenance.pop();
 while(article.references.length&&bytes(article)>budget)article.references.pop();
 if(bytes(article)>budget)delete article.relatedReasons;
 for(const field of ['summary','title']){
  if(bytes(article)<=budget)break;
  const text=article[field];let low=0,high=text.length;
  while(low<high){const middle=Math.ceil((low+high)/2);article[field]=text.slice(0,middle);if(bytes(article)<=budget)low=middle;else high=middle-1;}
  article[field]=text.slice(0,low).replace(/[\uD800-\uDBFF]$/,'');
 }
 if(bytes(article)>budget)throw invalid();
 return article;
}
function boundedArticles(selected){
 const rows=[...selected.values()].slice(0,MAX_ARTICLES),budget=Math.floor((MAX_ANALYSIS_BYTES-2-Math.max(0,rows.length-1))/Math.max(1,rows.length));
 const result=rows.map(article=>fitArticle(compactArticle(article),budget));
 if(!result.length)throw missing();
 if(bytes(result)>MAX_ANALYSIS_BYTES)throw invalid();
 return result;
}

export async function prepareStoredAnalysis(storage,input,{user,manualEvent,baseSources}={}){
 if(!input||typeof input!=='object'||Array.isArray(input))throw invalid();
 if(user!==undefined&&(typeof user!=='string'||!/^[a-f0-9]{64}$/.test(user)))throw invalid();
 const id=input.eventId??input.id??input.idlegacy;
 if(id!==undefined&&(typeof id!=='string'||!id||id.length>1500||reserved.has(id)))throw invalid();
 if(input.urls!==undefined&&(!Array.isArray(input.urls)||input.urls.length>MAX_ARTICLES||input.urls.some(url=>!analysisDocumentURL(url))))throw invalid();
 if(input.sourceIds!==undefined&&(!Array.isArray(input.sourceIds)||input.sourceIds.length>MAX_ARTICLES||input.sourceIds.some(source=>typeof source!=='string'||!/^[a-z0-9][a-z0-9-]{0,79}$/.test(source)||reserved.has(source))))throw invalid();
 const urls=[...new Set((input.urls||[]).map(analysisDocumentURL))],targets=new Set(urls),sourceIds=[...new Set(input.sourceIds||[])],selected=new Map();
 let manual=null;
 if(input.manual!==undefined&&input.manual!==null){if(typeof manualEvent!=='function')throw invalid();try{manual=manualEvent(input.manual);}catch{throw invalid();}if(!manual||!analysisDocumentURL(manual.url))throw invalid();}
 if(!urls.length&&!id&&!manual)throw invalid();
 const complete=()=>urls.length?selected.size===urls.length:selected.size===MAX_ARTICLES;
 const accept=article=>{
  if(!article||typeof article!=='object'||typeof article.title!=='string'||!article.title)return;
  const url=analysisDocumentURL(article.url);if(!url||selected.has(url)||selected.size===MAX_ARTICLES)return;
  if(urls.length?!targets.has(url):article.id!==id&&article.url!==id&&legacyKey(article)!==id)return;
  selected.set(url,article);
 };
 if(manual){for(const article of archiveRows(manual)){
  const url=analysisDocumentURL(article?.url);if(!url)throw invalid();
  if(urls.length)accept(article);else if(typeof article.title==='string'&&article.title)selected.set(url,article);
 }if(!urls.length||complete())return boundedArticles(selected);}
 let catalog=null;
 const ensureCatalog=async()=>{
  if(catalog===null&&Array.isArray(baseSources)){const config=await storage.get('admin:config')||{};catalog=new Map(mergedCatalog(baseSources,config).filter(source=>source.enabled).map(source=>[source.id,source]));}
 };
 const acceptFeed=record=>{
  if(!record||typeof record.source!=='string')return;
  if(catalog){const source=catalog.get(record.source);if(!source||record.sourceUrl&&record.sourceUrl!==source.url)return;}
  for(const article of articleRows(record)){accept(article);if(complete())break;}
 };
 if(sourceIds.length){
  await ensureCatalog();
  for(const sourceId of sourceIds){if(catalog&&!catalog.has(sourceId))continue;const record=await storage.get('feed:'+sourceId);if(record?.source===sourceId)acceptFeed(record);if(complete())return boundedArticles(selected);}
 }
 if(urls.length){
  const keys=await Promise.all(urls.filter(url=>!selected.has(url)).map(postKey));
  for(const key of keys){accept(await storage.get(key));if(complete())return boundedArticles(selected);}
 }else{
  if(!sourceIds.length){
   await ensureCatalog();
   for(const record of values(await storage.list({prefix:'feed:',limit:MAX_FEEDS}))){acceptFeed(record);if(complete())return boundedArticles(selected);}
  }
  for(const article of values(await storage.list({prefix:'post:',limit:MAX_POSTS}))){accept(article);if(complete())return boundedArticles(selected);}
 }
 if(urls.length&&!sourceIds.length){
  await ensureCatalog();
  for(const record of values(await storage.list({prefix:'feed:',limit:MAX_FEEDS}))){acceptFeed(record);if(complete())return boundedArticles(selected);}
 }
 if(user){
  const personal=await storage.get('personal:'+user),bookmarks=personal?.bookmarks;
  if(!urls.length&&own(bookmarks,id)){for(const article of archiveRows(bookmarks[id])){const url=analysisDocumentURL(article?.url);if(url&&typeof article.title==='string'&&article.title&&!selected.has(url)&&selected.size<MAX_ARTICLES)selected.set(url,article);}}
  else if(urls.length)for(const bookmark of Object.values(bookmarks||{}).slice(0,200)){for(const article of archiveRows(bookmark)){accept(article);if(complete())return boundedArticles(selected);}}
 }
 if(urls.length&&selected.size!==urls.length)throw missing();
 return boundedArticles(selected);
}
