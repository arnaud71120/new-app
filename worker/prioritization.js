// Relative reading priority. These signals never establish the truth of an incident.
const fold=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const unique=values=>[...new Set(values.filter(Boolean))];
const cvesOf=event=>unique([...(event.cves||[]),...(event.articles||[]).flatMap(article=>article.cves||[])].map(value=>String(value).toUpperCase()).filter(value=>/^CVE-\d{4}-\d{4,}$/.test(value)));
const articleList=event=>Array.isArray(event.articles)&&event.articles.length?event.articles:[event];
const eventText=event=>fold([event.title,event.summary,...articleList(event).flatMap(article=>[article.title,article.summary])].join(' '));
const publicURL=value=>{try{const url=new URL(value);return ['http:','https:'].includes(url.protocol)&&!url.username&&!url.password?url:null;}catch{return null;}};
function officialKEV(article){const url=publicURL(article.url);return article.knownExploited===true&&article.sourceId==='kev'&&url&&/^(www\.)?cisa\.gov$/.test(url.hostname)&&url.pathname.startsWith('/known-exploited-vulnerabilities-catalog');}
function matchesTerm(text,term){const normalized=fold(term).trim();if(!normalized)return false;const escaped=normalized.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');return new RegExp('(?:^|[^\\p{L}\\p{N}])'+escaped+'(?=$|[^\\p{L}\\p{N}])','u').test(text);}

export function assessPriority(event,preferences={}){
 const articles=articleList(event),text=eventText(event),signals=[],reasons=['Indice de lecture relatif : 20 points ; ne mesure pas le risque de votre système.'];let value=20;
 const kev=articles.filter(officialKEV);
 if(kev.length){value+=55;reasons.push('Présence dans le catalogue officiel CISA KEV : +55.');for(const article of kev)signals.push({kind:'known_exploitation',status:'official_catalogue',label:'Exploitation connue selon CISA KEV',url:article.url});}
 const scored=articles.filter(article=>typeof article.cvss==='number'&&Number.isFinite(article.cvss)&&article.cvss>0&&article.cvss<=10),cvss=scored.length?Math.max(...scored.map(article=>article.cvss)):null;
 if(cvss!==null){const points=cvss>=9?20:cvss>=7?12:cvss>=4?5:0;value+=points;reasons.push('CVSS publié '+cvss+' : +'+points+' ; sévérité technique, pas une preuve d’exploitation.');for(const article of scored.filter(article=>article.cvss===cvss))signals.push({kind:'cvss',status:'reported_score',label:'Score CVSS publié',value:cvss,url:article.url});}
 if(/exploitation active|activement exploit|actively exploit|zero[ .-]day|0[ .-]day/.test(text)&&!kev.length){signals.push({kind:'exploitation_mention',status:'unverified',label:'Exploitation ou zero-day évoqué dans le texte ; non confirmé par CISA KEV',url:event.url||articles[0]?.url||null});reasons.push('Mention textuelle d’exploitation : pas de confirmation ajoutée ni de bonus KEV.');}
 if(cvesOf(event).length){value+=5;reasons.push('Identifiant CVE exploitable pour la recherche : +5.');}
 const technologies=unique((Array.isArray(preferences.technologies)?preferences.technologies:[]).filter(term=>typeof term==='string'&&term.trim().length>=2&&term.length<=100).map(term=>term.trim())).slice(0,50),matched=technologies.filter(term=>matchesTerm(text,term));
 if(matched.length){value+=15;reasons.push('Technologie choisie retrouvée dans le texte : '+matched.join(', ')+' : +15 ; applicabilité à vérifier.');signals.push(...matched.map(term=>({kind:'technology',status:'text_match',label:term,url:event.url||articles[0]?.url||null})));}
 return {priorityScore:Math.min(100,value),priorityReasons:reasons,prioritySignals:signals,priorityTechnologies:matched,priorityConfirmedExploitation:!!kev.length,priorityCVSS:cvss,priorityLabel:'Priorité relative de lecture'};
}
export function prioritizeEvents(events,preferences={}){return events.map(event=>({...event,...assessPriority(event,preferences)})).sort((a,b)=>b.priorityScore-a.priorityScore||(b.date||'').localeCompare(a.date||''));}

// Only tracking parameters are removed. Functional parameters can identify a document.
export function canonicalDocumentURL(value){const url=publicURL(value);if(!url)return null;url.hostname=url.hostname.toLowerCase().replace(/\.+$/,'');url.hash='';for(const key of [...url.searchParams.keys()])if(/^utm_/i.test(key)||/^(fbclid|gclid|mc_cid|mc_eid)$/i.test(key))url.searchParams.delete(key);url.searchParams.sort();if(url.pathname==='/'&&!url.search)return null;return url.href;}
const STOP=new Set(('avec dans pour sans chez sur sous puis apres avant cette celui celle leur leurs plus moins sont sera etre avoir tous toute toutes une des les aux par que qui quoi dont est son ses notre votre vos nos the and from with without this that those these their into over after before was were will have has been are security cybersecurity cybersecurite cyberattack cyberattaque attaque attaques attack attacks incident incidents vulnerability vulnerabilities vulnerabilite vulnerabilites faille failles critical critique critiques nouveau nouvelle nouveaux nouvelles microsoft windows fortinet cisco update updates patch patches correctif correctifs').split(' '));
function titleWords(event){return new Set(fold(event.title).replace(/cve-\d{4}-\d{4,}/g,' ').match(/[\p{L}\p{N}]+/gu)?.filter(word=>word.length>=4&&!STOP.has(word))||[]);}
function primaryURLs(event){return unique(articleList(event).map(article=>canonicalDocumentURL(article.url)));}
function compatibleCVE(a,b){const left=cvesOf(a),right=cvesOf(b);return !left.length||!right.length||left.length===right.length&&left.every(value=>right.includes(value));}
function nearDuplicate(first,other,left,right){if(!compatibleCVE(first,other))return false;const a=Date.parse(first.date),b=Date.parse(other.date);if(!Number.isFinite(a)||!Number.isFinite(b)||Math.abs(a-b)>3*86400000)return false;const overlap=[...left].filter(word=>right.has(word)).length;return overlap>=4&&overlap/(left.size+right.size-overlap)>=.8;}
function mergedEvent(first,other,evidence){const articles=new Map();for(const article of [...articleList(first),...articleList(other)]){const key=canonicalDocumentURL(article.url)||article.url||JSON.stringify([article.title,article.date]);if(!articles.has(key))articles.set(key,article);else{const prior=articles.get(key),preferred=officialKEV(article)&&!officialKEV(prior)?article:prior;articles.set(key,{...preferred,cves:unique([...(prior.cves||[]),...(article.cves||[])]),references:unique([...(prior.references||[]),...(article.references||[])])});}}const dates=[first.date,other.date].filter(value=>Number.isFinite(Date.parse(value))).sort();return {...first,articles:[...articles.values()],score:Math.max(Number(first.score)||0,Number(other.score)||0),date:dates.at(-1)||first.date||other.date||null,cves:unique([...cvesOf(first),...cvesOf(other)]),references:unique([...(first.references||[]),...(other.references||[])]),groupingEvidence:[...(first.groupingEvidence||[]),...(other.groupingEvidence||[]),evidence],groupingNotice:'Regroupement documentaire ; les publications ne constituent pas automatiquement des confirmations indépendantes.'};}

export function groupRelatedEvents(events){
 const groups=[],words=[],urls=new Map(),wordIndex=new Map();
 for(const event of events){const eventURLs=primaryURLs(event),tokens=titleWords(event),counts=new Map();let target=null,evidence=null;
  for(const url of eventURLs)if(urls.has(url)&&compatibleCVE(groups[urls.get(url)],event)){target=urls.get(url);evidence={kind:'same_publication',url,label:'Même URL de publication après retrait des paramètres de suivi'};break;}
  if(target===null){for(const word of tokens)for(const index of wordIndex.get(word)||[])counts.set(index,(counts.get(index)||0)+1);const candidates=[...counts].filter(([,count])=>count>=4).sort((a,b)=>b[1]-a[1]).slice(0,64);for(const [index] of candidates)if(nearDuplicate(groups[index],event,words[index],tokens)){target=index;evidence={kind:'near_identical_titles',label:'Titres très proches, dates distantes de moins de 72 heures et CVE compatibles'};break;}}
  if(target===null){target=groups.length;groups.push({...event});words.push(tokens);for(const word of tokens){if(!wordIndex.has(word))wordIndex.set(word,new Set());wordIndex.get(word).add(target);}}
  else groups[target]=mergedEvent(groups[target],event,evidence);
  for(const url of eventURLs)urls.set(url,target);
 }
 return groups;
}

// Embed this same implementation in the static client without leaking helper names.
export function priorityRuntimeSource(){
 const arrows={fold,unique,cvesOf,articleList,eventText,publicURL};
 const constants=Object.entries(arrows).map(([name,fn])=>'const '+name+'='+fn.toString()+';').join('\n');
 const functions=[officialKEV,matchesTerm,assessPriority,canonicalDocumentURL,titleWords,primaryURLs,compatibleCVE,nearDuplicate,mergedEvent,groupRelatedEvents].map(fn=>fn.toString()).join('\n');
 return 'function(){\n'+constants+'\nconst STOP=new Set('+JSON.stringify([...STOP])+');\n'+functions+'\nreturn {assessPriority,groupRelatedEvents};\n}';
}
