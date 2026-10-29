import {normalizeSourceURL} from './source-addresses.js';
// Persistent administration helpers. No credentials are accepted or returned.
export function adminURL(value){
 if(typeof value!=='string'||value.length>2048)throw Error('Adresse HTTPS invalide.');
 let u;try{u=new URL(value);}catch{throw Error('Adresse HTTPS invalide.');}
 u.hostname=u.hostname.toLowerCase().replace(/\.+$/,'');const h=u.hostname;
 if(u.protocol!=='https:'||u.username||u.password||u.port&&u.port!=='443'||!h.includes('.')||h.includes(':')||/^\d+\.\d+\.\d+\.\d+$/.test(h)||/(?:^|\.)(localhost|local|internal|lan|home|test|invalid|example)$/.test(h)||[...u.searchParams.keys()].some(k=>/^(?:access_token|token|secret|password|api[_-]?key|authorization|auth)$/i.test(k)))throw Error('Utilisez une adresse HTTPS publique, sans identifiant ni clé.');
 u.hash='';return u.href;
}
export function mergedCatalog(base,config={}){
 const deleted=new Set(config.deleted||[]),overrides=config.overrides||{};
 return [...base.map(s=>overrides[s.id]||s),...Object.values(overrides).filter(s=>!base.some(b=>b.id===s.id))].filter(s=>!deleted.has(s.id));
}
export function validateAdminSource(input,base){
 if(!input||typeof input!=='object'||typeof input.name!=='string'||!input.name.trim()||input.name.length>120)throw Error('Nom requis, limité à 120 caractères.');
 const id=input.id||'custom-'+crypto.randomUUID();if(!/^[a-z0-9][a-z0-9-]{0,79}$/.test(id)||['__proto__','constructor','prototype'].includes(id))throw Error('Identifiant de source invalide.');
 if(typeof input.enabled!=='boolean')throw Error('État actif/inactif requis.');
 const intervalMinutes=Number(input.intervalMinutes??base?.intervalMinutes??(base?.community?15:1));if(!Number.isInteger(intervalMinutes)||intervalMinutes<1||intervalMinutes>10080)throw Error('Intervalle requis entre 1 et 10 080 minutes.');
 const url=adminURL(input.url),home=adminURL(input.home||new URL(url).origin+'/');
 const language=String(input.language||base?.language||'fr');if(!/^[a-z]{2,3}$/.test(language))throw Error('Langue attendue : fr, en, etc.');
 return {...(base||{}),id,name:input.name.trim(),url,home,language,enabled:input.enabled,intervalMinutes,role:String(input.role||base?.role||'Source administrée').slice(0,200),country:String(input.country||base?.country||'International').slice(0,40),...(base?.kind?{kind:base.kind}:{})};
}
export function validateAdminProfiles(rows){
 if(!Array.isArray(rows)||rows.length>30)throw Error('Maximum de 30 profils.');
 const ids=new Set(),handles=new Set(),linkedin=new Set();
 return rows.map(p=>{
  if(!p||typeof p.name!=='string'||!p.name.trim()||p.name.length>120||typeof p.enabled!=='boolean')throw Error('Profil invalide.');
  const id=p.id||'profile-'+crypto.randomUUID();if(typeof id!=='string'||!/^[a-z0-9-]{1,80}$/.test(id)||['constructor','prototype','__proto__'].includes(id))throw Error('Identifiant de profil invalide.');
  if(ids.has(id))throw Error('Profil dupliqué.');ids.add(id);
  const x=p.x?new URL(normalizeSourceURL('x',p.x)).pathname.slice(1):null;
  const url=p.linkedin?normalizeSourceURL('linkedin',p.linkedin):null;
  if(x&&handles.has(x))throw Error('Ce compte X figure déjà dans les profils.');
  if(url&&linkedin.has(url.toLocaleLowerCase('fr')))throw Error('Ce compte LinkedIn figure déjà dans les profils.');
  if(x)handles.add(x);if(url)linkedin.add(url.toLocaleLowerCase('fr'));
  return {id,name:p.name.trim(),x,linkedin:url,enabled:p.enabled,priority:Math.max(0,Math.min(100,Number(p.priority)||0))};
 });
}
export async function adminOperation(storage,base,input){
 if(input.action==='read')return adminApply(storage,base,input);
 if(typeof storage.transaction!=='function')throw Error('Stockage transactionnel requis.');
 return storage.transaction(tx=>adminApply(tx,base,input));
}
async function adminApply(storage,base,input){
 const config=await storage.get('admin:config')||{revision:0,overrides:{},deleted:[],feedsPaused:false,socialPaused:false,roles:{},profiles:[],backups:[]};
 config.roles??={};config.profiles??=[];config.trash??={};config.rssScheduled??=true;
 if(input.action==='read')return {config,sources:mergedCatalog(base,config),journal:await storage.get('admin:journal')||[]};
 if(input.revision!==config.revision)return {error:'Configuration modifiée ailleurs. Rechargez avant d’enregistrer.',status:409};
 const catalog=mergedCatalog(base,config);let detail='',id=input.id;
 try{
  if(input.action==='save'){
   const old=catalog.find(s=>s.id===input.source?.id);if(input.source?.id&&!old&&!base.some(s=>s.id===input.source.id)&&!String(input.source.id).startsWith('custom-'))throw Error('Nouvelle source : identifiant custom requis.');
   const source=validateAdminSource(input.source,old||base.find(s=>s.id===input.source?.id));id=source.id;
   if(catalog.some(s=>s.id!==id&&s.url===source.url))throw Error('Ce flux figure déjà dans le catalogue. Modifiez la source existante.');
   if(!old&&catalog.length>=200)throw Error('Maximum de 200 sources atteint.');
   config.overrides={...config.overrides,[id]:source};config.deleted=config.deleted.filter(x=>x!==id);detail=source.name;
  }else if(input.action==='delete'){
   const source=catalog.find(s=>s.id===id);if(!source)throw Error('Source introuvable.');config.trash[id]={source,deletedAt:new Date().toISOString()};config.deleted=[...new Set([...config.deleted,id])];delete config.overrides[id];detail=source.name;
  }else if(input.action==='restore'){
   const removed=config.trash[id]?.source;if(!base.some(s=>s.id===id)&&!removed)throw Error('Source initiale ou supprimée introuvable.');if(removed&&!base.some(s=>s.id===id))config.overrides[id]=removed;else delete config.overrides[id];delete config.trash[id];config.deleted=config.deleted.filter(x=>x!==id);detail='Configuration initiale restaurée';
  }else if(input.action==='import'){
   const rows=input.sources;if(!Array.isArray(rows)||!rows.length||rows.length>150)throw Error('Import limité à 150 sources.');
   for(const row of rows){const source=validateAdminSource({...row,id:row.id||'custom-'+crypto.randomUUID(),enabled:row.enabled??true},catalog.find(s=>s.id===row.id));if(catalog.some(s=>s.url===source.url&&s.id!==source.id))continue;config.overrides[source.id]=source;config.deleted=config.deleted.filter(x=>x!==source.id);}
   if(mergedCatalog(base,config).length>200)throw Error('Maximum de 200 sources atteint.');detail=rows.length+' sources examinées';
  }else if(input.action==='restore-backup'){
   const backup=await storage.get('admin:backup:'+input.backupId);if(!backup)throw Error('Sauvegarde introuvable.');for(const field of ['overrides','deleted','trash','feedsPaused','socialPaused','externalPaused','rssScheduled','profiles','profilesConfigured','socialSchedule'])if(backup.config[field]!==undefined)config[field]=backup.config[field];detail='Sauvegarde '+input.backupId+' restaurée';
  }else if(input.action==='role'){
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email||'')||!['reader','editor','admin'].includes(input.role))throw Error('Identité ou rôle invalide.');config.roles[input.email.toLowerCase()]=input.role;detail=input.email+': '+input.role;
  }else if(input.action==='schedule'){
   if(typeof input.rssScheduled!=='boolean')throw Error('Planification invalide.');config.rssScheduled=input.rssScheduled;detail='Planification RSS '+(input.rssScheduled?'active':'inactive');
  }else if(input.action==='profiles'){
   config.profiles=validateAdminProfiles(input.profiles);config.profilesConfigured=true;
   if(input.socialSchedule||config.socialSchedule){input.socialSchedule=input.socialSchedule||config.socialSchedule;for(const k of ['xHours','linkedinHours'])if(!Number.isInteger(input.socialSchedule[k])||input.socialSchedule[k]<6||input.socialSchedule[k]>168)throw Error('Intervalle social invalide.');const active=config.profiles.filter(p=>p.enabled),forecast=active.filter(p=>p.x).length*3*Math.ceil(744/input.socialSchedule.xHours)+active.filter(p=>p.linkedin).length*Math.ceil(744/input.socialSchedule.linkedinHours);if(forecast>4000)throw Error('Ce calendrier dépasse 4 000 résultats réservés par mois de 31 jours.');config.socialSchedule=input.socialSchedule;}detail=config.profiles.length+' profils enregistrés';
  }else if(input.action==='pause'){
   if(!['feedsPaused','socialPaused','externalPaused'].includes(input.target)||typeof input.value!=='boolean')throw Error('Commande de pause invalide.');config[input.target]=input.value;detail=input.target+': '+(input.value?'pause':'reprise');
  }else return {error:'Action inconnue.',status:400};
 }catch(e){return {error:e.message,status:400};}
 if(new TextEncoder().encode(JSON.stringify(config)).length>110000)return {error:'Configuration trop volumineuse. Réduisez les adresses ou le nombre de sources.',status:400};
 const backupId=String(config.revision)+'-'+Date.now();const before=await storage.get('admin:config');if(before)await storage.put('admin:backup:'+backupId,{id:backupId,at:new Date().toISOString(),config:before});const backups=await storage.get('admin:backups')||[];if(before)backups.unshift({id:backupId,at:new Date().toISOString(),revision:before.revision});for(const old of backups.slice(20))await storage.delete('admin:backup:'+old.id);await storage.put('admin:backups',backups.slice(0,20));
 config.revision++;config.updatedAt=new Date().toISOString();
 const journal=await storage.get('admin:journal')||[];journal.unshift({at:config.updatedAt,action:input.action,sourceId:id||null,actor:input.actor||'administrator',detail});
 await storage.put('admin:config',config);await storage.put('admin:journal',journal.slice(0,100));
 if(['restore-backup','import'].includes(input.action)){for(const key of (await storage.list({prefix:'feed:',limit:200})).keys())await storage.delete(key);}
 if(id){await storage.delete('feed:'+id);await storage.delete('admin:probe:'+id);}
 return {ok:true,revision:config.revision};
}
