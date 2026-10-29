import {normalizeSourceURL,publicSourceURL,isSocialHost} from './source-addresses.js';
export {normalizeSourceURL,normalizeSourceURL as normalizSourceURL} from './source-addresses.js';
const MAX_BODY=300*1024;
const FEED_HOSTS=new Set(['feeds.feedburner.com','feeds2.feedburner.com','feedproxy.google.com']);
const knownFeedHost=url=>FEED_HOSTS.has(new URL(url).hostname);
const platformValue=value=>({sites:'site',web:'site',twitter:'x'})[value]||value;
const clock=now=>typeof now==='function'?now():Number(now);
const clean=value=>decode(String(value||'').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim();
function decode(value){return value.replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi,(_,entity)=>{if(entity[0]==='#'){const number=parseInt(entity.slice(entity[1]?.toLowerCase()==='x'?2:1),entity[1]?.toLowerCase()==='x'?16:10);return number>0&&number<=0x10ffff?String.fromCodePoint(number):'';}return ({amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' '})[entity.toLowerCase()]||'';});}
function attrs(text){const result={};for(const match of text.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g))result[match[1].toLowerCase()]=decode(match[2]??match[3]??match[4]??'');return result;}
const folded=value=>String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function budget(fetcher,now){
 const started=clock(now),controller=new AbortController();let reject;const aborted=new Promise((_,fail)=>{reject=fail;});const fail=()=>{const error=Error('La vérification a dépassé son délai.');error.code='timeout';reject(error);};controller.signal.addEventListener('abort',fail,{once:true});aborted.catch(()=>{});const timer=setTimeout(()=>controller.abort(),12000);
 return {async run(promise){if(clock(now)-started>=12000)controller.abort();if(controller.signal.aborted){Promise.resolve(promise).catch(()=>{});throw Object.assign(Error('Délai dépassé'),{code:'timeout'});}return Promise.race([promise,aborted]);},async fetch(url){if(clock(now)-started>=12000)controller.abort();return this.run(Promise.resolve().then(()=>{if(controller.signal.aborted)throw Object.assign(Error('Délai dépassé'),{code:'timeout'});return fetcher(url,{method:'GET',redirect:'manual',signal:controller.signal,headers:{Accept:'text/html, application/rss+xml, application/atom+xml, application/rdf+xml, application/xml;q=0.8'}});}));},close(){clearTimeout(timer);},signal:controller.signal};
}
async function textBody(response,b){
 const length=Number(response.headers.get('Content-Length'));if(length>MAX_BODY){await response.body?.cancel();throw Object.assign(Error('Page trop volumineuse pour cette vérification.'),{code:'body_limit'});}
 if(!response.body)return '';
 const reader=response.body.getReader(),chunks=[];let size=0;
 try{while(true){const part=await b.run(reader.read());if(part.done)break;size+=part.value.byteLength;if(size>MAX_BODY){await reader.cancel();throw Object.assign(Error('Page trop volumineuse pour cette vérification.'),{code:'body_limit'});}chunks.push(part.value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}return new TextDecoder().decode(bytes);
}
const sameSite=(a,b)=>new URL(a).hostname.replace(/^www\./,'')===new URL(b).hostname.replace(/^www\./,'');
async function follow(url,b,allowed){
 let current=publicSourceURL(url);for(let redirects=0;redirects<=3;redirects++){
  const response=await b.fetch(current);if(response.status<300||response.status>=400)return {response,url:current};
  await response.body?.cancel();const location=response.headers.get('Location');if(!location||redirects===3)throw Object.assign(Error('Redirection absente ou limite de redirections atteinte.'),{code:'redirect_limit',httpStatus:response.status});
  let next;try{next=publicSourceURL(new URL(location,current).href);}catch{throw Object.assign(Error('Redirection refusée vers une adresse non publique ou contenant un secret.'),{code:'unsafe_redirect',httpStatus:response.status});}
  if(!allowed(next))throw Object.assign(Error('Redirection vers un autre site refusée.'),{code:'unsafe_redirect',httpStatus:response.status});current=next;
 }
}
function xmlFeed(body){
 if(/<!DOCTYPE|<!ENTITY/i.test(body))return null;
 let xml=body.replace(/^\uFEFF/,'').trim();for(let i=0;i<8;i++){const next=xml.replace(/^(?:<\?[\s\S]*?\?>|<!--[\s\S]*?-->)\s*/,'');if(next===xml)break;xml=next;}
 const root=xml.match(/^<((?:[a-z_][\w.-]*:)?(?:rss|feed|RDF))\b([^>]*)>/i);if(!root)return null;const tag=root[1],local=tag.split(':').at(-1).toLowerCase();
 if(!new RegExp('</'+tag.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\s*>\\s*(?:<!--[\\s\\S]*?-->\\s*)*$','i').test(xml))return null;
 if(local==='rss'&&!/<(?:[\w.-]+:)?channel\b/i.test(xml))return null;
 if(local==='feed'&&!/http:\/\/www\.w3\.org\/2005\/Atom/i.test(root[2]))return null;
 if(local==='rdf'&&!/http:\/\/purl\.org\/rss\/1\.0\//i.test(root[2]))return null;
 const count=[...xml.matchAll(/<(?:[\w.-]+:)?(?:item|entry)\b/gi)].length,name=clean(xml.match(/<(?:[\w.-]+:)?title\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?title\s*>/i)?.[1]||'Flux '+(local==='feed'?'Atom':'RSS'));
 return {name:name.slice(0,200),count};
}
function metadata(html){
 const meta={},links=[];for(const match of html.matchAll(/<meta\b([^>]*)>/gi)){const a=attrs(match[1]),key=(a.property||a.name||'').toLowerCase();if(key&&!meta[key])meta[key]=a.content||'';}
 for(const match of html.matchAll(/<link\b([^>]*)>/gi))links.push(attrs(match[1]));
 return {meta,links,title:clean(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'')};
}
function wall(url,html,title){return /\/(?:authwall|checkpoint|login|signin)(?:[/?#]|$)|\/i\/flow\/login/i.test(new URL(url).pathname)||/sign in to (?:view|continue)|join linkedin to (?:view|see)|connectez-vous pour (?:voir|continuer)|javascript is not available/i.test(clean(html).slice(0,20000))||/^(?:just a moment|access denied|verify you are human|security verification|sign in|log in|connexion)/i.test(title);}
function suggestion(platform,url,name,origin,extra={}){return {platform,name:String(name||new URL(url).hostname).slice(0,200),url,...extra,origin,verification:origin==='catalog'?'catalog':origin==='web'?'indexed':'unverified',message:origin==='catalog'?'Source déjà présente dans le catalogue ; état à vérifier.':origin==='web'?'Profil ou site indexé sur le Web ; existence et collecte non vérifiées.':'Adresse proposée ; sélectionnez-la pour lancer une vérification.'};}
function localResults(platform,query,sources,profiles){
 const term=folded(query),results=[];if(platform==='site')for(const source of sources){try{const home=normalizeSourceURL('site',source.home||new URL(source.url).origin+'/'),feedUrl=normalizeSourceURL('site',source.url);if(folded([source.name,home,feedUrl].join(' ')).includes(term))results.push(suggestion(platform,home,source.name,'catalog',{home,feedUrl}));}catch{}}
 else for(const profile of profiles){const value=profile[platform];if(!value)continue;try{const url=normalizeSourceURL(platform,value);if(folded([profile.name,url,value].join(' ')).includes(term))results.push(suggestion(platform,url,profile.name,'catalog',platform==='x'?{handle:new URL(url).pathname.slice(1)}:{}));}catch{}}
 return results;
}
function directQuery(platform,query){const looks=/^(?:https?:\/\/|\/\/|www\.|(?:[a-z0-9-]+\.)+[a-z]{2,63}(?:[/?#]|$))/i.test(query)||platform==='x'&&query.startsWith('@');if(!looks)return null;return normalizeSourceURL(platform,query);}
function ddgTarget(href){let url=new URL(href,'https://duckduckgo.com/');for(let i=0;i<2&&/(^|\.)duckduckgo\.com$/.test(url.hostname)&&url.searchParams.has('uddg');i++)url=new URL(url.searchParams.get('uddg'));return url.href;}
/** Suggestions only. Selection must call verifySource; Web indexing never means verified. */
export async function searchSources({platform,query,sources=[],profiles=[],paused=false,fetcher=fetch,now=Date.now}={}){
 platform=platformValue(platform);query=typeof query==='string'?query.trim():'';const output={platform,query,results:[],status:paused?'paused':'partial',message:''};
 if(!['site','x','linkedin'].includes(platform)||query.length<2||query.length>2048){output.message='Saisissez au moins deux caractères ou une adresse publique valide.';return output;}
 if(/(?:^|\s)[^/\s:@]+:[^/\s@]+@(?:[a-z0-9-]+\.)+[a-z]{2,63}/i.test(query)||/\b(?:api[_-]?key|access[_-]?token|authorization|password|client[_-]?secret|session[_-]?id|token|secret)\s*[:=]/i.test(query)||/^(?:file|ftp|data|javascript|mailto):/i.test(query)){output.query='';output.message='Retirez les identifiants et paramètres secrets avant la recherche.';return output;}
 let direct;try{direct=directQuery(platform,query);}catch{output.query='';output.message='Cette adresse ne désigne pas un site public ou un profil pris en charge, ou contient un secret.';return output;}
 if(!direct&&query.length>120){output.message='La recherche par nom est limitée à 120 caractères.';return output;}
 output.results=localResults(platform,query,sources,profiles);
 if(direct)output.results.unshift(suggestion(platform,direct,platform==='x'?'@'+new URL(direct).pathname.slice(1):new URL(direct).hostname,'address',platform==='site'?{home:direct}:platform==='x'?{handle:new URL(direct).pathname.slice(1)}:{}));
 const unique=()=>output.results=[...new Map(output.results.map(item=>[item.url,item])).values()].slice(0,8);unique();
 if(paused){output.message='Appels externes suspendus : seules les adresses et le catalogue local sont proposés.';return output;}
 if(direct||output.results.length===8){output.status='ok';output.message=direct?'Adresse reconnue ; la vérification sera faite après sélection.':'Suggestions du catalogue local.';return output;}
 const b=budget(fetcher,now);try{
  const search=platform==='x'?query+' (site:x.com OR site:twitter.com)':platform==='linkedin'?query+' site:linkedin.com/in/':query+' site officiel RSS';
  const url='https://html.duckduckgo.com/html/?q='+encodeURIComponent(search),result=await follow(url,b,next=>new URL(next).hostname==='html.duckduckgo.com');
  if(!result.response.ok){await result.response.body?.cancel();output.message='La recherche Web est indisponible (HTTP '+result.response.status+'). Le catalogue et les adresses directes restent utilisables.';return output;}
  const html=await textBody(result.response,b);if(/id\s*=\s*["'](?:challenge-form|anomaly-form)["']|duckduckgo\.com\/anomaly\.js|Unfortunately,?\s+bots use DuckDuckGo|Please complete the following challenge/i.test(html)){output.message='Le moteur de recherche présente une protection anti-robot ; résultats Web non disponibles. Le catalogue et les adresses directes restent utilisables.';return output;}for(const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)){const a=attrs(match[1]);if(!a.class?.split(/\s+/).includes('result__a')||!a.href)continue;try{const url=normalizeSourceURL(platform,ddgTarget(a.href));output.results.push(suggestion(platform,url,clean(match[2]),'web',platform==='site'?{home:url}:platform==='x'?{handle:new URL(url).pathname.slice(1)}:{}));}catch{}}
  unique();output.status='ok';output.message=output.results.length?'Suggestions disponibles ; sélectionnez une source pour la vérifier.':'Aucun résultat compatible. Essayez un autre nom ou collez une adresse de profil.';
 }catch(error){output.message=error.code==='timeout'?'La recherche Web a dépassé son délai. Le catalogue reste disponible.':'La recherche Web n’a pas pu être lue. Le catalogue et les adresses directes restent disponibles.';}finally{b.close();}return output;
}
function httpMessage(status){return status===404?'Cette adresse est introuvable (HTTP 404).':status===403?'La plateforme refuse cette vérification (HTTP 403) ; cela ne prouve pas que le profil est absent.':status===429?'La plateforme limite les demandes (HTTP 429). Réessayez plus tard.':'La source répond HTTP '+status+' ; vérification non confirmée.';}
/** Public metadata/RSS check only. It never calls Bright Data, Gemini or a paid API. */
export async function verifySource({platform,url,paused=false,fetcher=fetch,now=Date.now}={}){
 platform=platformValue(platform);const output={platform,url:typeof url==='string'?url:'',status:'unverified',message:'',checkedAt:new Date(clock(now)).toISOString(),...(platform==='x'||platform==='linkedin'?{collectionTested:false}:{})};
 try{output.url=normalizeSourceURL(platform,url);}catch{output.status='error';output.message='Adresse publique invalide ou profil non pris en charge.';return output;}
 if(platform==='x')output.handle=new URL(output.url).pathname.slice(1);
 if(paused){output.message='Appels externes suspendus : aucune vérification réseau effectuée.';return output;}
 const b=budget(fetcher,now);try{
  const fetched=await follow(output.url,b,target=>platform==='site'?(sameSite(output.url,target)||knownFeedHost(output.url)&&knownFeedHost(target)):isSocialHost(platform,new URL(target).hostname)),response=fetched.response;output.httpStatus=response.status;
  if(!response.ok){await response.body?.cancel();output.status=response.status===404?'error':'unverified';output.message=httpMessage(response.status);return output;}
  const body=await textBody(response,b),feed=platform==='site'?xmlFeed(body):null;
  if(feed){Object.assign(output,{status:'verified',name:feed.name,home:new URL(fetched.url).origin+'/',feedUrl:fetched.url,feeds:[{url:fetched.url,name:feed.name,verified:true}],message:feed.count?'Flux RSS/Atom reconnu ; '+feed.count+' publication(s) présente(s).':'Flux RSS/Atom reconnu, mais aucune publication n’est actuellement présente.'});return output;}
  const data=metadata(body);output.name=(data.meta['og:title']||data.title||new URL(output.url).hostname).slice(0,200);
  if(wall(fetched.url,body,data.title)){output.message='Une page de connexion ou une protection empêche la vérification publique. Le profil ou site n’est pas déclaré absent.';return output;}
  if(platform!=='site'){
   const canonical=data.links.filter(l=>l.rel?.toLowerCase().split(/\s+/).includes('canonical')).map(l=>l.href);if(data.meta['og:url'])canonical.push(data.meta['og:url']);let matching=false;
   for(const address of canonical){try{if(normalizeSourceURL(platform,new URL(address,fetched.url).href)!==output.url){output.message='Les métadonnées renvoient vers un autre profil ; vérification refusée.';return output;}matching=true;}catch{output.message='Les métadonnées ne désignent pas un profil compatible ; vérification refusée.';return output;}}
   const handle=platform==='x'?output.handle:decodeURIComponent(new URL(output.url).pathname.split('/')[2]);
   const identity=platform==='x'?[data.meta['profile:username'],data.meta['twitter:creator']].some(value=>value?.replace(/^@/,'').toLowerCase()===handle)||new RegExp('(?:^|[\\s(])@'+handle+'(?:[\\s)]|$)','i').test(data.meta['og:title']||data.title):data.meta['og:type']==='profile'&&!!data.meta['og:title']&&!/^(?:linkedin|sign in|log in|join linkedin|connexion)(?:\s|$)/i.test(clean(data.meta['og:title']))&&!!(data.meta['og:description']||data.meta.description);
   if(matching&&identity){output.status='verified';output.message='Métadonnées publiques cohérentes avec ce profil. La collecte de ses publications n’a pas été testée.';}else output.message='La page répond, mais ses métadonnées ne suffisent pas à confirmer ce profil. La collecte n’a pas été testée.';return output;
  }
  output.home=fetched.url;const candidates=[];
  for(const link of data.links){if(!link.rel?.toLowerCase().split(/\s+/).includes('alternate')||!/(?:rss|atom|rdf)\+xml/i.test(link.type||'')||!link.href)continue;try{const address=publicSourceURL(new URL(link.href,fetched.url).href);if((sameSite(output.url,address)||knownFeedHost(address))&&!candidates.some(item=>item.url===address))candidates.push({url:address,name:clean(link.title||'Flux annoncé')});}catch{}}
  const chosen=candidates.slice(0,3),feeds=Array(chosen.length);let index=0;
  await Promise.all(Array.from({length:Math.min(2,chosen.length)},async()=>{while(index<chosen.length){const i=index++,candidate=chosen[i];feeds[i]={...candidate,verified:false};try{const checked=await follow(candidate.url,b,target=>sameSite(output.url,target)||knownFeedHost(target));if(!checked.response.ok){await checked.response.body?.cancel();continue;}const parsed=xmlFeed(await textBody(checked.response,b));if(parsed)feeds[i]={url:checked.url,name:parsed.name,verified:true,count:parsed.count};}catch{}}}));
  output.feeds=feeds.map(({count,...item})=>item);const selected=feeds.find(item=>item.verified);
  if(selected){output.status='verified';output.feedUrl=selected.url;output.message='Un flux RSS/Atom annoncé par ce site a été vérifié.'+(selected.count===0?' Il ne contient actuellement aucune publication.':'')+(b.signal.aborted?' Les autres flux n’ont pas tous pu être vérifiés dans le délai.':'');}else if(b.signal.aborted)output.message='La vérification a dépassé douze secondes ; résultat non confirmé.';else output.message=chosen.length?'Des flux sont annoncés, mais aucun n’a pu être confirmé comme RSS/Atom.':'Le site répond, mais aucun flux RSS/Atom vérifiable n’a été trouvé. Ajoutez une adresse de flux directe si vous la connaissez.';
 }catch(error){output.status='unverified';output.message=error.code==='timeout'?'La vérification a dépassé douze secondes ; résultat non confirmé.':error.code==='body_limit'?'La page dépasse la limite de lecture ; résultat non confirmé.':error.code==='unsafe_redirect'||error.code==='redirect_limit'?error.message:'Connexion impossible ou réponse illisible ; résultat non confirmé.';if(error.httpStatus)output.httpStatus=error.httpStatus;}finally{b.close();}return output;
}
