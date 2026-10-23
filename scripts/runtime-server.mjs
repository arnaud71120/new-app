import {Miniflare} from 'miniflare';
export const token='local-runtime-test-owner-token-2026';
export async function runtime(port=0,options={}){const {bindings={},...overrides}=options;const mf=new Miniflare({modules:true,scriptPath:'dist/server/index.js',compatibilityDate:'2026-08-06',port,durableObjects:{SOCIAL_STORE:{className:'SocialStore',useSQLite:true}},...overrides,bindings:{APP_ACCESS_TOKEN:token,EXTERNAL_CALLS_PAUSED:'true',...bindings}});await mf.ready;return mf;}
if(process.argv.includes('--serve')){const mf=await runtime(4173);console.log('Runtime prêt : '+await mf.ready);for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await mf.dispose();process.exit();});}
