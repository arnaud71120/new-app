// Persistent administration helpers. No credentials are accepted or returned.
export function adminURL(value){
 if(typeof value!=='string'||value.length>2048)throw Error('Adresse HTTPS invalide.');
 let u;try{u=new URL(value);}catch{throw Error('Adresse HTTPS invalide.');}
 const h=u.hostname.toLowerCase();
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
export async function adminOperation(storage,base,input){
 const config=await storage.get('admin:config')||{revision:0,overrides:{},deleted:[],feedsPaused:false,socialPaused:false};
 if(input.action==='read')return {config,sources:mergedCatalog(base,config),journal:await storage.get('admin:journal')||[]};
 if(input.revision!==config.revision)return {error:'Configuration modifiée ailleurs. Rechargez avant d’enregistrer.',status:409};
 const catalog=mergedCatalog(base,config);let detail='',id=input.id;
 try{
  if(input.action==='save'){
   const old=catalog.find(s=>s.id===input.source?.id);if(input.source?.id&&!old&&!base.some(s=>s.id===input.source.id)&&!String(input.source.id).startsWith('custom-'))throw Error('Nouvelle source : identifiant custom requis.');
   const source=validateAdminSource(input.source,old||base.find(s=>s.id===input.source?.id));id=source.id;
   if(!old&&catalog.length>=200)throw Error('Maximum de 200 sources atteint.');
   config.overrides={...config.overrides,[id]:source};config.deleted=config.deleted.filter(x=>x!==id);detail=source.name;
  }else if(input.action==='delete'){
   const source=catalog.find(s=>s.id===id);if(!source)throw Error('Source introuvable.');config.deleted=[...new Set([...config.deleted,id])];delete config.overrides[id];detail=source.name;
  }else if(input.action==='restore'){
   if(!base.some(s=>s.id===id))throw Error('Source initiale introuvable.');delete config.overrides[id];config.deleted=config.deleted.filter(x=>x!==id);detail='Configuration initiale restaurée';
  }else if(input.action==='pause'){
   if(!['feedsPaused','socialPaused'].includes(input.target)||typeof input.value!=='boolean')throw Error('Commande de pause invalide.');config[input.target]=input.value;detail=input.target+': '+(input.value?'pause':'reprise');
  }else return {error:'Action inconnue.',status:400};
 }catch(e){return {error:e.message,status:400};}
 if(new TextEncoder().encode(JSON.stringify(config)).length>110000)return {error:'Configuration trop volumineuse. Réduisez les adresses ou le nombre de sources.',status:400};
 config.revision++;config.updatedAt=new Date().toISOString();
 const journal=await storage.get('admin:journal')||[];journal.unshift({at:config.updatedAt,action:input.action,sourceId:id||null,detail});
 await storage.put('admin:config',config);await storage.put('admin:journal',journal.slice(0,100));
 if(id){await storage.delete('feed:'+id);await storage.delete('admin:probe:'+id);}
 return {ok:true,revision:config.revision};
}
