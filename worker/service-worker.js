// Cache only the public application shell and educational catalogue. Never /api/*.
const VERSION='cyberveille-public-v1';
self.addEventListener('install',event=>event.waitUntil((async()=>{const r=await fetch('/',{cache:'reload'});if(r.ok&&r.headers.get('X-Cyberveille-Version')){const cache=await caches.open(VERSION);await cache.put('/',r);}})()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{const u=new URL(event.request.url);if(u.origin!==self.location.origin||event.request.method!=='GET'||u.pathname.startsWith('/api/'))return;
 if(event.request.mode==='navigate')event.respondWith((async()=>{try{const r=await fetch(event.request);if(r.ok&&r.headers.get('X-Cyberveille-Version')){const c=await caches.open(VERSION);await c.put('/',r.clone());}return r;}catch{const cache=await caches.open(VERSION);return await cache.match('/')||new Response('Cyberveille nécessite une première ouverture en ligne.',{status:503});}})());
 if(u.pathname==='/assets/learning-2026-10-20.json')event.respondWith((async()=>{const cache=await caches.open(VERSION),saved=await cache.match(event.request);if(saved)return saved;return fetch(event.request);})());
});
self.addEventListener('message',event=>{if(event.data?.type==='clear-private')event.waitUntil(caches.delete(VERSION));});

// The push carries no private payload; the signed-in app shows the details.
self.addEventListener('push',event=>event.waitUntil(self.registration.showNotification('Cyberveille',{body:'De nouveaux éléments de veille vous attendent. Ouvrez Cyberveille pour les consulter.',tag:'cyberveille-server',data:{url:'/'}})));
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil((async()=>{for(const client of await self.clients.matchAll({type:'window',includeUncontrolled:true}))if(new URL(client.url).origin===self.location.origin){await client.focus();return;}await self.clients.openWindow('/');})());});
