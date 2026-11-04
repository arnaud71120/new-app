// Administration needs collection metadata, not full publication bodies.
export function summarizeFeedRecord(row){
 const {articles,...monitor}=row;
 const dates=(articles||[]).map(article=>article.date).filter(date=>Number.isFinite(Date.parse(date))).sort();
 return {...monitor,count:articles?.length||0,latestPostAt:dates.at(-1)||null};
}

const contexts=new WeakMap();
export function requestReference(request){
 let context=contexts.get(request);if(!context){context={requestId:crypto.randomUUID()};contexts.set(request,context);}return context.requestId;
}
export function serviceError(request,service,stage,error){
 if(error?.service&&error?.stage)return error;
 const timeout=['TimeoutError','AbortError'].includes(error?.name);
 return Object.assign(new Error('Service indisponible'),{service,stage,code:timeout?'service_timeout':'service_unavailable',requestId:requestReference(request)});
}
export function failureDetails(request,error){
 return {error:error?.service==='source-discovery'?'La vérification des sources est temporairement indisponible. La saisie est conservée.':error?.service==='administration'?'La lecture de l’administration est temporairement indisponible. Vos réglages sont conservés.':'Service temporairement indisponible. Réessayez sans modifier vos paramètres.',code:error?.code||'service_unavailable',service:error?.service||'application',stage:error?.stage||'request',requestId:requestReference(request)};
}
