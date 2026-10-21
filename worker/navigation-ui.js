export const NAVIGATION_SCRIPT=String.raw`
// Only display preferences and public article identifiers are stored here.
let linkedEvent=null,pendingLinkedEvent=null;
function readNavigation(value){const p=new URLSearchParams(value||''),candidate={view:p.get('view'),filter:p.get('filter'),query:p.get('q')||'',sort:p.get('sort'),event:p.get('event')};return {view:['dashboard','feed','saved','sources','tutorials'].includes(candidate.view)?candidate.view:'dashboard',filter:types.includes(candidate.filter)?candidate.filter:'Tous',query:candidate.query.slice(0,200),sort:['importance','recent','priority'].includes(candidate.sort)?candidate.sort:'importance',event:candidate.event&&candidate.event.length<=600?candidate.event:null};}
function restoreNavigation(value){const state=readNavigation(value);view=state.view;filter=state.filter;$('#search').value=state.query;$('#sort').value=state.sort;linkedEvent=state.event;pendingLinkedEvent=state.event;}
function rememberNavigation(){try{const p=new URLSearchParams({view,filter,q:$('#search').value.slice(0,200),sort:$('#sort').value});localStorage.setItem('cyberveille-interface',p.toString());if(linkedEvent)p.set('event',linkedEvent);history.replaceState(null,'','#'+p.toString());}catch{}}
const renderBeforeNavigation=render;
render=function(){
 if(typeof priorityRuntime!=='undefined')for(const event of data.events)Object.assign(event,priorityRuntime.assessPriority(event,{technologies:typeof personalState!=='undefined'?personalState?.preferences?.technologies||[]:[]}));
 renderBeforeNavigation();rememberNavigation();
 if(pendingLinkedEvent){const id=pendingLinkedEvent;if(data.events.some(e=>e.id===id)||(typeof personalArchivedEvents==='function'&&personalArchivedEvents().some(e=>e.id===id))){pendingLinkedEvent=null;openDetail(id);}}
};
const openDetailBeforeNavigation=openDetail;
openDetail=function(id){openDetailBeforeNavigation(id);if(!$('#detail').open)return;linkedEvent=id;rememberNavigation();const target=$('#detail-body');if(!target.querySelector('#copy-event-link')){const button=document.createElement('button');button.id='copy-event-link';button.textContent='Copier le lien vers cette fiche';button.onclick=async()=>{try{await navigator.clipboard.writeText(location.href);toast('Lien copié. La connexion Cloudflare reste nécessaire.');}catch{toast('Copiez le lien depuis la barre d’adresse.');}};target.prepend(button);}};
$('#detail').addEventListener('close',()=>{linkedEvent=null;pendingLinkedEvent=null;rememberNavigation();});
document.addEventListener('click',event=>{if(event.target.closest('#close')){linkedEvent=null;pendingLinkedEvent=null;rememberNavigation();}},true);
if(typeof window!=='undefined')window.addEventListener('hashchange',()=>{restoreNavigation(location.hash.slice(1));if(!linkedEvent&&$('#detail').open)$('#detail').close();render();});
try{restoreNavigation(location.hash.length>1?location.hash.slice(1):localStorage.getItem('cyberveille-interface'));}catch{}
`;
