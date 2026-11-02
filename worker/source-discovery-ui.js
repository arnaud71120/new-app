const SOURCE_DISCOVERY_LAZY_STYLE=String.raw`
.source-kind-picker{display:flex;gap:8px;flex-wrap:wrap;margin:4px 0 16px}.source-kind-picker button{flex:1;white-space:nowrap;border:1px solid #60758b;background:#142238;color:#e4edf8}.source-kind-picker button[aria-pressed=true]{border:2px solid #a4ed80;background:#25483d;color:#c6ff9a;font-weight:700}.source-discovery{border-bottom:1px solid #36536a;padding-bottom:16px;margin-bottom:14px}.source-lookup-host{position:relative}.source-lookup-options{display:grid;gap:5px;max-height:290px;overflow:auto;border:1px solid #46617d;border-radius:12px;background:#0a1525;padding:7px;margin:6px 0}.source-lookup-options[hidden]{display:none}.source-lookup-options button{text-align:left;white-space:normal;overflow-wrap:anywhere;padding:12px;border:1px solid transparent;border-radius:9px;background:#142238;color:#e4edf8;min-height:52px}.source-lookup-options button[aria-selected=true]{border-color:#96dc9b;background:#25483d}.source-lookup-options strong,.source-lookup-options small{display:block}.source-lookup-options small{color:#a6b9cd;font-size:12px;line-height:1.6}.source-lookup-status,.source-verification{font-size:13px;line-height:1.7;overflow-wrap:anywhere;min-height:1.7em}.source-verification[data-status=verified]{color:#a1e6b6}.source-verification[data-status=error]{color:#ffc3a0}.source-verification[data-status=unverified]{color:#e1c782}.source-inline-lookup{margin:0 0 14px}.source-inline-lookup>label{margin-bottom:4px}.source-inline-lookup [data-source-verify]{padding:7px 11px;font-size:12px;min-height:36px}.source-lookup-status:empty,.source-verification:empty{display:none}.admin-dialog [hidden]{display:none!important}@media(max-width:650px){.source-lookup-options{max-height:250px}.source-lookup-options button{padding:11px}.source-lookup-options small{font-size:12px}.source-discovery{padding-bottom:12px}}
`;
export const SOURCE_DISCOVERY_STYLE='.admin-dialog [hidden]{display:none!important}';
export const SOURCE_DISCOVERY_SCRIPT='(()=>{if(!document.getElementById("source-discovery-style")){const style=document.createElement("style");style.id="source-discovery-style";style.textContent='+JSON.stringify(SOURCE_DISCOVERY_LAZY_STYLE)+';document.head.append(style);}})();\n'+String.raw`
const sourceLookupBindings=new WeakMap(),sourceLookupRecords=new Set();let sourceLookupCounter=0,sourceEditorAutoName='',sourceEditorSaving=false;const sourceEditorAutoFields=new Map();
const SOURCE_LOOKUP_X_RESERVED=new Set('home login logout signup search explore notifications messages settings compose intent i share tos privacy about help hashtag jobs download premium communities'.split(' '));
const discoveryLabels={site:'Site · RSS / Atom',x:'X / Twitter',linkedin:'LinkedIn'};
const sourceQueryLabels={site:['Rechercher un site internet','Nom du site ou adresse https://…'],x:['Rechercher un compte Twitter / X','Nom du compte, @identifiant ou https://x.com/…'],linkedin:['Rechercher un profil LinkedIn','Nom de la personne ou https://www.linkedin.com/in/…']};
function sourceDiscoveryMessage(node,message,status='unverified'){if(!node)return;node.textContent=message||'';node.dataset.status=status;}
function sourceDiscoveryUrl(value){try{const u=new URL(String(value||''));return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}}
function sourceXHandle(value){let text=String(value||'').trim();if(/[\\\u0000-\u0020]/.test(text))return null;if(/^https?:\/\//i.test(text)){try{const u=new URL(text);if(u.protocol!=='https:'||u.username||u.password||u.port||! /^(?:www\.|mobile\.)?(?:x|twitter)\.com$/i.test(u.hostname)||/%(?:2f|5c|00|0a|0d)/i.test(u.pathname))return null;text=u.pathname.replace(/^\/+|\/+$/g,'');}catch{return null;}}text=text.replace(/^@/,'').toLowerCase();return /^[a-z0-9_]{1,15}$/.test(text)&&!SOURCE_LOOKUP_X_RESERVED.has(text)?text:null;}
function sourceLinkedInUrl(value){try{const raw=String(value||'').trim();if(/[\\\u0000-\u0020]/.test(raw))return null;const u=new URL(raw);if(u.protocol!=='https:'||u.username||u.password||u.port||! /^(?:www\.|[a-z]{2,3}\.)?linkedin\.com$/i.test(u.hostname)||/%(?:2f|5c|00|0a|0d)/i.test(u.pathname))return null;const match=u.pathname.match(/^\/in\/([^/]+)\/?$/i),slug=match&&decodeURIComponent(match[1]);if(!slug||slug.length>200||!/^[\p{L}\p{N}][\p{L}\p{N}_-]*$/u.test(slug))return null;return 'https://www.linkedin.com/in/'+encodeURIComponent(slug.toLowerCase())+'/';}catch{return null;}}

function sourceCandidateUrl(platform,value){if(platform==='x'){const handle=sourceXHandle(value);return handle?'https://x.com/'+handle:null;}if(platform==='linkedin')return sourceLinkedInUrl(value);return sourceDiscoveryUrl(value);}
function cancelSourceLookup(record){clearTimeout(record.timer);record.epoch++;record.searchController?.abort();record.verifyController?.abort();record.input.setAttribute('aria-busy','false');}
function cancelSourceLookups(root){for(const record of sourceLookupRecords){if(!record.input.isConnected){cancelSourceLookup(record);sourceLookupRecords.delete(record);}else if(!root||root.contains(record.input)){cancelSourceLookup(record);record.close?.();}}}
function sourceLookupCurrent(record,epoch,token,privateVersion){return record.input.isConnected&&record.epoch===epoch&&accessToken===token&&privateEpoch===privateVersion;}
function sourceSuggestionLabel(item){return (discoveryLabels[item.platform]||'Source')+' · '+(item.verification==='catalog'||item.origin==='catalog'?'Présent dans le catalogue':item.verification==='indexed'||item.origin==='web'?'Résultat indexé · vérification à faire':'Adresse proposée · non vérifiée');}
function sourceLookupHost(input){const explicit=input.closest('.source-lookup-host');if(explicit)return explicit;const label=input.closest('label'),host=document.createElement('div');host.className='source-lookup-host source-inline-lookup';if(label){label.before(host);host.append(label);}else{input.before(host);host.append(input);}return host;}
function sourceLocalSuggestions(platform,query){
 const fold=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(),term=fold(query.replace(/^@/,'')),items=[];
 if(platform==='site')for(const source of adminState?.sources||[]){const url=sourceDiscoveryUrl(source.home||source.url);if(url&&fold([source.name,source.home,source.url].join(' ')).includes(term))items.push({platform,name:source.name,url,home:source.home,feedUrl:source.url,origin:'catalog',verification:'catalog'});}
 else for(const profile of adminState?.profiles||[]){const url=sourceCandidateUrl(platform,profile[platform]);if(url&&fold([profile.name,profile[platform],url].join(' ')).includes(term))items.push({platform,name:profile.name,url,...(platform==='x'?{handle:sourceXHandle(profile.x)}:{}),origin:'catalog',verification:'catalog'});}
 let direct=null;if(platform==='x'&&sourceXHandle(query))direct=sourceCandidateUrl(platform,query);else if(/^https:\/\//i.test(query))direct=sourceCandidateUrl(platform,query);
 if(direct&&!items.some(item=>item.url===direct))items.unshift({platform,name:platform==='x'?'@'+sourceXHandle(direct):direct,url:direct,...(platform==='x'?{handle:sourceXHandle(direct)}:{}),origin:'address',verification:'unverified'});
 return items.slice(0,8);
}
function mergeSourceSuggestions(local,remote){const items=new Map(),rank=item=>item?.origin==='catalog'||item?.verification==='catalog'?3:item?.origin==='web'||item?.verification==='indexed'?2:1;for(const item of [...local,...remote]){const key=item.url||item.feedUrl||item.handle;if(key&&(!items.has(key)||rank(item)>rank(items.get(key))))items.set(key,item);}return [...items.values()].slice(0,12);}
function bindSourceLookup(input,settings){
 if(!input||sourceLookupBindings.has(input))return sourceLookupBindings.get(input);
 const host=sourceLookupHost(input),id='source-lookup-'+(++sourceLookupCounter),list=document.createElement('div'),status=document.createElement('p');
 if(!input.id)input.id=id+'-input';list.id=id+'-results';list.className='source-lookup-options';list.role='listbox';list.dataset.sourceResults='true';list.hidden=true;status.id=id+'-status';status.className='source-lookup-status';status.dataset.sourceVerification='true';status.role='status';status.setAttribute('aria-live','polite');host.append(list,status);
 input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-haspopup','listbox');input.setAttribute('aria-controls',list.id);input.setAttribute('aria-expanded','false');input.setAttribute('autocomplete','off');input.setAttribute('aria-describedby',[input.getAttribute('aria-describedby'),status.id].filter(Boolean).join(' '));
 const record={input,settings,host,list,status,items:[],active:-1,epoch:0,timer:null,searchController:null,verifyController:null};sourceLookupBindings.set(input,record);sourceLookupRecords.add(record);
 const platform=()=>typeof settings.platform==='function'?settings.platform():settings.platform;
 const close=()=>{list.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');record.active=-1;};record.close=close;
 const draw=()=>{list.innerHTML='';record.items.forEach((item,index)=>{const button=document.createElement('button');button.type='button';button.role='option';button.id=id+'-option-'+index;button.dataset.sourceOption=String(index);button.tabIndex=-1;button.setAttribute('aria-selected',String(index===record.active));const title=document.createElement('strong');title.textContent=item.name||item.handle||item.url||'Adresse publique';const address=document.createElement('small');address.textContent=item.url||item.feedUrl||item.handle||'';const label=document.createElement('small');label.textContent=sourceSuggestionLabel(item);button.append(title,address,label);button.addEventListener('mousedown',event=>event.preventDefault());button.addEventListener('click',()=>pick(index));list.append(button);});list.hidden=!record.items.length||!host.contains(document.activeElement);input.setAttribute('aria-expanded',String(!list.hidden));if(record.active>=0){input.setAttribute('aria-activedescendant',id+'-option-'+record.active);list.children[record.active]?.scrollIntoView?.({block:'nearest'});}else input.removeAttribute('aria-activedescendant');};
 async function verify(url,item={}){
  if(settings.verificationNode)for(const other of sourceLookupRecords)if(other!==record&&other.settings.verificationNode===settings.verificationNode){cancelSourceLookup(other);other.close();other.items=[];other.status.textContent='';}
  cancelSourceLookup(record);close();const selectedPlatform=platform(),epoch=record.epoch,token=accessToken,privateVersion=privateEpoch,controller=new AbortController();record.verifyController=controller;
  const messageNode=settings.verificationNode||status;sourceDiscoveryMessage(messageNode,'Vérification de l’adresse publique en cours…','checking');input.setAttribute('aria-busy','true');
  if(!token){sourceDiscoveryMessage(messageNode,'Connectez-vous pour vérifier une source.','error');input.setAttribute('aria-busy','false');return null;}
  try{
   const response=await fetch('/api/source-search',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({platform:selectedPlatform,url}),signal:controller.signal,timeoutMs:25000}),value=await response.json();if(!sourceLookupCurrent(record,epoch,token,privateVersion))return null;
   if(!response.ok)throw Error(value.error||value.message||'Vérification indisponible (HTTP '+response.status+').');
   const code=value.httpStatus!=null?' · HTTP '+value.httpStatus:'',checked=value.checkedAt&&Number.isFinite(Date.parse(value.checkedAt))?' · '+new Date(value.checkedAt).toLocaleTimeString('fr-FR',{timeZone:'Europe/Paris'}):'';
   sourceDiscoveryMessage(messageNode,(value.message||(value.status==='verified'?'Adresse vérifiée.':'Adresse non confirmée.'))+code+checked,['verified','error'].includes(value.status)?value.status:'unverified');
   settings.onVerified?.(value,item,selectedPlatform);return value;
  }catch(error){if(error.name!=='AbortError'&&sourceLookupCurrent(record,epoch,token,privateVersion))sourceDiscoveryMessage(messageNode,requestFailure(error),'error');return null;}
  finally{if(sourceLookupCurrent(record,epoch,token,privateVersion))input.setAttribute('aria-busy','false');}
 }
 record.verify=verify;
 async function pick(index){const item=record.items[index];if(!item)return;const selectedPlatform=platform(),url=sourceCandidateUrl(selectedPlatform,item.url||item.feedUrl||item.handle);if(!url){sourceDiscoveryMessage(settings.verificationNode||status,'L’adresse de ce résultat n’est pas utilisable. Saisissez une adresse publique HTTPS.','error');return;}input.value=item.name||item.handle||item.url||'';settings.onSelected?.(item,selectedPlatform);await verify(url,item);}
 async function search(){
  const query=input.value.trim();cancelSourceLookup(record);close();record.items=[];if(query.length<2){status.textContent='Saisissez au moins deux caractères ou une adresse.';return;}
  const selectedPlatform=platform(),local=sourceLocalSuggestions(selectedPlatform,query),epoch=record.epoch,token=accessToken,privateVersion=privateEpoch,controller=new AbortController();record.searchController=controller;record.items=local;draw();status.textContent=local.length?'Propositions disponibles · recherche de comptes et de sites en cours…':'Recherche de suggestions en cours…';input.setAttribute('aria-busy','true');
  if(!token){status.textContent=(local.length?'Adresse proposée, non vérifiée. ':'')+'Connectez-vous pour rechercher des sources.';input.setAttribute('aria-busy','false');return;}
  try{const response=await fetch('/api/source-search?'+new URLSearchParams({platform:selectedPlatform,q:query}),{headers:{Authorization:'Bearer '+token},signal:controller.signal,timeoutMs:20000}),value=await response.json();if(!sourceLookupCurrent(record,epoch,token,privateVersion))return;if(!response.ok)throw Error(value.error||value.message||'Recherche indisponible (HTTP '+response.status+').');record.items=mergeSourceSuggestions(local,Array.isArray(value.results)?value.results.filter(item=>item&&typeof item==='object'):[]);status.textContent=value.message||(record.items.length?record.items.length+' suggestion(s). Sélectionnez une adresse pour la vérifier.':'Aucun résultat pour cette recherche. La saisie manuelle reste disponible.');record.active=-1;draw();}
  catch(error){if(error.name!=='AbortError'&&sourceLookupCurrent(record,epoch,token,privateVersion))status.textContent=requestFailure(error)+(record.items.length?' Les propositions locales restent disponibles.':'');}
  finally{if(sourceLookupCurrent(record,epoch,token,privateVersion))input.setAttribute('aria-busy','false');}
 }
 record.search=search;
 input.addEventListener('input',()=>{cancelSourceLookup(record);close();record.items=[];status.dataset.status='unverified';settings.onInput?.();const query=input.value.trim();record.items=query.length>=2?sourceLocalSuggestions(platform(),query):[];draw();status.textContent=query.length<2?'Saisissez au moins deux caractères ou une adresse.':record.items.length?'Propositions locales · sélectionnez une adresse pour la vérifier.':'Recherche dès la fin de votre saisie…';if(query.length>=2)record.timer=setTimeout(search,400);});
 input.addEventListener('keydown',event=>{if(event.key==='Escape'){if(!list.hidden){event.preventDefault();event.stopPropagation();}cancelSourceLookup(record);close();return;}if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();if(!record.items.length){search();return;}record.active=record.active<0?(event.key==='ArrowDown'?0:record.items.length-1):(record.active+(event.key==='ArrowDown'?1:-1)+record.items.length)%record.items.length;draw();return;}if(event.key==='Enter'&&!list.hidden&&record.items.length){event.preventDefault();pick(record.active>=0?record.active:0);}});
 input.addEventListener('focus',()=>{if(record.items.length)draw();});
 input.addEventListener('blur',()=>setTimeout(()=>{if(!host.contains(document.activeElement))close();},120));
 if(settings.manualVerify){const button=document.createElement('button');button.type='button';button.dataset.sourceVerify='true';button.textContent='Vérifier ce profil';host.append(button);button.onclick=()=>{const url=sourceCandidateUrl(platform(),input.value);if(!url){sourceDiscoveryMessage(settings.verificationNode||status,'Saisissez un identifiant X ou une adresse de profil LinkedIn /in/ valide.','error');return;}verify(url,{url});};}
 return record;
}
function sourceProfileDrafts(){const rows=[...document.querySelectorAll('#profile-rows [data-profile-row]')];if(!rows.length)return (adminState?.profiles||[]).map(profile=>({...profile}));return rows.map(row=>({id:row.dataset.profileRow,name:row.querySelector('[data-profile-name]').value,x:row.querySelector('[data-profile-x]').value.trim()||null,linkedin:row.querySelector('[data-profile-li]').value.trim()||null,enabled:row.querySelector('[data-profile-enabled]').checked,priority:Number(row.querySelector('[data-profile-priority]').value)}));}
function setSourceEditorAutoField(selector,value){const input=$(selector);if(!input)return;input.value=value||'';sourceEditorAutoFields.set(selector,input.value);}
function clearSourceEditorAutoFields(){for(const [selector,value] of sourceEditorAutoFields){const input=$(selector);if(input&&input.value===value)input.value='';}sourceEditorAutoFields.clear();if($('#admin-name').value===sourceEditorAutoName)$('#admin-name').value='';sourceEditorAutoName='';}
function clearSourceLookupState(input){const lookup=sourceLookupBindings.get(input);if(lookup){cancelSourceLookup(lookup);lookup.close();lookup.items=[];lookup.status.textContent='';lookup.status.dataset.status='unverified';}}
function invalidateSourceEditorDiscovery(){clearSourceLookupState($('#admin-profile-value'));clearSourceEditorAutoFields();$('#admin-feed-choice').innerHTML='';$('#admin-feed-choice-field').hidden=true;sourceDiscoveryMessage($('#admin-source-verification'),'Sélectionnez une proposition pour vérifier son adresse.','unverified');}
function invalidateSourceEditorManualChange(){
 clearSourceLookupState($('#admin-source-query'));
 sourceEditorAutoFields.clear();sourceEditorAutoName='';const choice=$('#admin-feed-choice');choice.innerHTML='';choice.onchange=null;$('#admin-feed-choice-field').hidden=true;
 sourceDiscoveryMessage($('#admin-source-verification'),'Adresse modifiée : la vérification précédente ne s’applique plus. Vérifiez cette nouvelle adresse si nécessaire.','unverified');
}
function sourceEditorName(value){if(value&&(!$('#admin-name').value.trim()||$('#admin-name').value===sourceEditorAutoName)){sourceEditorAutoName=String(value).slice(0,120);$('#admin-name').value=sourceEditorAutoName;}}
function sourceEditorSelect(item,platform){sourceEditorName(item.name);if(platform==='site'){setSourceEditorAutoField('#admin-home',sourceDiscoveryUrl(item.home||item.url)||'');setSourceEditorAutoField('#admin-url',sourceDiscoveryUrl(item.feedUrl)||'');}else $('#admin-profile-value').value=platform==='x'?(sourceXHandle(item.handle||item.url)||''):(sourceLinkedInUrl(item.url)||'');}

function applySourceVerification(value,item,platform){
 sourceEditorName(value.name||item.name);if(platform!=='site'){$('#admin-profile-value').value=platform==='x'?(sourceXHandle(value.handle||value.url||item.handle||item.url)||$('#admin-profile-value').value):(sourceLinkedInUrl(value.url||item.url)||$('#admin-profile-value').value);return;}
 const home=sourceDiscoveryUrl(value.home||item.home);if(home)setSourceEditorAutoField('#admin-home',home);
 const candidates=(Array.isArray(value.feeds)?value.feeds:[]).map(feed=>typeof feed==='string'?{url:feed}:feed).filter(feed=>feed&&sourceDiscoveryUrl(feed.url));if(value.feedUrl&&!candidates.some(feed=>feed.url===value.feedUrl))candidates.unshift({url:value.feedUrl,name:'Flux proposé',verified:value.status==='verified'});
 const choice=$('#admin-feed-choice'),field=$('#admin-feed-choice-field');choice.innerHTML='';field.hidden=candidates.length<2;
 if(candidates.length===1){setSourceEditorAutoField('#admin-url',candidates[0].url);return;}
 if(candidates.length>1){setSourceEditorAutoField('#admin-url','');const first=document.createElement('option');first.value='';first.textContent='Choisir parmi '+candidates.length+' flux';choice.append(first);for(const feed of candidates){const option=document.createElement('option');option.value=feed.url;option.textContent=(feed.name||feed.title||feed.url)+(feed.verified?' · vérifié':' · à vérifier');choice.append(option);}choice.onchange=()=>setSourceEditorAutoField('#admin-url',choice.value);return;}
 if(sourceEditorAutoFields.get('#admin-url')===$('#admin-url').value){$('#admin-url').value='';sourceEditorAutoFields.delete('#admin-url');}
 if(value.status==='verified')sourceDiscoveryMessage($('#admin-source-verification'),(value.message||'Le site répond.')+' Aucun flux RSS / Atom n’est confirmé. Indiquez une adresse de flux manuellement pour l’ajouter.','unverified');
}
function configureSourceEditor(kind,editing=false){
 const site=kind==='site',admin=adminState?.role==='admin',select=$('#admin-source-kind');select.value=kind;select.disabled=editing;document.querySelectorAll('[data-source-kind]').forEach(button=>{button.setAttribute('aria-pressed',String(button.dataset.sourceKind===kind));button.disabled=editing;});const [queryLabel,queryPlaceholder]=sourceQueryLabels[kind];$('#admin-source-query-label').textContent=queryLabel;$('#admin-source-query').placeholder=queryPlaceholder;$('#admin-source-role-note').hidden=admin;
 document.querySelectorAll('[data-admin-site-field]').forEach(field=>field.hidden=!site);$('#admin-social-value-field').hidden=site;$('#admin-url').required=site;$('#admin-profile-value').required=!site;$('#admin-interval').required=site;
 $('#admin-profile-label').textContent=kind==='x'?'Identifiant X sans @':'Adresse du profil LinkedIn /in/';$('#admin-profile-value').placeholder=kind==='x'?'identifiant ou https://x.com/identifiant':'https://www.linkedin.com/in/profil/';
 $('#admin-editor-title').textContent=editing?$('#admin-editor-title').textContent:'Ajouter '+discoveryLabels[kind];$('#admin-editor-note').textContent=site?'Les suggestions sont vérifiées avant leur utilisation. Une adresse de flux peut aussi être saisie manuellement ; la vérification ne bloque pas son enregistrement.':'Le profil sera ajouté aux comptes suivis. Un blocage 403 ou une page de connexion n’est pas une confirmation de collecte. Le budget et les autorisations sont revalidés à l’enregistrement.';
 $('#admin-source-save').disabled=sourceEditorSaving||!site&&!admin;$('#admin-source-save').textContent=site?'Enregistrer la source':'Enregistrer le profil';
}
function bindSourceLookups(){
 const saveProfiles=$('#profile-save');if(saveProfiles){saveProfiles.disabled=adminState?.role!=='admin';saveProfiles.title=saveProfiles.disabled?'L’enregistrement de profils sociaux exige le rôle administrateur.':'';}
 const query=$('#admin-source-query');if(query&&!sourceLookupBindings.has(query))bindSourceLookup(query,{platform:()=>$('#admin-source-kind').value,verificationNode:$('#admin-source-verification'),onInput:()=>{const value=query.value.trim(),current=$('#admin-source-kind').value;if(!$('#admin-source-kind').disabled&&/^@[a-z0-9_]+$/i.test(value)&&current!=='x')configureSourceEditor('x');else if(!$('#admin-source-kind').disabled&&/^https:\/\/(?:www\.|mobile\.)?(?:x|twitter)\.com\//i.test(value)&&current!=='x')configureSourceEditor('x');else if(!$('#admin-source-kind').disabled&&/^https:\/\/(?:www\.|[a-z]{2,3}\.)?linkedin\.com\/in\//i.test(value)&&current!=='linkedin')configureSourceEditor('linkedin');invalidateSourceEditorDiscovery();},onSelected:sourceEditorSelect,onVerified:applySourceVerification});
 const identifier=$('#admin-profile-value');if(identifier&&!sourceLookupBindings.has(identifier))bindSourceLookup(identifier,{platform:()=>$('#admin-source-kind').value,verificationNode:$('#admin-source-verification'),onSelected:sourceEditorSelect,onVerified:applySourceVerification});
 for(const input of document.querySelectorAll('#profile-rows [data-profile-x],#profile-rows [data-profile-li]')){
  const platform=input.hasAttribute('data-profile-x')?'x':'linkedin';bindSourceLookup(input,{platform,manualVerify:true,onSelected:item=>{input.value=platform==='x'?(sourceXHandle(item.handle||item.url)||input.value):(sourceLinkedInUrl(item.url)||input.value);const name=input.closest('[data-profile-row]')?.querySelector('[data-profile-name]');if(name&&!name.value.trim()&&item.name)name.value=item.name;input.dispatchEvent(new Event('input',{bubbles:true}));},onVerified:(value,item)=>{const next=platform==='x'?sourceXHandle(value.handle||value.url||item.handle||item.url):sourceLinkedInUrl(value.url||item.url);if(next)input.value=next;const name=input.closest('[data-profile-row]')?.querySelector('[data-profile-name]');if(name&&!name.value.trim()&&(value.name||item.name))name.value=value.name||item.name;input.closest('#profile-rows')?.dispatchEvent(new Event('input',{bubbles:true}));}});
 }
}
function bindSourceDiscovery(){
 const editor=$('#admin-editor');if(!editor?.querySelector)return;
 const editBeforeDiscovery=editAdminSource;editAdminSource=function(id){if(sourceEditorSaving||adminBusy)return;cancelSourceLookups(editor);editBeforeDiscovery(id);sourceEditorAutoName='';sourceEditorAutoFields.clear();$('#admin-source-query').value='';clearSourceLookupState($('#admin-source-query'));clearSourceLookupState($('#admin-profile-value'));$('#admin-profile-value').value='';$('#admin-feed-choice-field').hidden=true;sourceDiscoveryMessage($('#admin-source-verification'),'');configureSourceEditor('site',!!id);bindSourceLookups();if(!id)$('#admin-source-query').focus();};
 const renderBeforeDiscovery=renderAdmin;renderAdmin=function(){cancelSourceLookups($('#admin-content'));renderBeforeDiscovery();bindSourceLookups();};
 $('#admin-source-kind').onchange=()=>{cancelSourceLookups(editor);clearSourceEditorAutoFields();$('#admin-profile-value').value='';$('#admin-source-query').value='';clearSourceLookupState($('#admin-source-query'));clearSourceLookupState($('#admin-profile-value'));$('#admin-feed-choice-field').hidden=true;sourceDiscoveryMessage($('#admin-source-verification'),'');configureSourceEditor($('#admin-source-kind').value);};
 document.querySelectorAll('[data-source-kind]').forEach(button=>button.onclick=()=>{const select=$('#admin-source-kind');if(select.disabled)return;select.value=button.dataset.sourceKind;select.dispatchEvent(new Event('change'));$('#admin-source-query').focus();});
 for(const selector of ['#admin-url','#admin-home','#admin-profile-value'])$(selector).addEventListener('input',invalidateSourceEditorManualChange);
 $('#admin-cancel').addEventListener('click',()=>cancelSourceLookups(editor));$('#admin-dialog').addEventListener('close',()=>cancelSourceLookups());
 $('#admin-verify-url').onclick=()=>{const record=sourceLookupBindings.get($('#admin-source-query')),url=sourceCandidateUrl('site',$('#admin-url').value||$('#admin-home').value);if(url)record.verify(url,{url,name:$('#admin-name').value});else sourceDiscoveryMessage($('#admin-source-verification'),'Indiquez une adresse publique HTTPS à vérifier.','error');};
 $('#admin-verify-profile').onclick=()=>{const platform=$('#admin-source-kind').value,record=sourceLookupBindings.get($('#admin-source-query')),url=sourceCandidateUrl(platform,$('#admin-profile-value').value);if(url)record.verify(url,{url,name:$('#admin-name').value});else sourceDiscoveryMessage($('#admin-source-verification'),'Indiquez un identifiant X ou une adresse LinkedIn /in/ valide.','error');};
 const submitSite=editor.onsubmit;editor.onsubmit=async event=>{
  event.preventDefault();if(sourceEditorSaving||adminBusy)return;
  const add=$('#admin-add'),save=$('#admin-source-save'),addWasDisabled=add.disabled;sourceEditorSaving=true;add.disabled=true;save.disabled=true;editor.setAttribute('aria-busy','true');
  try{
  const platform=$('#admin-source-kind').value;if(platform==='site')return await submitSite(event);
  if(adminState?.role!=='admin'){adminStatus('L’enregistrement de profils sociaux exige le rôle administrateur.',true);return;}
  const name=$('#admin-name').value.trim(),value=$('#admin-profile-value').value.trim(),handle=platform==='x'?sourceXHandle(value):null,linkedin=platform==='linkedin'?sourceLinkedInUrl(value):null;
  if(!name||name.length>120||platform==='x'&&!handle||platform==='linkedin'&&!linkedin){adminStatus('Indiquez un nom et un identifiant X ou une adresse LinkedIn /in/ valide.',true);return;}
  const profiles=sourceProfileDrafts();if(profiles.length>=30){adminStatus('Le suivi est limité à 30 profils. Modifiez un profil existant.',true);return;}
  if(profiles.some(profile=>platform==='x'&&String(profile.x||'').toLowerCase()===handle.toLowerCase()||platform==='linkedin'&&sourceLinkedInUrl(profile.linkedin)?.toLowerCase()===linkedin.toLowerCase())){adminStatus('Ce profil est déjà dans les comptes suivis. Modifiez sa ligne existante.',true);return;}
  const profile={id:'profile-'+crypto.randomUUID(),name,x:handle,linkedin,enabled:$('#admin-enabled').checked,priority:0},xHours=$('#social-x-hours'),liHours=$('#social-li-hours'),socialSchedule=xHours&&liHours?{xHours:Number(xHours.value),linkedinHours:Number(liHours.value)}:adminState.configuration?.socialSchedule;
  if(await adminCommand({action:'profiles',profiles:[...profiles,profile],...(socialSchedule?{socialSchedule}:{})})){editor.hidden=true;cancelSourceLookups(editor);}
  }finally{sourceEditorSaving=false;add.disabled=addWasDisabled;save.disabled=$('#admin-source-kind').value!=='site'&&adminState?.role!=='admin';editor.setAttribute('aria-busy','false');}
 };
 bindSourceLookups();
}
bindSourceDiscovery();
`;
// The feed does not need the administration autocomplete code on first load.
// A nonce permits this same-origin, versioned script under the page's CSP.
export const SOURCE_DISCOVERY_LOADER=String.raw`
let sourceDiscoveryLoad=null;
function loadSourceDiscovery(){
 if(typeof bindSourceDiscovery==='function')return Promise.resolve();
 if(sourceDiscoveryLoad)return sourceDiscoveryLoad;
 sourceDiscoveryLoad=new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src='/assets/source-discovery-2026-11-02.1.js';script.nonce=document.querySelector('script[nonce]')?.nonce||'';
  const timer=setTimeout(()=>{script.remove();reject(Error('Le chargement de la recherche a dépassé son délai.'));},15000);
  script.onload=()=>{clearTimeout(timer);if(typeof bindSourceDiscovery==='function')resolve();else reject(Error('La recherche n’a pas pu être initialisée.'));};
  script.onerror=()=>{clearTimeout(timer);script.remove();reject(Error('La recherche n’a pas pu être chargée.'));};document.head.append(script);
 }).catch(error=>{sourceDiscoveryLoad=null;throw error;});return sourceDiscoveryLoad;
}
const openAdminWithDiscovery=$('#admin-open')?.onclick;
if(openAdminWithDiscovery)$('#admin-open').onclick=async event=>{
 const add=$('#admin-add');if(add)add.disabled=true;
 try{const results=await Promise.allSettled([openAdminWithDiscovery(event),loadSourceDiscovery()]);const failed=results.find(result=>result.status==='rejected');if(failed)throw failed.reason;}
 catch(error){adminStatus(error.message+' Fermez puis rouvrez l’administration pour réessayer.',true);}
 finally{if(add)add.disabled=typeof bindSourceDiscovery!=='function';}
};
`;
