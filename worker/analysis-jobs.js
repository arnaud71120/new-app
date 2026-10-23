import {analysisDocumentURL} from './analysis-input.js';

const PREFIX='analysis:',RUN_LIMIT=120000,RETENTION=3600000,USER_LIMIT=20,GLOBAL_LIMIT=100;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACTIVE=new Set(['queued','preparing','generating']);
const MESSAGES={
 invalid_request:'La demande d’analyse est invalide.',request_conflict:'Cette demande existe déjà avec un contenu différent.',job_not_found:'Cette analyse est introuvable pour votre compte.',job_expired:'Cette analyse a expiré. Créez une nouvelle demande.',analysis_capacity:'Trop d’analyses sont conservées. Réessayez après leur expiration.',
 selection_invalid:'La sélection de publications est invalide.',source_missing:'Les publications choisies ne sont plus présentes dans le stockage.',event_not_found:'Cette information n’est plus disponible dans les publications conservées.',not_found:'Cette information n’est plus disponible dans les publications conservées.',no_articles:'Aucune publication exploitable ne permet cette analyse.',invalid_event:'Les publications de cette analyse sont invalides.',
 insufficient_quota:'Le quota API Gemini est épuisé. Attendez son renouvellement ou utilisez la copie pour Gemini.',provider_limit:'Gemini limite actuellement les demandes. Réessayez après le délai indiqué.',app_rate_limit:'Une analyse est déjà en cours ou le débit de l’application est limité.',app_daily_limit:'La limite quotidienne de sécurité est atteinte. Réessayez demain.',owner_paused:'Les appels externes sont suspendus par l’administrateur.',
 provider_invalid:'Ce fournisseur d’analyse n’est pas pris en charge.',model_invalid:'Le modèle Gemini configuré est invalide.',model_parameter_error:'Un paramètre est incompatible avec le modèle Gemini.',context_limit:'Les publications dépassent la capacité du modèle Gemini.',configuration:'Le fournisseur Gemini doit être configuré.',free_confirmation:'Le projet Gemini gratuit doit être confirmé avant une analyse.',
 provider_error:'Gemini n’a pas pu traiter cette demande.',invalid_response:'Gemini a renvoyé une réponse illisible.',empty_response:'Gemini n’a pas fourni de texte exploitable.',network_error:'La connexion à Gemini a été interrompue.',result_too_large:'La réponse dépasse la capacité de conservation de cette analyse.',
 analysis_timeout:'La préparation de l’analyse a dépassé deux minutes. Aucun nouvel appel n’a été lancé.',analysis_interrupted:'La préparation a été interrompue. Aucun appel fournisseur n’a été relancé.',analysis_uncertain:'L’analyse a été envoyée au fournisseur, mais sa réponse n’a pas été confirmée. Elle ne sera pas relancée automatiquement.',analysis_error:'L’analyse n’a pas pu être préparée.',storage_unavailable:'Le stockage des analyses est temporairement indisponible.'
};
const size=value=>new TextEncoder().encode(JSON.stringify(value)).length;
function safeError(value,fallback='analysis_error'){
 const code=value&&Object.hasOwn(MESSAGES,value.code)?value.code:fallback;
 const output={error:MESSAGES[code],code};
 if(Number.isInteger(value?.httpStatus)&&value.httpStatus>=400&&value.httpStatus<=599)output.providerHttpStatus=value.httpStatus;
 if(Number.isFinite(value?.retryAfterSeconds))output.retryAfterSeconds=Math.max(1,Math.min(86400,Math.ceil(value.retryAfterSeconds)));
 return output;
}
function failure(code,httpStatus,jobId=null){return {jobId,status:'failed',stage:'failed',httpStatus,...safeError({code})};}
function jsonValue(value,depth=0){
 if(depth>8)throw Error('invalid_request');
 if(value===null||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value))return value;
 if(typeof value==='string'&&value.length<=12000)return value;
 if(Array.isArray(value)&&value.length<=50)return value.map(v=>jsonValue(v,depth+1));
 if(value&&Object.getPrototypeOf(value)===Object.prototype&&Object.keys(value).length<=50){const result={};for(const key of Object.keys(value).sort()){if(['__proto__','constructor','prototype'].includes(key))throw Error('invalid_request');result[key]=jsonValue(value[key],depth+1);}return result;}
 throw Error('invalid_request');
}
function inputValue(user,input,identity){
 if(typeof user!=='string'||!/^[a-f0-9]{64}$/.test(user)||!input||!UUID.test(input.requestId)||input.id!==undefined&&!UUID.test(input.id)||typeof input.eventId!=='string'||!input.eventId.trim()||input.eventId.length>600)throw Error('invalid_request');
 if(input.urls!==undefined&&(!Array.isArray(input.urls)||input.urls.length>12))throw Error('invalid_request');
 if(input.sourceIds!==undefined&&(!Array.isArray(input.sourceIds)||input.sourceIds.length>12||input.sourceIds.some(id=>typeof id!=='string'||!/^[a-z0-9][a-z0-9-]{0,79}$/.test(id))))throw Error('invalid_request');
 if(typeof identity!=='string'||identity.length>400)throw Error('invalid_request');
 const checkedURL=value=>{const url=analysisDocumentURL(value);if(!url)throw Error('invalid_request');return url;};
 const value={id:(input.id||input.requestId).toLowerCase(),requestId:input.requestId.toLowerCase(),eventId:input.eventId,urls:[...new Set((input.urls||[]).map(checkedURL))].sort(),sourceIds:[...new Set(input.sourceIds||[])].sort()};
 if(input.manual!==undefined){value.manual=jsonValue(input.manual);if(!value.manual||typeof value.manual!=='object'||Array.isArray(value.manual))throw Error('invalid_request');}
 if(size(value)>20000)throw Error('invalid_request');return {input:value,identity};
}
async function digest(value){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value))))].map(n=>n.toString(16).padStart(2,'0')).join('');}
function resultValue(value){
 if(!value||typeof value.text!=='string'||!value.text.trim())throw {code:'empty_response'};
 const result={text:value.text};
 if(value.provider==='gemini')result.provider='gemini';
 if(typeof value.model==='string'&&/^(?:models\/)?gemini-[a-zA-Z0-9._-]{1,100}$/.test(value.model))result.model=value.model;
 for(const key of ['truncated','cached'])if(typeof value[key]==='boolean')result[key]=value[key];
 if(Number.isFinite(Date.parse(value.generatedAt)))result.generatedAt=new Date(value.generatedAt).toISOString();
 if(size(result)>100000)throw {code:'result_too_large'};return result;
}

