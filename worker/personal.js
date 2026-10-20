import {adminURL} from './admin.js';
const empty=()=>({revision:0,bookmarks:{},notes:{},read:[],watchlist:[],progress:[],preferences:{},cases:{},alerts:[]});
export function bookmarkSnapshot(event){
 if(!event||['__proto__','constructor','prototype'].includes(event.id)||typeof event.id!=='string'||event.id.length>600||typeof event.title!=='string')throw Error('Publication invalide.');
 return {id:event.id,title:event.title.slice(0,400),summary:String(event.summary||'').slice(0,4000),url:adminURL(event.url),source:String(event.source||'').slice(0,150),date:Number.isFinite(Date.parse(event.date))?new Date(event.date).toISOString():null,cves:(Array.isArray(event.cves)?event.cves:[]).filter(c=>/^CVE-\d{4}-\d{4,}$/i.test(c)).slice(0,20),savedAt:event.savedAt||new Date().toISOString()};
}
export async function personalOperation(storage,user,input){
 const key='personal:'+user,current=await storage.get(key)||empty();if(input.action==='read')return current;
 if(input.revision!==current.revision)return {error:'Vos données ont changé sur un autre appareil. Rechargez puis réessayez.',status:409};
 const data=structuredClone(current);
 try{
  if(input.action==='bookmark'){const item=bookmarkSnapshot(input.event);if(input.remove)delete data.bookmarks[item.id];else data.bookmarks[item.id]=item;}
  else if(input.action==='remove-bookmark')delete data.bookmarks[String(input.id)];
  else if(input.action==='note'){if(['__proto__','constructor','prototype'].includes(input.id)||typeof input.id!=='string'||input.id.length>600||typeof input.text!=='string'||input.text.length>5000)throw Error('Note invalide.');data.notes[input.id]={text:input.text,tags:Array.isArray(input.tags)?input.tags.map(String).filter(t=>t.length<=40).slice(0,10):[],updatedAt:new Date().toISOString()};}
  else if(input.action==='read-items'){if(!Array.isArray(input.ids)||input.ids.length>1000)throw Error('Sélection invalide.');data.read=[...new Set([...data.read,...input.ids.filter(x=>typeof x==='string'&&x.length<=600)])].slice(-2000);}
  else if(input.action==='watchlist'){if(!Array.isArray(input.items)||input.items.length>50||input.items.some(x=>typeof x!=='string'||x.length>100))throw Error('Surveillance limitée à 50 termes de 100 caractères.');data.watchlist=[...new Set(input.items.map(x=>x.trim()).filter(Boolean))];}
  else if(input.action==='progress'){if(!Array.isArray(input.ids)||input.ids.length>200||input.ids.some(x=>typeof x!=='string'||x.length>100))throw Error('Progression invalide.');data.progress=[...new Set(input.ids)];}
  else if(input.action==='preferences'){if(!input.values||typeof input.values!=='object'||JSON.stringify(input.values).length>4000)throw Error('Préférences invalides.');data.preferences={...data.preferences,...input.values};}
  else if(input.action==='case'){if(typeof input.name!=='string'||!input.name.trim()||input.name.length>120||!Array.isArray(input.events)||input.events.length>20)throw Error('Dossier limité à 20 publications.');const id=input.id||crypto.randomUUID();if(typeof id!=='string'||id.length>100||['__proto__','constructor','prototype'].includes(id))throw Error('Identifiant invalide');data.cases[id]={id,name:input.name,events:input.events.map(bookmarkSnapshot),updatedAt:new Date().toISOString()};}
  else if(input.action==='delete-case')delete data.cases[input.id];
  else if(input.action==='alerts'){if(!Array.isArray(input.items)||input.items.length>100)throw Error('Alertes invalides.');data.alerts=input.items.map(a=>({id:String(a.id).slice(0,600),message:String(a.message).slice(0,500),at:new Date().toISOString()}));}
  else if(input.action==='import'){
   const value=input.data;if(!value||!value.bookmarks||typeof value.bookmarks!=='object')throw Error('Sauvegarde personnelle invalide.');
   for(const item of Object.values(value.bookmarks).slice(0,200)){const safe=bookmarkSnapshot(item);data.bookmarks[safe.id]=safe;}
   if(Array.isArray(value.watchlist))data.watchlist=[...new Set([...data.watchlist,...value.watchlist.filter(x=>typeof x==='string'&&x.length<=100)])].slice(0,50);
   if(value.notes&&typeof value.notes==='object')for(const [id,note] of Object.entries(value.notes)){if(['__proto__','constructor','prototype'].includes(id)||id.length>600||typeof note.text!=='string'||note.text.length>5000)throw Error('Note importée invalide.');data.notes[id]={text:note.text,tags:Array.isArray(note.tags)?note.tags.map(String).filter(t=>t.length<=40).slice(0,10):[],updatedAt:new Date().toISOString()};}
   if(value.cases&&typeof value.cases==='object')for(const [id,item] of Object.entries(value.cases)){if(!/^[a-zA-Z0-9-]{1,100}$/.test(id)||['constructor','prototype'].includes(id)||typeof item.name!=='string'||item.name.length>120||!Array.isArray(item.events)||item.events.length>20)throw Error('Dossier importé invalide.');data.cases[id]={id,name:item.name,events:item.events.map(bookmarkSnapshot),updatedAt:new Date().toISOString()};}
   if(Array.isArray(value.read))data.read=[...new Set([...data.read,...value.read.filter(id=>typeof id==='string'&&id.length<=600)])].slice(-2000);
   if(value.preferences&&typeof value.preferences==='object'&&JSON.stringify(value.preferences).length<=4000)data.preferences=JSON.parse(JSON.stringify(value.preferences));
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
