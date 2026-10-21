// Standards-only Web Push: empty messages carry no article, URL or private content.
import {adminURL} from './admin.js';
import {watchMatches,sourceAlertIncidents} from './personal.js';
const SUB='push:sub:',HOUR=3600000,MAX_SUBSCRIPTIONS=200,MAX_USER_SUBSCRIPTIONS=3,KEYS='push:keys:v1',DEFAULT_SUBJECT='https://cyberveille-fr.arnaudvb7-b40.workers.dev/';
const base64=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
function decode(value){if(typeof value!=='string'||!/^[A-Za-z0-9_-]+$/.test(value))throw Error('Configuration Web Push invalide.');try{return Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(value.length/4)*4,'=')),c=>c.charCodeAt(0));}catch{throw Error('Configuration Web Push invalide.');}}
const hash=async value=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(n=>n.toString(16).padStart(2,'0')).join('');
function userId(user){if(typeof user!=='string'||!/^[a-f0-9]{64}$/.test(user))throw Error('Identité Web Push invalide.');return user;}
export function pushEndpoint(value){
 if(typeof value!=='string'||value.length>2048)throw Error('Abonnement Web Push invalide.');let url;try{url=new URL(value);}catch{throw Error('Abonnement Web Push invalide.');}
 if(url.protocol!=='https:'||url.username||url.password||url.port||url.hash||!['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com'].includes(url.hostname)||url.pathname.length<10)throw Error('Service Web Push non autorisé.');return url.href;
}
async function configuration(env){
 if(!env.WEB_PUSH_PRIVATE_JWK||!env.WEB_PUSH_PUBLIC_KEY||!env.WEB_PUSH_SUBJECT)return null;
 const raw=env.WEB_PUSH_PRIVATE_JWK;if(typeof raw!=='string'||raw.length>4096)throw Error('Configuration Web Push invalide.');const jwk=JSON.parse(raw);
 if(jwk.kty!=='EC'||jwk.crv!=='P-256'||jwk.alg&&jwk.alg!=='ES256'||decode(jwk.x).length!==32||decode(jwk.y).length!==32||decode(jwk.d).length!==32)throw Error('Configuration Web Push invalide.');
 const publicBytes=decode(env.WEB_PUSH_PUBLIC_KEY);if(publicBytes.length!==65||publicBytes[0]!==4||base64(Uint8Array.from([4,...decode(jwk.x),...decode(jwk.y)]))!==env.WEB_PUSH_PUBLIC_KEY)throw Error('Configuration Web Push invalide.');
 const subject=String(env.WEB_PUSH_SUBJECT);if(subject.length>300||!(/^mailto:[^@\s?]+@[^@\s?]+\.[^@\s?]+$/.test(subject)||subject.startsWith('https:')&&adminURL(subject)===subject))throw Error('Configuration Web Push invalide.');
 const key=await crypto.subtle.importKey('jwk',{kty:'EC',crv:'P-256',x:jwk.x,y:jwk.y,d:jwk.d,ext:true},{name:'ECDSA',namedCurve:'P-256'},false,['sign']);const verify=await crypto.subtle.importKey('raw',publicBytes,{name:'ECDSA',namedCurve:'P-256'},false,['verify']),probe=new TextEncoder().encode('Cyberveille VAPID configuration');if(!await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},verify,await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,probe),probe))throw Error('Configuration Web Push invalide.');return {key,publicKey:env.WEB_PUSH_PUBLIC_KEY,subject};
}
async function pushEnvironment(storage,env,create=false){
 if(env.WEB_PUSH_PRIVATE_JWK||env.WEB_PUSH_PUBLIC_KEY)return {...env,WEB_PUSH_SUBJECT:env.WEB_PUSH_SUBJECT||DEFAULT_SUBJECT};
 let saved=await storage.get(KEYS);
 if(!saved&&create){const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);saved={privateJwk:JSON.stringify(await crypto.subtle.exportKey('jwk',pair.privateKey)),publicKey:base64(await crypto.subtle.exportKey('raw',pair.publicKey)),createdAt:Date.now()};await storage.put(KEYS,saved);}
 return saved?{...env,WEB_PUSH_PRIVATE_JWK:saved.privateJwk,WEB_PUSH_PUBLIC_KEY:saved.publicKey,WEB_PUSH_SUBJECT:env.WEB_PUSH_SUBJECT||DEFAULT_SUBJECT}:env;
}
export async function pushConfiguration(env={}){try{const config=await configuration(env);return {ready:!!config,publicKey:config?.publicKey||null,reason:config?null:'configuration_required'};}catch{return {ready:false,publicKey:null,reason:'invalid_configuration'};}}
export async function vapidAuthorization(endpoint,env,now=Date.now()){
 const target=pushEndpoint(endpoint),config=await configuration(env);if(!config)throw Error('Web Push non configuré.');const encode=value=>base64(new TextEncoder().encode(JSON.stringify(value)));const header=encode({typ:'JWT',alg:'ES256'}),claims=encode({aud:new URL(target).origin,exp:Math.floor(now/1000)+3600,sub:config.subject}),message=header+'.'+claims;
 const signature=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},config.key,new TextEncoder().encode(message));return 'vapid t='+message+'.'+base64(signature)+', k='+config.publicKey;
}
export async function pushOperation(storage,user,input={},env={},now=Date.now()){
 userId(user);const prefix=SUB+user+':';
 if(input.action==='config'){const config=await pushConfiguration(await pushEnvironment(storage,env,true)),subscriptions=await storage.list({prefix,limit:MAX_USER_SUBSCRIPTIONS+1});return {...config,enabled:subscriptions.size>0,count:subscriptions.size};}
 if(input.action==='subscribe'){
  env=await pushEnvironment(storage,env,true);if(!(await pushConfiguration(env)).ready)return {error:'Notifications serveur non configurées.',status:503};
  let endpoint;try{endpoint=pushEndpoint(input.subscription?.endpoint);}catch{return {error:'Abonnement Web Push invalide ou service non autorisé.',status:400};}
  const expirationTime=input.subscription.expirationTime??null;if(expirationTime!==null&&(!Number.isFinite(expirationTime)||expirationTime<=now))return {error:'Abonnement Web Push expiré.',status:400};
  const id=await hash(endpoint),key=prefix+id,existing=await storage.get(key),own=await storage.list({prefix,limit:MAX_USER_SUBSCRIPTIONS+1});
  if(!existing&&own.size>=MAX_USER_SUBSCRIPTIONS)return {error:'Trois appareils maximum. Retirez un abonnement avant d’en ajouter un.',status:409};
  if(!existing&&(await storage.list({prefix:SUB,limit:MAX_SUBSCRIPTIONS+1})).size>=MAX_SUBSCRIPTIONS)return {error:'Capacité des notifications serveur atteinte.',status:409};
  await storage.put(key,{id,user,endpoint,expirationTime,createdAt:existing?.createdAt||now,updatedAt:now});return {ok:true,enabled:true,count:existing?own.size:own.size+1};
 }
 if(input.action==='unsubscribe'){
  let endpoint;try{endpoint=pushEndpoint(input.endpoint);}catch{return {error:'Abonnement Web Push invalide.',status:400};}await storage.delete(prefix+await hash(endpoint));const own=await storage.list({prefix,limit:MAX_USER_SUBSCRIPTIONS+1});return {ok:true,enabled:own.size>0,count:own.size};
 }
 return {error:'Action Web Push inconnue.',status:400};
}
export async function pushCron(storage,env={},options={}){
 const now=options.now??Date.now(),fetcher=options.fetcher||fetch,limit=Math.max(1,Math.min(12,options.limit||8));
 if(env.EXTERNAL_CALLS_PAUSED==='true'||(await storage.get('admin:config'))?.externalPaused)return {status:'disabled',attempted:0,delivered:0,removed:0};env=await pushEnvironment(storage,env);if(!(await pushConfiguration(env)).ready)return {status:'disabled',attempted:0,delivered:0,removed:0};
 const records=await storage.list({prefix:SUB,limit:MAX_SUBSCRIPTIONS+1}),byUser=new Map();let removed=0;
 for(const [key,row] of records){if(!row||!Number.isFinite(row.createdAt)||row.expirationTime!==null&&row.expirationTime<=now||now-row.updatedAt>90*86400000){await storage.delete(key);removed++;continue;}try{userId(row.user);pushEndpoint(row.endpoint);}catch{await storage.delete(key);removed++;continue;}if(!byUser.has(row.user))byUser.set(row.user,[]);byUser.get(row.user).push({key,...row});}
 const cursor=await storage.get('push:cursor'),users=[...byUser.keys()].sort(),ordered=[...users.filter(u=>u>(cursor||'')),...users.filter(u=>u<=(cursor||''))];let attempted=0,delivered=0,examined=0;const httpStatuses={};
 for(const user of ordered){if(attempted>=limit||examined>=20)break;examined++;await storage.put('push:cursor',user);const subscriptions=byUser.get(user),createdAt=Math.min(...subscriptions.map(s=>s.createdAt)),personal=await storage.get('personal:'+user);if(!personal)continue;
  const previous=await storage.get('push:incidents:'+user)||[],incidents=sourceAlertIncidents(options.sources||[],previous,new Date(now).toISOString());await storage.put('push:incidents:'+user,incidents);
  const read=new Set(personal.read||[]),events=(options.events||[]).filter(e=>Date.parse(e.date)>=createdAt-300000&&Date.parse(e.date)<=now&&!read.has(e.id)&&watchMatches(e,personal.watchlist||[]).length),alerts=[...events.map(e=>e.id),...incidents.filter(i=>i.state==='open'&&Date.parse(i.startedAt)>=createdAt-300000&&!read.has(i.id)).map(i=>i.id)];if(!alerts.length)continue;
  const hashes=await Promise.all(alerts.slice(0,100).map(hash)),past=await storage.get('push:delivered:'+user)||[],unseen=hashes.filter(id=>!past.includes(id));if(!unseen.length)continue;
  const rate=await storage.get('push:rate:'+user);if(rate&&now-rate.at<HOUR)continue;
  // Reserve before sending: a timeout or runtime restart cannot cause repeated sends.
  await storage.put('push:rate:'+user,{at:now});let successful=false;
  for(const subscription of subscriptions){if(attempted>=limit)break;attempted++;try{const response=await fetcher(subscription.endpoint,{method:'POST',redirect:'manual',signal:AbortSignal.timeout(8000),headers:{Authorization:await vapidAuthorization(subscription.endpoint,env,now),TTL:'3600',Urgency:'normal'}});await response.body?.cancel();httpStatuses[response.status]=(httpStatuses[response.status]||0)+1;if(response.status===404||response.status===410){await storage.delete(subscription.key);removed++;}else if(response.ok){delivered++;successful=true;}}catch{httpStatuses.network_error=(httpStatuses.network_error||0)+1;/* No endpoint, key, or private content is written to logs. */}}
  if(successful)await storage.put('push:delivered:'+user,[...new Set([...past,...unseen])].slice(-300));
 }
 return {status:'complete',attempted,delivered,removed,examined,httpStatuses};
}
