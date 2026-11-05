// Loaded after the application script; source polling and its controls stay out
// of the initial HTML budget. Every retry keeps the same durable request ID.
export const SYNC_SCRIPT=String.raw`
(()=>{
'use strict';
const syncNames={all:'X / Twitter et LinkedIn',x:'X / Twitter',linkedin:'LinkedIn'},syncStorage='cyberveille-sync-job';
let syncRun=null,syncBusy=false,syncTimer=null,syncPhase='idle',syncMessage='',syncDetails=[],syncTone='info';
const syncUUID=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
const syncAlive=run=>syncRun===run&&run.epoch===privateEpoch;
function syncRemember(){try{if(syncRun)sessionStorage.setItem(syncStorage,JSON.stringify({requestId:syncRun.requestId,platform:syncRun.platform,createdAt:syncRun.createdAt}));else sessionStorage.removeItem(syncStorage);}catch{}}
function syncForget(){clearTimeout(syncTimer);syncRun=null;syncBusy=false;syncRemember();}
function syncRender(){
 for(const node of document.querySelectorAll('[data-sync-status]')){node.hidden=!syncMessage;node.dataset.tone=syncTone;node.replaceChildren();const text=document.createElement('p');text.textContent=syncMessage;node.append(text);if(syncDetails.length){const list=document.createElement('ul');for(const detail of syncDetails){const item=document.createElement('li');item.textContent=detail;list.append(item);}node.append(list);}}
 for(const button of document.querySelectorAll('[data-sync-platform]')){const main=button.id==='sync-now';button.disabled=syncBusy||!!syncRun&&!main;button.setAttribute('aria-busy',String(syncBusy));if(main)button.textContent=syncBusy?'Synchronisation en cours…':syncRun?(syncPhase==='missing'?'Réessayer la même demande':'Reprendre le suivi'):'Synchroniser maintenant';}
}
function syncStatus(message,tone='info',details=[]){syncMessage=message;syncTone=tone;syncDetails=details;syncRender();}
function syncError(error,scope){return adminFailure(error,scope+' /api/sync')+(Number.isFinite(error.retryAfterSeconds)?' · Réessayez dans '+Math.ceil(error.retryAfterSeconds)+' s.':'');}
function syncApiError(response,value){return Object.assign(adminApiError(response,value),{retryAfterSeconds:value.retryAfterSeconds});}
function syncPanel(){const panel=document.createElement('section');panel.className='sync-status notice';panel.dataset.syncStatus='true';panel.setAttribute('role','status');panel.setAttribute('aria-live','polite');panel.hidden=true;return panel;}
function syncButton(platform,label){const button=document.createElement('button');button.type='button';button.dataset.syncPlatform=platform;button.textContent=label;return button;}
function syncMountAdmin(){
 const content=document.querySelector('#admin-content');if(!content||!['services','profiles'].includes(adminTab)||!adminState||content.querySelector('[data-sync-controls]'))return;
 const section=document.createElement('section');section.className='admin-service sync-controls';section.dataset.syncControls='true';const title=document.createElement('h3');title.textContent='Synchroniser les publications maintenant';const note=document.createElement('p');note.textContent='Lance la vérification des comptes X et LinkedIn sans attendre le prochain horaire. Les collectes déjà en cours sont suivies ; les limites et les pauses restent respectées.';const actions=document.createElement('div');actions.className='admin-actions';actions.append(syncButton('x','Synchroniser X / Twitter'),syncButton('linkedin','Synchroniser LinkedIn'));section.append(title,note,actions,syncPanel());content.prepend(section);syncRender();
}
function syncUpgradeRetries(){for(const button of document.querySelectorAll('[data-social-retry]')){button.dataset.syncPlatform=button.dataset.socialRetry||'linkedin';button.removeAttribute('data-social-retry');button.textContent='Synchroniser '+syncNames[button.dataset.syncPlatform]+' maintenant';}}
function syncMountSources(){
 syncUpgradeRetries();
 const legacy=document.querySelector('#retry-linkedin');if(!legacy)return;legacy.onclick=null;legacy.dataset.syncPlatform='linkedin';legacy.textContent='Synchroniser LinkedIn maintenant';if(!legacy.parentElement.querySelector('[data-sync-platform=x]'))legacy.before(syncButton('x','Synchroniser X maintenant'));if(!legacy.parentElement.parentElement.querySelector('[data-sync-status]'))legacy.parentElement.after(syncPanel());syncRender();
}
function syncPlatformDetails(value){
 const platforms=value.result?.platforms;if(!platforms||typeof platforms!=='object'||Array.isArray(platforms))return {details:[],pending:false,blocked:true};
 const details=[];let pending=false,blocked=false;
 for(const [platform,state] of Object.entries(platforms)){if(!syncNames[platform]||!state||typeof state!=='object')continue;const inProgress=state.status!=='uncertain'&&(!!state.pending||['queued','running','pending','starting','started','in_progress','processing','building','collecting'].includes(state.status));pending||=inProgress;blocked||=['blocked','error','uncertain','no_profiles','cooldown'].includes(state.status)||!inProgress&&!['ready','complete','refreshed','imported','cached','no_changes'].includes(state.status);let line=syncNames[platform]+' : '+(state.message||state.status||'état non communiqué');if(inProgress)line+=' · collecte encore en cours';if(!inProgress&&Number.isFinite(state.newCount))line+=' · '+state.newCount+' nouvelle(s) publication(s)';else if(!inProgress&&Number.isFinite(state.count))line+=' · '+state.count+' publication(s) reconnue(s)';if(state.providerHttpStatus)line+=' · fournisseur HTTP '+state.providerHttpStatus;if(state.code)line+=' · code : '+state.code;if(Number.isFinite(state.retryAfterSeconds))line+=' · nouvelle vérification possible dans '+Math.ceil(state.retryAfterSeconds)+' s';details.push(line);}
 return {details,pending,blocked:blocked||!details.length};
}
async function syncRefresh(){
 await loadSocial(false);
 if(document.querySelector('#admin-dialog')?.open&&adminTab!=='profiles'&&document.querySelector('#admin-editor')?.hidden)await loadAdmin();
}
function syncAccept(value,run,reused=false){
 if(!syncAlive(run))return;
 if(!value||!syncUUID(value.jobId)||!['queued','running','complete','failed','uncertain'].includes(value.status))throw Error('Réponse de synchronisation incomplète. Aucun succès ne peut être confirmé.');
 if(value.jobId!==run.requestId){if(!reused)throw Error('Le suivi reçu ne correspond pas à la demande. Aucun succès ne peut être confirmé.');run.requestId=value.jobId;}if(syncNames[value.platform])run.platform=value.platform;syncRemember();const label=syncNames[run.platform];
 if(['queued','running'].includes(value.status)){
  syncPhase=value.status;syncBusy=true;syncStatus(label+' : '+(value.message||(value.status==='queued'?'demande enregistrée, démarrage en attente…':'vérification et collecte en cours…')),'pending');
  if(Date.now()-run.followStarted>240000){syncBusy=false;syncPhase='followup';syncStatus(label+' : le traitement prend plus de temps. Reprenez le suivi pour consulter son état, sans relancer de collecte.','warning');return;}
  clearTimeout(syncTimer);syncTimer=setTimeout(()=>syncPoll(run),Math.min(10000,Math.max(500,(value.retryAfterSeconds||2)*1000)));return;
 }
 const result=syncPlatformDetails(value);
 if(value.status==='complete'){
  syncForget();syncPhase='complete';syncStatus(label+' : '+(result.blocked?'vérification terminée avec une action nécessaire.':result.pending?'demande exécutée. Le fournisseur collecte encore les publications.':'synchronisation exécutée.')+(value.message?' '+value.message:''),result.blocked?'warning':result.pending?'pending':'complete',result.details);void syncRefresh();return;
 }
 if(value.status==='uncertain'){
  syncBusy=false;syncPhase='followup';syncStatus(label+' : '+(value.error||value.message||'le résultat du lancement reste incertain. Reprenez le suivi ; aucun nouveau lancement automatique ne sera effectué.'),'warning',[...result.details,...(value.code?['Code : '+value.code]:[]),'Demande : '+run.requestId]);return;
 }
 syncForget();syncPhase='failed';syncStatus(label+' : '+(value.error||value.message||'la synchronisation a échoué.'),'error',[...result.details,...(value.code?['Code : '+value.code]:[]),'Demande : '+run.requestId]);
}
async function syncPoll(run){
 if(!syncAlive(run))return;const token=accessToken;if(!token){syncBusy=false;syncStatus('La session doit être reconnectée avant de reprendre le suivi.','error');return;}syncBusy=true;syncRender();
 try{const response=await fetch('/api/sync?'+new URLSearchParams({jobId:run.requestId}),{headers:{Authorization:'Bearer '+token},timeoutMs:15000}),value=await response.json();if(!syncAlive(run))return;if(token!==accessToken){syncBusy=false;syncStatus('Connexion renouvelée. Reprenez le suivi de la synchronisation.','warning');return;}if(!response.ok)throw syncApiError(response,value);syncAccept(value,run);}
 catch(error){if(!syncAlive(run))return;syncBusy=false;if(error.status===410){syncForget();syncPhase='failed';syncStatus(syncError(error,'Suivi de '+syncNames[run.platform])+' La demande a expiré. Vous pouvez demander une nouvelle synchronisation.','error');return;}syncPhase=error.status===404?'missing':'followup';syncStatus(syncError(error,'Suivi de '+syncNames[run.platform])+(syncPhase==='missing'?' Aucune demande retrouvée. Vous pouvez renvoyer la même demande avec son identifiant.':' Le suivi est interrompu ; la collecte peut continuer côté serveur. Reprenez le suivi sans créer une nouvelle demande.'),'error',['Demande : '+run.requestId]);}
}
async function syncSend(run){
 if(!syncAlive(run))return;const token=accessToken;syncBusy=true;syncPhase='sending';syncStatus(syncNames[run.platform]+' : enregistrement de la synchronisation…','pending');
 try{const response=await fetch('/api/sync',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({platform:run.platform,requestId:run.requestId}),timeoutMs:15000}),value=await response.json();if(!syncAlive(run))return;if(!response.ok)throw syncApiError(response,value);if(token!==accessToken){syncBusy=false;syncStatus('Connexion renouvelée. Reprenez le suivi de la synchronisation.','warning');return;}syncAccept(value,run,true);}
 catch(error){if(!syncAlive(run))return;syncBusy=false;if([400,401,403,409,429].includes(error.status)){syncForget();syncPhase='failed';syncStatus(syncError(error,'Synchronisation de '+syncNames[run.platform]),'error');return;}syncPhase='followup';syncStatus(syncError(error,'Synchronisation de '+syncNames[run.platform])+' La réponse n’a pas été reçue. Reprenez le suivi avant toute nouvelle demande.','error',['Demande : '+run.requestId]);}
}
async function syncStart(platform){
 if(syncBusy)return;if(!syncNames[platform])return;
 if(!accessToken){syncStatus('Connectez-vous à Cyberveille avant de synchroniser les publications.','error');return;}
 if(syncRun){syncRun.token=accessToken;syncRun.epoch=privateEpoch;syncRun.followStarted=Date.now();if(syncPhase==='missing')return syncSend(syncRun);return syncPoll(syncRun);}
 const run={requestId:crypto.randomUUID(),platform,createdAt:Date.now(),followStarted:Date.now(),token:accessToken,epoch:privateEpoch};syncRun=run;syncRemember();return syncSend(run);
}
const style=document.createElement('style');style.textContent='.sync-status{margin:12px 0;overflow-wrap:anywhere}.sync-status p{margin:0}.sync-status ul{margin-bottom:0;padding-left:20px}.sync-status[data-tone=complete]{border-color:#416a4a;background:#1d3328;color:#c6efbd}.sync-status[data-tone=pending]{border-color:#315c73;background:#122c3b;color:#b9e3f7}.sync-status[data-tone=error]{border-color:#875d45;color:#ffccad}.sync-controls{margin-bottom:16px}';document.head.append(style);
const refresh=document.querySelector('#refresh');if(refresh&&!document.querySelector('#sync-now')){const button=syncButton('all','Synchroniser maintenant');button.id='sync-now';button.className='primary';button.title='X / Twitter et LinkedIn : lancer une collecte sans attendre le prochain horaire';refresh.before(button);refresh.title='Relire les articles et les flux disponibles';const panel=syncPanel();panel.id='sync-progress';document.querySelector('.hero')?.after(panel);}
const syncRenderHealth=renderHealth;renderHealth=function(){syncRenderHealth();syncUpgradeRetries();};
const syncRenderAdmin=renderAdmin;renderAdmin=function(){syncRenderAdmin();syncMountAdmin();};const syncRenderSources=renderSources;renderSources=function(){syncRenderSources();syncMountSources();};
const syncClearPrivate=clearPrivateSession;clearPrivateSession=function(){syncForget();syncPhase='idle';syncMessage='';syncDetails=[];syncClearPrivate();syncRender();};
document.addEventListener('click',event=>{const button=event.target.closest?.('[data-sync-platform]');if(!button||button.disabled)return;event.preventDefault();void syncStart(button.dataset.syncPlatform);});
try{const saved=JSON.parse(sessionStorage.getItem(syncStorage)||'null');if(saved&&syncUUID(saved.requestId)&&syncNames[saved.platform]&&Date.now()-saved.createdAt>=0&&Date.now()-saved.createdAt<3600000){syncRun={...saved,token:accessToken,epoch:privateEpoch,followStarted:Date.now()};syncPhase='followup';syncMessage='Une demande de synchronisation est conservée. Reprenez son suivi sans relancer de collecte.';}else sessionStorage.removeItem(syncStorage);}catch{}
syncMountAdmin();syncMountSources();syncRender();
})();
`;
