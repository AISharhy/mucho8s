const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const {webcrypto}=require('node:crypto');
const cases={
 'mucho8s-write':{players:[],matches:[]},
 'mucho8s-account':{action:'admin-link',accountId:'victim',playerId:'victim'},
 'mucho8s-content':{action:'create',title:'attack',summary:'attack'},
 'mucho8s-discord':{action:'config'},
 'mucho8s-wallet':{action:'admin_review',id:'00000000-0000-0000-0000-000000000000',decision:'completed'},
 'mucho8s-teams':{action:'create',name:'attack'},
 'mucho8s-ranked':{action:'join',mode:'hp'},
 'mucho8s-tourney':{action:'save',state:{}},
 'mucho8s-match-reports':{action:'admin-resolve',id:'00000000-0000-0000-0000-000000000000',decision:'confirm'},
 'mucho8s-challenges':{action:'admin-create-pairings',pairings:[]},
};
for(const [endpoint,body] of Object.entries(cases)) test(`${endpoint}: forged credentials cannot reach database mutations`,async()=>{
 let handler,mutations=0;
 const fail=()=>{mutations++;throw Error('Unexpected database mutation');};
 const db={auth:{getUser:async()=>({data:{user:null},error:Error('Invalid token')})},rpc:fail,from(table){
  const chain={select(){return chain;},eq(){return chain;},maybeSingle:async()=>({data:table==='team_match_reports'?{id:'report',status:'pending',team_a:[],team_b:[]}:null,error:null}),
   update:fail,insert:fail,upsert:fail,delete:fail};return chain;
 }};
 const source=fs.readFileSync(path.join(__dirname,'../functions',endpoint,'index.ts'),'utf8').replace(/^import .*\n/gm,'');
 vm.runInNewContext(stripTypeScriptTypes(source),{crypto:webcrypto,TextEncoder,Request,Response,URL,URLSearchParams,atob,btoa,console,
  createClient:()=>db,Deno:{serve(fn){handler=fn;},env:{get:key=>key==='SUPABASE_SECRET_KEYS'?'{}':'configured'}}});
 const response=await handler(new Request('https://test.invalid',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer forged','x-admin-session':'forged','user-agent':'browser'},body:JSON.stringify(body)}));
 assert.ok([401,403].includes(response.status),`${endpoint}: unexpected ${response.status}`);
 assert.equal(mutations,0);
});
