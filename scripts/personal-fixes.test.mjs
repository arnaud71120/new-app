import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {bookmarkSnapshot,archivedBookmarkEvent,sourceAlertIncidents,personalOperation} from '../worker/personal.js';
import {WORKSPACE_SCRIPT} from '../worker/workspace-ui.js';
const date='2026-10-21T10:00:00.000Z';
const event={id:'cve:CVE-2026-12345',title:'Alerte critique',summary:'Publication de référence',url:'https://www.cert.ssi.gouv.fr/alerte/',source:'CERT-FR',date,type:'Vulnérabilité',score:85,reasons:['Exploitation connue'],cves:['CVE-2026-12345'],references:['https://www.cisa.gov/known-exploited-vulnerabilities-catalog'],articles:[{id:'https://www.cert.ssi.gouv.fr/alerte/',url:'https://www.cert.ssi.gouv.fr/alerte/',title:'Alerte critique',summary:'Texte conservé',source:'CERT-FR',sourceId:'certfr',date,type:'Vulnérabilité',score:85,reasons:['Exploitation connue'],references:['https://nvd.nist.gov/vuln/detail/CVE-2026-12345'],cves:['CVE-2026-12345'],knownExploited:true,provenance:[{url:'https://www.cisa.gov/known-exploited-vulnerabilities-catalog',extrait:'Élément de provenance',citedBy:[]}]}]};
const store=()=>{const values=new Map();return {get:async k=>structuredClone(values.get(k)),put:async(k,v)=>values.set(k,structuredClone(v))};};
const user='a'.repeat(64);

