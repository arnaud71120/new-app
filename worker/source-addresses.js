// URL-level controls only: this does not claim to resolve or validate DNS records.
const SECRET=/^(?:access[_-]?token|token|secret|password|pass|api[_-]?key|key|authorization|auth|client[_-]?secret|jwt|session(?:[_-]?id)?|signature|sig|cf[_-]?(?:access|authorization))$/i;
const X_HOSTS=new Set(['x.com','www.x.com','mobile.x.com','twitter.com','www.twitter.com','mobile.twitter.com']);
const X_RESERVED=new Set(['home','login','logout','signup','search','explore','notifications','messages','settings','compose','intent','i','share','tos','privacy','about','help','hashtag','jobs','download','premium','communities']);
export function publicSourceURL(value){
 if(typeof value!=='string'||value.length>2048||/[\\\u0000-\u0020]/.test(value))throw Error('Adresse HTTPS publique invalide.');let url;try{url=new URL(value);}catch{throw Error('Adresse HTTPS publique invalide.');}
 url.hostname=url.hostname.toLowerCase().replace(/\.+$/,'');const hostname=url.hostname,labels=hostname.split('.');
 if(url.protocol!=='https:'||url.username||url.password||url.port||!hostname.includes('.')||hostname.length>253||hostname.includes(':')||labels.some(label=>!label||label.length>63||!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label))||labels.some(label=>['localhost','local','localdomain','internal','private','intranet','lan','home','invalid','test','example','metadata','instance-data'].includes(label))||/(?:^|\.)\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(?:\.|$)/.test(hostname)||/^\d+(?:\.\d+)*$/.test(hostname)||/(?:^|\.)(?:nip\.io|sslip\.io|xip\.io|lvh\.me|localtest\.me|localhost\.direct|vcap\.me)$/.test(hostname)||[...url.searchParams.keys()].some(key=>SECRET.test(key)))throw Error('Utilisez une adresse HTTPS publique sans identifiant ni paramètre secret.');
 url.hash='';return url.href;
}
export function isSocialHost(platform,hostname){hostname=hostname.toLowerCase();return platform==='x'?X_HOSTS.has(hostname):platform==='linkedin'?(hostname==='linkedin.com'||hostname==='www.linkedin.com'||/^[a-z]{2,3}\.linkedin\.com$/.test(hostname)):false;}
/** Canonical address only; it makes no statement about existence or collection. */
export function normalizeSourceURL(platform,value){
 if(typeof value!=='string')throw Error('Adresse de source invalide.');value=value.trim();
 if(platform==='x'&&/^@?[a-z0-9_]{1,15}$/i.test(value)){const handle=value.replace(/^@/,'').toLowerCase();if(X_RESERVED.has(handle))throw Error('Utilisez l’adresse d’un profil X.');return 'https://x.com/'+handle;}
 if(platform==='site'&&!/^[a-z][a-z0-9+.-]*:/i.test(value)&&/^[a-z0-9.-]+\.[a-z]{2,63}(?:[/?#].*)?$/i.test(value))value='https://'+value;
 const normalized=publicSourceURL(value),url=new URL(normalized);
 if(platform==='site')return normalized;
 if(!isSocialHost(platform,url.hostname)||/%(?:2f|5c|00|0a|0d)/i.test(url.pathname))throw Error('L’adresse doit désigner un profil de cette plateforme.');
 if(platform==='x'){const match=url.pathname.match(/^\/([a-z0-9_]{1,15})\/?$/i);if(!match||X_RESERVED.has(match[1].toLowerCase()))throw Error('Utilisez un profil X, sans recherche, publication ou page de connexion.');return 'https://x.com/'+match[1].toLowerCase();}
 if(platform==='linkedin'){let slug;const match=url.pathname.match(/^\/in\/([^/]+)\/?$/i);try{slug=match&&decodeURIComponent(match[1]);}catch{}if(!slug||slug.length>200||!/^[\p{L}\p{N}][\p{L}\p{N}_-]*$/u.test(slug))throw Error('Utilisez un profil LinkedIn /in/ ; les pages entreprise ne sont pas prises en charge.');return 'https://www.linkedin.com/in/'+encodeURIComponent(slug.toLowerCase())+'/';}
 throw Error('Plateforme inconnue.');
}