/** Durable, user-isolated jobs. Idempotency lasts for the one-hour retention window.
 * No network retry or replay after restart; expired request UUIDs must not be reused.
 * prepare(input,context) resolves stored articles; generate(articles,context) calls Gemini.
 * Context contains user,jobId,deadlineAt,signal,identity,input. The caller maps httpStatus.
 */
export class AnalysisJobs {
 constructor({storage,waitUntil,prepare,generate,now=Date.now}){
  if(!storage||typeof waitUntil!=='function'||typeof prepare!=='function'||typeof generate!=='function'||typeof now!=='function')throw Error('Invalid analysis job dependencies');
  Object.assign(this,{storage,waitUntil,prepare,generate,now});this.inflight=new Map();this.queue=Promise.resolve();
 }
 _exclusive(work){const task=this.queue.then(work);this.queue=task.catch(()=>{});return task;}
 _key(user,requestId){return PREFIX+user+':'+requestId;}
 _public(row,httpStatus=200){
  const output={jobId:row.jobId,status:row.stage,stage:row.stage,httpStatus,createdAt:new Date(row.createdAt).toISOString(),updatedAt:new Date(row.updatedAt).toISOString(),deadlineAt:new Date(row.deadlineAt).toISOString(),expiresAt:new Date(row.expiresAt).toISOString()};
  if(row.result)output.result=structuredClone(row.result);
  for(const key of ['error','code','providerHttpStatus','retryAfterSeconds'])if(row[key]!==undefined)output[key]=row[key];return output;
 }
 async _expire(key,row){
  if(!ACTIVE.has(row.stage)||this.now()<row.deadlineAt)return row;
  const generating=row.stage==='generating';row={...row,stage:generating?'uncertain':'failed',updatedAt:this.now(),...safeError({code:generating?'analysis_uncertain':this.inflight.has(key)?'analysis_timeout':'analysis_interrupted'})};
  await this.storage.put(key,row);this.inflight.get(key)?.controller.abort();return row;
 }
 async _cleanup(){
  const rows=await this.storage.list({prefix:PREFIX,limit:GLOBAL_LIMIT+1});let removed=0;
  for(const [key,job] of rows){if(job.expiresAt<=this.now()){await this.storage.delete(key);this.inflight.get(key)?.controller.abort();removed++;}else await this._expire(key,job);}
  return removed;
 }
 async cleanup(){try{return await this._exclusive(()=>this._cleanup());}catch{return 0;}}
 async reconcile(){return this.cleanup();}
 async start(user,input,identity=''){
  let value,fingerprint;try{value=inputValue(user,input,identity);fingerprint=await digest(value);}catch{return failure('invalid_request',400);}
  try{return await this._exclusive(async()=>{
   const key=this._key(user,value.input.requestId);let row=await this.storage.get(key);
   if(row){if(row.fingerprint!==fingerprint)return failure('request_conflict',409,row.jobId);if(row.expiresAt<=this.now())return failure('job_expired',410,row.jobId);row=await this._expire(key,row);return this._public(row,ACTIVE.has(row.stage)?202:200);}
   await this._cleanup();const own=await this.storage.list({prefix:PREFIX+user+':',limit:USER_LIMIT+1});
   if([...own.values()].some(job=>job.jobId===value.input.id||job.jobId===value.input.requestId||job.requestId===value.input.id))return failure('request_conflict',409,value.input.id);
   if(own.size>=USER_LIMIT||(await this.storage.list({prefix:PREFIX,limit:GLOBAL_LIMIT+1})).size>=GLOBAL_LIMIT)return failure('analysis_capacity',429);
   const at=this.now();row={jobId:value.input.id,requestId:value.input.requestId,user,input:value.input,identity,fingerprint,runId:crypto.randomUUID(),stage:'queued',createdAt:at,updatedAt:at,deadlineAt:at+RUN_LIMIT,expiresAt:at+RETENTION};await this.storage.put(key,row);
   this._schedule(key,row);return this._public(row,202);
  });}catch{return failure('storage_unavailable',503);}
 }
 async read(user,id){
  if(typeof user!=='string'||!/^[a-f0-9]{64}$/.test(user)||typeof id!=='string'||!UUID.test(id))return failure('invalid_request',400);
  id=id.toLowerCase();try{return await this._exclusive(async()=>{
   let key=this._key(user,id),row=await this.storage.get(key);
   if(!row){const own=await this.storage.list({prefix:PREFIX+user+':',limit:USER_LIMIT+1});const match=[...own].find(([,job])=>job.jobId===id);if(match)[key,row]=match;}
   if(!row)return failure('job_not_found',404,id);
   if(row.expiresAt<=this.now()){await this.storage.delete(key);this.inflight.get(key)?.controller.abort();return failure('job_expired',410,id);}
   row=await this._expire(key,row);return this._public(row);
  });}catch{return failure('storage_unavailable',503,id);}
 }
 _schedule(key,row){
  const run={controller:new AbortController()};this.inflight.set(key,run);
  let timer;const deadline=new Promise(resolve=>{const stop=()=>resolve('timeout');run.controller.signal.addEventListener('abort',stop,{once:true});timer=setTimeout(()=>{run.controller.abort();resolve('timeout');},Math.max(1,row.deadlineAt-this.now()));});
  const work=Promise.resolve().then(()=>this._execute(key,row,run)).then(()=> 'done',()=> 'error');
  const task=Promise.race([work,deadline]).then(async state=>{if(state==='timeout')await this._exclusive(async()=>{const current=await this.storage.get(key);if(current&&current.runId===row.runId)await this._expire(key,{...current,deadlineAt:Math.min(current.deadlineAt,this.now())});});}).catch(()=>{}).finally(()=>{clearTimeout(timer);if(this.inflight.get(key)===run)this.inflight.delete(key);});
  run.task=task;try{this.waitUntil(task);}catch{run.controller.abort();}
 }
 async _transition(key,row,run,stage,extra={}){
  return this._exclusive(async()=>{const current=await this.storage.get(key);if(!current||current.runId!==row.runId||!ACTIVE.has(current.stage)||run.controller.signal.aborted)return null;if(this.now()>=current.deadlineAt)return this._expire(key,current).then(()=>null);const next={...current,...extra,stage,updatedAt:this.now()};await this.storage.put(key,next);return next;});
 }
 async _execute(key,row,run){
  let stage='preparing';
  try{
   if(!await this._transition(key,row,run,'preparing'))return;
   const context={user:row.user,jobId:row.jobId,deadlineAt:row.deadlineAt,signal:run.controller.signal,identity:row.identity,input:structuredClone(row.input)};
   const articles=await this.prepare(structuredClone(row.input),context);
   if(!Array.isArray(articles)||!articles.length||articles.length>20||size(articles)>120000)throw {code:'no_articles'};
   if(!await this._transition(key,row,run,'generating'))return;
   stage='generating';const value=await this.generate(articles,context);
   if(value?.error){await this._transition(key,row,run,'failed',safeError(value));return;}
   let result;try{result=resultValue(value);}catch(error){await this._transition(key,row,run,'failed',safeError(error));return;}
   await this._transition(key,row,run,'complete',{result});
  }catch(error){const uncertain=stage==='generating'&&!Object.hasOwn(MESSAGES,error?.code);await this._transition(key,row,run,uncertain?'uncertain':'failed',safeError(error,uncertain?'analysis_uncertain':'analysis_error'));}
 }
}