test('Une archive durable conserve son classement et les publications de preuve',()=>{
 const saved=bookmarkSnapshot(event),restored=archivedBookmarkEvent(saved);
 assert.equal(saved.archiveVersion,2);assert.equal(restored.type,'Vulnérabilité');assert.equal(restored.score,85);assert.deepEqual(restored.reasons,['Exploitation connue']);assert.equal(restored.references[0],event.references[0]);assert.equal(restored.articles[0].knownExploited,true);assert.equal(restored.articles[0].sourceId,'certfr');assert.equal(restored.articles[0].provenance[0].extrait,'Élément de provenance');assert.equal(restored.archived,true);
});
test('Les anciennes archives restent lisibles et une archive bornée est signalée',()=>{
 const legacy=archivedBookmarkEvent({id:'old',url:'https://www.cisa.gov/alert/',title:'Ancien favori',source:'CISA',date});assert.equal(legacy.score,30);assert.equal(legacy.type,'Veille générale');assert.equal(legacy.articles.length,1);
 const bounded=bookmarkSnapshot({...event,articles:Array.from({length:21},()=>event.articles[0])});assert.equal(bounded.articles.length,20);assert.equal(bounded.articleCount,21);assert.equal(bounded.archiveTruncated,true);
});
test('Les URL internes dans une publication associée sont refusées sans écriture partielle',async()=>{
 const storage=store(),result=await personalOperation(storage,user,{action:'bookmark',revision:0,event:{...event,articles:[{...event.articles[0],url:'https://localhost./'}]}});assert.equal(result.status,400);assert.equal((await personalOperation(storage,user,{action:'read'})).revision,0);
});
test('Un acquittement de panne ne masque pas la prochaine panne et le rétablissement est suivi',()=>{
 const first=sourceAlertIncidents([{source:'certfr',status:'error',code:403,checkedAt:date}]);assert.equal(first.length,1);const acknowledged=first[0].id;
 const repeated=sourceAlertIncidents([{source:'certfr',status:'error',code:403,checkedAt:'2026-10-21T10:05:00Z'}],first);assert.equal(repeated.length,1);assert.equal(repeated[0].id,acknowledged);
 const recovered=sourceAlertIncidents([{source:'certfr',status:'ok',checkedAt:'2026-10-21T10:10:00Z'}],repeated);assert.equal(recovered[0].state,'resolved');assert.equal(recovered[0].resolution,'recovered');
 const newFailure=sourceAlertIncidents([{source:'certfr',status:'error',code:403,checkedAt:'2026-10-21T10:15:00Z'}],recovered);assert.equal(newFailure.length,2);assert.equal(newFailure[1].state,'open');assert.notEqual(newFailure[1].id,acknowledged);assert.notEqual(newFailure[1].id,'source:certfr');
});
test('Une source en attente ne ferme pas un incident et un nouveau code ouvre un autre incident',()=>{
 const first=sourceAlertIncidents([{source:'certfr',status:'error',code:403,checkedAt:date}]);const pending=sourceAlertIncidents([{source:'certfr',status:'pending',checkedAt:'2026-10-21T10:05:00Z'}],first);assert.equal(pending[0].state,'open');const changed=sourceAlertIncidents([{source:'certfr',status:'error',code:503,checkedAt:'2026-10-21T10:10:00Z'}],pending);assert.equal(changed.length,2);assert.equal(changed[0].resolution,'changed');assert.notEqual(changed[1].id,changed[0].id);
});
test('Les incidents et notifications sont enregistrés dans le compte avec contrôle de révision',async()=>{
 const storage=store(),items=sourceAlertIncidents([{source:'certfr',status:'error',code:404,checkedAt:date}]);assert.equal((await personalOperation(storage,user,{action:'source-incidents',items,revision:0})).ok,true);assert.equal((await personalOperation(storage,user,{action:'notified',ids:[items[0].id],revision:1})).ok,true);const current=await personalOperation(storage,user,{action:'read'});assert.deepEqual(current.alerts,items);assert.deepEqual(current.notified,[items[0].id]);assert.equal((await personalOperation(storage,user,{action:'notified',ids:['other'],revision:1})).status,409);assert.equal((await personalOperation(storage,'b'.repeat(64),{action:'read'})).notified.length,0);
});
function browser(state){const notifications=[],commands=[],context=vm.createContext({data:{events:[event],sources:[]},accessToken:'fixture',Notification:class {static permission='granted';constructor(title,options){notifications.push({title,...options});}},Date,console});vm.runInContext(WSPACE(),context);context.initialState=structuredClone(state);context.commands=commands;vm.runInContext(`personalState=initialState;personalCommand=async command=>{commands.push(command);if(command.action==='notified')personalState.notified=[...new Set([...(personalState.notified||[]),...command.ids])];if(command.action==='source-incidents')personalState.alerts=command.items;return true;};`,context);return {context,commands,notifications};}
function WSPACE(){return WORKSPACE_SCRIPT.replace(/bindWorkspace\(\);\s*$/,'');}
test('Les notifications acquises restent dédupliquées après rechargement du navigateur',async()=>{
 const state={bookmarks:{},read:[],watchlist:['CVE-2026'],preferences:{notifications:true},alerts:[],notified:[]},first=browser(state);await vm.runInContext('notifyPersonalAlerts()',first.context);assert.equal(first.notifications.length,1);assert.equal(first.commands[0].action,'notified');await vm.runInContext('notifyPersonalAlerts()',first.context);assert.equal(first.notifications.length,1);
 const persisted=JSON.parse(vm.runInContext('JSON.stringify(personalState)',first.context)),reloaded=browser(persisted);await vm.runInContext('notifyPersonalAlerts()',reloaded.context);assert.equal(reloaded.notifications.length,0);
});
test('Un acquittement de l’ancien identifiant source ne masque pas les nouveaux incidents dans l’interface',()=>{
 const state={bookmarks:{},read:['source:certfr'],watchlist:[],preferences:{},alerts:[]},b=browser(state);vm.runInContext(`data.sources=[{source:'certfr',status:'error',code:403,checkedAt:'${date}'}]`,b.context);const alerts=vm.runInContext('currentAlerts()',b.context);assert.equal(alerts.length,1);assert.notEqual(alerts[0].id,'source:certfr');assert.equal(b.commands[0].action,'source-incidents');
});

test('Un résultat réseau ancien ne rouvre pas une panne déjà rétablie',()=>{const failed=sourceAlertIncidents([{source:'certfr',status:'error',code:403,checkedAt:date}]);const recovered=sourceAlertIncidents([{source:'certfr',status:'ok',checkedAt:'2026-10-21T10:15:00Z'}],failed);const stale=sourceAlertIncidents([{source:'certfr',status:'error',code:403,checkedAt:'2026-10-21T10:05:00Z'}],recovered);assert.equal(stale.length,1);assert.equal(stale[0].state,'resolved');});
