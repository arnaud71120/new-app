const PLATFORMS=['x','linkedin'];
/** One manual launch/check pass. Collection snapshots remain owned by tick(). */
export async function executeSocialSync(store,{platform}){
 const config=await store.ctx.storage.get('admin:config')||{};
 if(store.env.EXTERNAL_CALLS_PAUSED==='true'||config.externalPaused||config.socialPaused)throw {code:'owner_paused'};
 if(!store.env.BRIGHTDATA_TOKEN)throw {code:'configuration'};
 if(store.env.BRIGHTDATA_FREE_ONLY_CONFIRMED!=='true')throw {code:'free_confirmation'};
 const selected=platform==='all'?PLATFORMS:[platform],before=await store.state(),profiles=await store.profiles();
 await store.tick(true,true,platform==='all'?null:platform,true);
 const after=await store.state(),now=Date.now(),platforms={};
 for(const name of selected){
  const previous=before.platforms[name]||{},current=after.platforms[name]||{},reserve=profiles.filter(profile=>name==='x'?profile.x:profile.linkedin).length*(name==='x'?3:1);
  const imported=current.lastCompletedAt&&current.lastCompletedAt!==previous.lastCompletedAt;
  const row={pending:!!current.pending,count:imported?current.lastCount||0:0,newCount:imported?current.newCount||0:0,nextAt:current.nextAt||0};
  if(current.pending?.id)row.snapshotId=current.pending.id;
  if(current.lastHttpStatus>=400)row.providerHttpStatus=current.lastHttpStatus;
  if(current.pending?.uncertain)Object.assign(row,{status:'uncertain',code:'sync_uncertain',message:'Le lancement doit être vérifié chez le fournisseur. Aucun second lancement n’a été envoyé.'});
  else if(after.halted)Object.assign(row,{status:'blocked',code:'halted',message:'La collecte est suspendue après un dépassement de réservation fournisseur.'});
  else if(current.providerRetryAt>now){Object.assign(row,{status:'blocked',code:'provider_limit',message:'Le fournisseur impose un délai avant une nouvelle demande.',retryAfterSeconds:Math.ceil((current.providerRetryAt-now)/1000)});}
  else if(current.pending)Object.assign(row,{status:previous.pending?'in_progress':'started',message:previous.pending?'La collecte existante est suivie.':'Collecte lancée ; le fournisseur prépare les publications.'});
  else if(imported&&current.status==='ready')Object.assign(row,{status:'ready',message:'Le résultat de la collecte a été importé.'});
  else if(!reserve)Object.assign(row,{status:'no_profiles',code:'no_profiles',message:'Aucun profil actif pour cette plateforme.'});
  else if(after.budget.used+reserve>4000)Object.assign(row,{status:'blocked',code:'budget_exhausted',message:'Le budget mensuel de collecte est atteint.'});
  else if(now-(current.lastAttempt||0)<60000&&current.lastAttempt===previous.lastAttempt)Object.assign(row,{status:'cooldown',code:'cooldown',message:'Une demande vient d’être envoyée. Réessayez dans une minute.',retryAfterSeconds:Math.max(1,Math.ceil((current.lastAttempt+60000-now)/1000))});
  else if(current.status==='error'||['failed','cancelled','canceled'].includes(current.status))Object.assign(row,{status:'error',code:'provider_error',message:'Le fournisseur n’a pas confirmé la collecte. Consultez son diagnostic.'});
  else Object.assign(row,{status:'ready',message:'Le dernier résultat disponible a été contrôlé.'});
  platforms[name]=row;
 }
 return {platforms,budget:{used:after.budget.used,limit:4000},checkedAt:new Date().toISOString()};
}
