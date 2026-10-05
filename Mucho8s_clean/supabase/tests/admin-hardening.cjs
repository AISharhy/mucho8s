const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createRequire}=require('node:module');
const {webcrypto,createHash}=require('node:crypto');
const req=createRequire(path.resolve(__dirname,'../../frontend/package.json'));
const babel=req('@babel/core');
const compile=source=>babel.transformSync(source,{filename:'edge.ts',configFile:false,babelrc:false,plugins:[req.resolve('@babel/plugin-transform-typescript')]}).code;
const source=fs.readFileSync(path.resolve(__dirname,'../functions/mucho8s-tourney/index.ts'),'utf8').replace(/^import.*\n/,'');
const digest=value=>createHash('sha256').update(value).digest('hex');
function setup(overrides={},failedTable=null){
 const records={
 admin_sessions:{username:'Admin',account_id:'account-a',user_agent_hash:digest('browser-a'),expires_at:new Date(Date.now()+60000).toISOString(),revoked_at:null},
 admin_credentials:{is_active:true,required_account_id:'account-a'},
 player_accounts:{player_id:'player-a'},
 admin_access:{is_active:true,username:'Admin'},
 ...overrides};
 const filters=[];
 const db={from(table){const chain={select(){return chain;},eq(key,value){filters.push([table,key,value]);return chain;},maybeSingle:async()=>({data:records[table],error:table===failedTable ? new Error('DB error') : null})};return chain;}};
 const context={crypto:webcrypto,TextEncoder,Request,Response,Deno:{serve(){}},createClient(){}};
 vm.runInNewContext(compile(source)+'\nglobalThis.check=validateAdmin;',context);
 return {check:token=>context.check(new Request('https://test.invalid',{headers:{'x-admin-session':token||'','user-agent':'browser-a'}}),db),filters};
}
test('valid active admin is accepted and lookups bind token, account and player',async()=>{
 const {check,filters}=setup();assert.ok(await check('valid-token'));
 assert.ok(filters.some(f=>f[0]==='admin_sessions'&&f[1]==='token_hash'&&f[2]===digest('valid-token')));
 assert.ok(filters.some(f=>f[0]==='player_accounts'&&f[2]==='account-a'));
 assert.ok(filters.some(f=>f[0]==='admin_access'&&f[2]==='player-a'));
});
test('missing and unknown admin sessions are denied',async()=>{
 const {check,filters}=setup();assert.equal(await check(''),null);assert.equal(filters.length,0);
 assert.equal(await setup({admin_sessions:null}).check('forged-token'),null);
});
test('expired, revoked, malformed and different-browser sessions are denied',async()=>{
 const valid=setup;const base={username:'Admin',account_id:'account-a',user_agent_hash:digest('browser-a'),expires_at:new Date(Date.now()+60000).toISOString(),revoked_at:null};
 for(const change of [{expires_at:new Date(0).toISOString()},{expires_at:'invalid'},{revoked_at:new Date().toISOString()},{user_agent_hash:digest('browser-b')},{account_id:null}]){
 assert.equal(await valid({admin_sessions:{...base,...change}}).check('token'),null);
 }
});
test('disabled credentials and account substitution are denied',async()=>{
 for(const credential of [null,{is_active:false,required_account_id:'account-a'},{is_active:true,required_account_id:'victim'}]){
 assert.equal(await setup({admin_credentials:credential}).check('token'),null);
 }
});
test('removed player approvals and revoked or mismatched admin grants are denied',async()=>{
 for(const records of [{player_accounts:null},{player_accounts:{player_id:null}},{admin_access:null},{admin_access:{is_active:false,username:'Admin'}},{admin_access:{is_active:true,username:'Other'}}]){
 assert.equal(await setup(records).check('token'),null);
 }
});
test('database errors fail closed at every authorization lookup',async()=>{
 for(const table of ['admin_sessions','admin_credentials','player_accounts','admin_access'])assert.equal(await setup({},table).check('token'),null);
});
test('retired importer cannot contact services or change data for any caller',async()=>{
 let handler;const source=fs.readFileSync(path.resolve(__dirname,'../functions/mucho8s-import-emergent/index.ts'),'utf8');
 vm.runInNewContext(compile(source),{Request,Response,Deno:{serve(fn){handler=fn;}},fetch(){throw new Error('Network must not be accessed');},createClient(){throw new Error('Database must not be accessed');}});
 for(const method of ['GET','POST','OPTIONS']){
 const response=await handler(new Request('https://test.invalid',{method,headers:{authorization:'Bearer arbitrary','x-admin-session':'arbitrary'}}));
 assert.equal(response.status,410);
 }
});
