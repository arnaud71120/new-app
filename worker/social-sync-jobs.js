const PREFIX='social-sync:job:',ACTIVE_KEY='social-sync:active',RETENTION=3600000,DEADLINE=180000,LIMIT=100,USER_LIMIT=20;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACTIVE=new Set(['queued','running']);
const MESSAGES={invalid_request:'Demande de synchronisation invalide.',request_conflict:'Cet identifiant correspond à une autre demande.',job_not_found:'Cette synchronisation est introuvable pour votre compte.',job_expired:'Cette synchronisation a expiré. Créez une nouvelle demande.',sync_in_progress:'Une synchronisation est déjà en cours. Réessayez après sa fin.',sync_capacity:'Trop de synchronisations sont conservées. Réessayez après leur expiration.',storage_unavailable:'Le stockage des synchronisations est temporairement indisponible.',owner_paused:'Les appels externes sont suspendus par l’administrateur.',configuration:'Le collecteur social doit être configuré.',free_confirmation:'La confirmation du compte fournisseur gratuit est nécessaire.',provider_error:'Le fournisseur n’a pas pu terminer la synchronisation.',sync_uncertain:'L’état de cette synchronisation n’est pas confirmé. Aucun nouvel appel fournisseur n’est relancé automatiquement.',sync_timeout:'Cette synchronisation n’a pas démarré dans le délai prévu.',provider_backoff:'Le fournisseur impose un délai avant une nouvelle demande.',provider_limit:'Le fournisseur limite actuellement les demandes.',budget_exhausted:'L’enveloppe mensuelle de sécurité est atteinte.',monthly_budget:'L’enveloppe mensuelle de sécurité est atteinte.',halted:'La collecte est suspendue après un dépassement fournisseur.',no_profiles:'Aucun profil actif pour cette plateforme.',cooldown:'Une synchronisation vient d’être demandée. Patientez avant une nouvelle extraction.',poll_cooldown:'Une collecte est en cours ; son suivi sera repris sans nouvelle extraction.'};
const STATUS_MESSAGES={started:'Une nouvelle collecte a été demandée.',in_progress:'La collecte existante est suivie sans nouvelle extraction.',ready:'Les dernières publications disponibles ont été importées.',uncertain:MESSAGES.sync_uncertain,blocked:'La collecte ne peut pas démarrer dans son état actuel.',error:MESSAGES.provider_error,no_profiles:MESSAGES.no_profiles,cooldown:MESSAGES.cooldown};
const failure=(code,httpStatus)=>({status:'failed',httpStatus,code,error:MESSAGES[code]});
const validUser=user=>typeof user==='string'&&/^[a-f0-9]{64}$/.test(user);
const number=(value,max=4000)=>Number.isFinite(value)&&value>=0?Math.min(max,Math.floor(value)):0;
function safeResult(value,scope,now){
 if(!value||!value.platforms||typeof value.platforms!=='object')throw {code:'provider_error'};
 const platforms={};for(const platform of scope==='all'?['x','linkedin']:[scope]){
  const row=value.platforms[platform];if(!row||!Object.hasOwn(STATUS_MESSAGES,row.status))continue;
  const code=typeof row.code==='string'&&Object.hasOwn(MESSAGES,row.code)?row.code:null;
  const result={status:row.status,message:code?MESSAGES[code]:STATUS_MESSAGES[row.status],pending:row.pending===true,count:number(row.count),newCount:number(row.newCount),nextAt:number(row.nextAt,8640000000000000)};
  if(code)result.code=code;if(typeof row.snapshotId==='string'&&/^[a-zA-Z0-9_-]{1,120}$/.test(row.snapshotId))result.snapshotId=row.snapshotId;
  if(Number.isInteger(row.providerHttpStatus)&&row.providerHttpStatus>=200&&row.providerHttpStatus<=599)result.providerHttpStatus=row.providerHttpStatus;
  if(Number.isFinite(row.retryAfterSeconds)&&row.retryAfterSeconds>0)result.retryAfterSeconds=Math.max(1,number(row.retryAfterSeconds,86400));
  platforms[platform]=result;
 }
 if(!Object.keys(platforms).length)throw {code:'provider_error'};
 const result={platforms,checkedAt:Number.isFinite(Date.parse(value.checkedAt))?new Date(value.checkedAt).toISOString():new Date(now).toISOString()};
 if(Number.isFinite(value.budget?.used)&&value.budget.used>=0)result.budget={used:number(value.budget.used),limit:4000};return result;
}

