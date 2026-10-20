export function socialPlan(profiles,config={}){
 const active=profiles.filter(p=>p.enabled!==false),x=active.filter(p=>p.x).length,linkedin=active.filter(p=>p.linkedin).length;
 const linkedinHours=config.socialSchedule?.linkedinHours||24;
 let xHours=config.socialSchedule?.xHours||Math.max(6,Math.ceil(x*3*744/Math.max(1,4000-linkedin*Math.ceil(744/linkedinHours))));
 if(!config.socialSchedule?.xHours)while(x*3*Math.ceil(744/xHours)+linkedin*Math.ceil(744/linkedinHours)>4000&&xHours<168)xHours++;
 return {xHours,linkedinHours,xProfiles:x,linkedinProfiles:linkedin,reserved31Days:x*3*Math.ceil(744/xHours)+linkedin*Math.ceil(744/linkedinHours),cap:4000};
}
export async function appendRuns(storage,rows){
 for(const row of rows){const {articles,...entry}=row;await storage.put('run:'+String(Date.now())+'-'+crypto.randomUUID(),{...entry,id:crypto.randomUUID(),count:row.count??articles?.length??0,at:row.at||row.checkedAt||new Date().toISOString()});}
 const all=await storage.list({prefix:'run:',limit:700});for(const key of [...all.keys()].slice(0,Math.max(0,all.size-500)))await storage.delete(key);
}
export async function operationState(storage){
 const runs=[...(await storage.list({prefix:'run:',limit:200,reverse:true})).values()],times=runs.map(r=>r.durationMs).filter(Number.isFinite).sort((a,b)=>a-b);
 return {runs,backups:await storage.get('admin:backups')||[],heartbeat:await storage.get('ops:heartbeat')||null,metrics:{sample:runs.length,errors:runs.filter(r=>r.status==='error').length,p50:times.length?times[Math.floor((times.length-1)*.5)]:null,p95:times.length?times[Math.floor((times.length-1)*.95)]:null},retention:{runs:500,posts:800,postDays:60,backups:20}};
}
export function sourceCoverage(sources,records,now=Date.now()){
 return sources.map(s=>{const r=records.find(r=>r.source===s.id),dates=(r?.articles||[]).map(a=>a.date).filter(x=>Number.isFinite(Date.parse(x))).sort(),latest=dates.at(-1)||null,threshold=(s.staleAfterHours||48)*3600000;
 return {id:s.id,name:s.name,enabled:s.enabled,status:!s.enabled?'paused':!r?'unseen':r.status==='error'?'error':now-Date.parse(r.checkedAt)>Math.max(Math.ceil(sources.filter(s=>s.enabled).length/8)*900000+900000,(s.intervalMinutes||1)*180000)?'collection_late':latest&&now-Date.parse(latest)>threshold?'old_content':'fresh',latestPostAt:latest,checkedAt:r?.checkedAt||null,code:r?.code||null,count:r?.articles?.length||0};});
}
export async function retentionMaintenance(storage,now=Date.now()){
 const cursor=await storage.get('cleanup:cursor'),page=await storage.list({limit:1000,...(cursor?{startAfter:cursor}:{})});
 for(const [key,row] of page)if(row&&typeof row==='object'&&(row.expires<=now||(key.startsWith('session:')&&now-row.lastSeen>7200000)))await storage.delete(key);
 if(page.size===1000)await storage.put('cleanup:cursor',[...page.keys()].at(-1));else await storage.delete('cleanup:cursor');return page.size;
}
