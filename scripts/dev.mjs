import http from 'node:http';
import worker from '../worker/index.js';
const port = Number(process.env.PORT || 3000);
http.createServer(async (req,res)=>{try {const chunks=[];for await(const c of req) chunks.push(c);const response=await worker.fetch(new Request('http://localhost:'+port+req.url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})}), {OPENAI_API_KEY:process.env.OPENAI_API_KEY}, {});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}catch{res.writeHead(500);res.end('Erreur serveur');}}).listen(port,'0.0.0.0',()=>console.log('Cyberveille : http://localhost:'+port));