/** One global command at a time; provider-side pending snapshots remain authoritative. */
export class SocialSyncJobs {
 constructor({storage,waitUntil,execute,now=Date.now}){if(!storage||typeof waitUntil!=='function'||typeof execute!=='function'||typeof now!=='function')throw Error('Invalid sync dependencies');Object.assign(this,{storage,waitUntil,execute,now});this.tail=Promise.resolve();this.runs=new Map();}
 _exclusive(work){const task=this.tail.then(work);this.tail=task.catch(()=>{});return task;}
 _key(user,id){return PREFIX+user+':'+id;}
 _public(row,httpStatus=200){const value={jobId:row.jobId,platform:row.platform,status:row.status,httpStatus};for(const key of ['createdAt','updatedAt','deadlineAt','expiresAt'])value[key]=new Date(row[key]).toISOString();if(row.result)value.result=structuredClone(row.result);if(row.code){value.code=row.code;value.error=MESSAGES[row.code];}return value;}
 async _release(key){const active=await this.storage.get(ACTIVE_KEY);if(active?.key===key)await this.storage.delete(ACTIVE_KEY);}
 async _expire(key,row){
  if(!ACTIVE.has(row.status)||this.now()<row.deadlineAt)return row;
  row={...row,status:row.status==='running'?'uncertain':'failed',code:row.status==='running'?'sync_uncertain':'sync_timeout',updatedAt:this.now()};await this.storage.put(key,row);await this._release(key);this.runs.get(key)?.stop('expired');return row;
 }
 async _active(){const pointer=await this.storage.get(ACTIVE_KEY);if(!pointer)return null;let row=await this.storage.get(pointer.key);if(row&&row.expiresAt>this.now())row=await this._expire(pointer.key,row);if(!row||row.expiresAt<=this.now()||!ACTIVE.has(row.status)){await this.storage.delete(ACTIVE_KEY);return null;}return {key:pointer.key,row};}
 async _cleanup(){for(const [key,row] of await this.storage.list({prefix:PREFIX,limit:LIMIT+1})){if(row.expiresAt<=this.now()){await this.storage.delete(key);await this._release(key);this.runs.get(key)?.stop('expired');}else await this._expire(key,row);}}
 async _atCapacity(user){await this._cleanup();return (await this.storage.list({prefix:PREFIX+user+':',limit:USER_LIMIT+1})).size>=USER_LIMIT||(await this.storage.list({prefix:PREFIX,limit:LIMIT+1})).size>=LIMIT;}
 async _resumeQueued(key,row){if(row.status!=='queued')return;const active=await this._active();if(!active||active.key===key){if(!active)await this.storage.put(ACTIVE_KEY,{key});this._schedule(key,row);}}
 async _alias(user,row,starting=false){
  const prefix=this._key(user,'');if(row.user!==user||typeof row.aliasKey!=='string'||!row.aliasKey.startsWith(prefix)||!UUID.test(row.aliasKey.slice(prefix.length)))return failure('job_not_found',404);
  let target=await this.storage.get(row.aliasKey);if(!target)return failure('job_expired',410);if(target.user!==user||target.aliasKey)return failure('job_not_found',404);if(row.expiresAt<=this.now()||target.expiresAt<=this.now())return failure('job_expired',410);
  target=await this._expire(row.aliasKey,target);await this._resumeQueued(row.aliasKey,target);
  return {...this._public(target,starting&&ACTIVE.has(target.status)?202:200),jobId:row.jobId,expiresAt:new Date(Math.min(row.expiresAt,target.expiresAt)).toISOString()};
 }
 async start(user,input){
  if(!validUser(user)||!input||typeof input.requestId!=='string'||!UUID.test(input.requestId)||!['all','x','linkedin'].includes(input.platform))return failure('invalid_request',400);
  const id=input.requestId.toLowerCase(),key=this._key(user,id);
  try{return await this._exclusive(async()=>{
   let row=await this.storage.get(key);if(row){if((row.requestedPlatform||row.platform)!==input.platform)return failure('request_conflict',409);if(row.expiresAt<=this.now())return failure('job_expired',410);if(row.aliasKey)return this._alias(user,row,true);row=await this._expire(key,row);if(!ACTIVE.has(row.status))return this._public(row);}
   const active=await this._active();if(active&&active.key!==key){
    if(active.row.user!==user)return failure('sync_in_progress',409);if(await this._atCapacity(user)&&!row)return failure('sync_capacity',429);
    const target=await this.storage.get(active.key);if(!target||target.expiresAt<=this.now())return failure('job_expired',410);
    const at=this.now(),alias={jobId:id,user,platform:target.platform,requestedPlatform:input.platform,status:'alias',aliasKey:active.key,createdAt:at,updatedAt:at,deadlineAt:target.deadlineAt,expiresAt:Math.min(at+RETENTION,target.expiresAt)};
    await this.storage.put(key,alias);return this._alias(user,alias,true);
   }
   if(row){if(!active)await this.storage.put(ACTIVE_KEY,{key});if(row.status==='queued')this._schedule(key,row);return this._public(row,202);}
   if(await this._atCapacity(user))return failure('sync_capacity',429);
   const at=this.now();row={jobId:id,user,platform:input.platform,status:'queued',runId:crypto.randomUUID(),createdAt:at,updatedAt:at,deadlineAt:at+DEADLINE,expiresAt:at+RETENTION};await this.storage.put(key,row);await this.storage.put(ACTIVE_KEY,{key});this._schedule(key,row);return this._public(row,202);
  });}catch{return failure('storage_unavailable',503);}
 }
 async read(user,id){
  if(!validUser(user)||typeof id!=='string'||!UUID.test(id))return failure('invalid_request',400);const key=this._key(user,id.toLowerCase());
  try{return await this._exclusive(async()=>{let row=await this.storage.get(key);if(!row)return failure('job_not_found',404);if(row.expiresAt<=this.now())return failure('job_expired',410);if(row.aliasKey)return this._alias(user,row);row=await this._expire(key,row);await this._resumeQueued(key,row);return this._public(row);});}catch{return failure('storage_unavailable',503);}
 }
 _schedule(key,row){
  if(this.runs.has(key))return;const run={runId:row.runId};this.runs.set(key,run);
  const deadline=new Promise(resolve=>{run.stop=resolve;run.timer=setTimeout(()=>resolve('expired'),Math.max(1,row.deadlineAt-this.now()));});
  const work=Promise.resolve().then(()=>this._run(key,row)).then(()=> 'done',()=> 'error');
  const task=Promise.race([work,deadline]).then(async state=>{if(state==='expired')await this._exclusive(async()=>{const current=await this.storage.get(key);if(current?.runId===row.runId)await this._expire(key,{...current,deadlineAt:Math.min(current.deadlineAt,this.now())});});}).catch(()=>{}).finally(()=>{clearTimeout(run.timer);if(this.runs.get(key)===run)this.runs.delete(key);});
  run.task=task;try{this.waitUntil(task);}catch{run.stop('expired');}
 }
 async _finish(key,row,status,extra={}){return this._exclusive(async()=>{const current=await this.storage.get(key);if(!current||current.runId!==row.runId||current.status!=='running')return;if(this.now()>=current.deadlineAt){await this._expire(key,current);return;}await this.storage.put(key,{...current,...extra,status,updatedAt:this.now()});await this._release(key);});}
 async _run(key,row){
  const running=await this._exclusive(async()=>{const current=await this.storage.get(key);if(!current||current.runId!==row.runId||current.status!=='queued')return false;if(this.now()>=current.deadlineAt){await this._expire(key,current);return false;}await this.storage.put(key,{...current,status:'running',updatedAt:this.now()});return true;});if(!running)return;
  try{const value=await this.execute({platform:row.platform,jobId:row.jobId,user:row.user});if(value?.error){const code=Object.hasOwn(MESSAGES,value.code)?value.code:'provider_error';await this._finish(key,row,code==='sync_uncertain'?'uncertain':'failed',{code});}else await this._finish(key,row,'complete',{result:safeResult(value,row.platform,this.now())});}
  catch(error){const known=typeof error?.code==='string'&&Object.hasOwn(MESSAGES,error.code),code=known?error.code:'sync_uncertain';await this._finish(key,row,known&&code!=='sync_uncertain'?'failed':'uncertain',{code});}
 }
}
