import {writeFile} from 'node:fs/promises';
import worker from '../worker/index.js';
let page=await (await worker.fetch(new Request('https://preview.local/'),{},{})).text();
page=page.replace("fetch('/api/status').then", "Promise.resolve(new Response(JSON.stringify({ai:false}))).then");
page=page.replace(";load();setInterval", ";demo();setInterval");
await writeFile('/workspace/cyberveille-apercu.html',page);
console.log('Aperçu autonome exporté.');
