export const ANALYSIS_SCRIPT=String.raw`
const analysisRequests=new Map(),analysisFlights=new Map();
try{for(const [key,value] of JSON.parse(sessionStorage.getItem('cyberveille-analysis-requests')||'[]'))if(typeof key==='string'&&new TextEncoder().encode(key).length<=20000&&value&&/^[0-9a-f-]{36}$/i.test(value.requestId)&&Date.now()-value.createdAt<3600000)analysisRequests.set(key,value);}catch{}
function saveAnalysisRequests(){try{sessionStorage.setItem('cyberveille-analysis-requests',JSON.stringify([...analysisRequests].slice(-30)));}catch{}}
function analysisSelection(event,provider){const articles=[...new Map((event.articles?.length?event.articles:[event]).filter(a=>typeof a.url==='string').map(a=>[a.url,a])).values()].sort((a,b)=>a.url.localeCompare(b.url)).slice(0,12),urls=articles.map(a=>a.url),sourceIds=[...new Set(articles.map(a=>a.sourceId).filter(id=>typeof id==='string'&&/^[a-z0-9][a-z0-9-]{0,79}$/.test(id)))].sort();return {eventId:event.id,urls,sourceIds,provider,manual:event.manual||undefined};}

async function runAnalysisTask(execute,onProgress){
 interactiveAI++;clearTimeout(translationTimer);const epoch=privateEpoch;
 const task=interactiveTail.catch(()=>{}).then(async()=>{const started=Date.now();if(translationRunning)onProgress('La traduction en cours termine sa réponse ; votre analyse sera ensuite prioritaire.');while(translationRunning){if(epoch!==privateEpoch)throw new DOMException('Session fermée','AbortError');if(Date.now()-started>60000)throw Error('La traduction en cours prend trop de temps. Votre analyse n’a pas été envoyée.');await new Promise(resolve=>setTimeout(resolve,150));}if(epoch!==privateEpoch)throw new DOMException('Session fermée','AbortError');return execute(epoch);});
 interactiveTail=task.then(()=>{},()=>{});try{return await task;}finally{interactiveAI--;if(!interactiveAI)startAutoTranslation();}
}
async function submitAnalysis(event,provider,onProgress=()=>{}){
 const selection=analysisSelection(event,provider),key=JSON.stringify(selection);if(analysisFlights.has(key))return analysisFlights.get(key);
 let request=analysisRequests.get(key);if(request&&Date.now()-request.createdAt>=3600000){analysisRequests.delete(key);request=null;}if(!request){request={requestId:crypto.randomUUID(),createdAt:Date.now()};analysisRequests.set(key,request);saveAnalysisRequests();}
 const token=accessToken,check=epoch=>{if(epoch!==privateEpoch||token!==accessToken)throw new DOMException('Session fermée','AbortError');};
 const operation=runAnalysisTask(async epoch=>{
  const read=async(url,options={})=>{check(epoch);const response=await fetch(url,{...options,headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},timeoutMs:20000}),value=await response.json();check(epoch);if(!response.ok){const error=Error(value.error||'Suivi de l’analyse indisponible (HTTP '+response.status+').');error.code=value.code;error.status=response.status;if(response.status===410){analysisRequests.delete(key);saveAnalysisRequests();}throw error;}return value;};
  const stages={queued:'Analyse enregistrée. Préparation du traitement…',preparing:'Lecture des extraits enregistrés…',generating:'Gemini prépare votre analyse. Vous pouvez conserver cette fiche ouverte.',complete:'Analyse terminée.',failed:'La génération n’a pas abouti.',uncertain:'L’état de la génération doit être vérifié.'};
  onProgress('Enregistrement de la demande…');
  let job=await read('/api/analysis',{method:'POST',body:JSON.stringify({...selection,requestId:request.requestId})});
  const deadline=Date.now()+150000;
  while(true){
   check(epoch);onProgress(stages[job.status]||stages[job.stage]||'Analyse en cours…');
   if(job.status==='complete'){if(!job.result||typeof job.result.text!=='string')throw Error('Résultat d’analyse incomplet.');return job.result;}
   if(job.status==='failed'||job.status==='uncertain'){
    if(job.status==='failed'){analysisRequests.delete(key);saveAnalysisRequests();}
    const error=Error((job.error||'La génération a été interrompue. Aucun nouvel appel n’a été envoyé automatiquement.')+(job.providerHttpStatus?' (HTTP '+job.providerHttpStatus+')':''));error.code=job.code||'analysis_uncertain';error.status=job.providerHttpStatus;error.jobId=request.requestId;error.retryAfterSeconds=job.retryAfterSeconds;throw error;
   }
   if(Date.now()>deadline){const error=Error('Votre analyse reste enregistrée. Cliquez à nouveau sur le bouton pour reprendre son suivi.');error.code='analysis_pending';throw error;}
   await new Promise(resolve=>setTimeout(resolve,1500));job=await read('/api/analysis?jobId='+encodeURIComponent(request.requestId));
  }
 },onProgress).catch(error=>{error.jobId=error.jobId||request.requestId;if(error.code==='analysis_uncertain')error.restartAnalysis=()=>{analysisRequests.delete(key);saveAnalysisRequests();};throw error;}).finally(()=>analysisFlights.delete(key));
 analysisFlights.set(key,operation);return operation;
}
`;
