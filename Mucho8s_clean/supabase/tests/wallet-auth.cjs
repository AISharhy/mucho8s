const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {createRequire}=require('node:module');
const {webcrypto,createHash}=require('node:crypto');
const frontendRequire=createRequire(path.resolve(__dirname,'../../frontend/package.json'));
const babel=frontendRequire('@babel/core');
const source=fs.readFileSync(path.resolve(__dirname,'../functions/mucho8s-wallet/index.ts'),'utf8').replace(/^import.*\n/,'');
const code=babel.transformSync(source,{filename:'wallet.ts',configFile:false,babelrc:false,plugins:[frontendRequire.resolve('@babel/plugin-transform-typescript')]}).code;
const digest=value=>createHash('sha256').update(value).digest('hex');

function setup({user={id:'account-a'},approved=true,admin=false,adminAccount='account-a',active=true}={}) {
  const queries=[];const calls=[];let handler;
  const account={id:'account-a',player_id:approved ? 'player-a' : null};
  const records={
    player_accounts:account,
    mucho_wallets:{balance_cents:1000,reserved_cents:200,mode:'demo'},
    mucho_wallet_requests:[],mucho_wallet_transactions:[],
    admin_sessions:admin ? {username:'Admin',account_id:adminAccount,user_agent_hash:digest('unknown'),expires_at:new Date(Date.now()+60000).toISOString(),revoked_at:null} : null,
    admin_credentials:{is_active:active,required_account_id:'account-a'},
    admin_access:{username:'Admin',is_active:active},
  };
  const db={auth:{getUser:async token=>({data:{user:token==='valid-token' ? user : null},error:null})},from(table){
    const query={table,filters:[]};queries.push(query);
    const chain={select(){return chain;},eq(...args){query.filters.push(args);return chain;},order(){return chain;},limit(){return chain;},in(){return chain;},maybeSingle(){return Promise.resolve({data:records[table],error:null});},then(resolve,reject){return Promise.resolve({data:records[table],error:null}).then(resolve,reject);}};
    return chain;
  },rpc:async(name,args)=>{calls.push({name,args});return {data:{id:'test-request',mode:'demo'},error:null};}};
  vm.runInNewContext(code,{createClient:()=>db,crypto:webcrypto,Request,Response,TextEncoder,console:{error(){}},Deno:{env:{get:()=>''},serve(fn){handler=fn;}}});
  const request=async(body,headers={Authorization:'Bearer valid-token'})=>{
    const response=await handler(new Request('https://test.invalid',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:typeof body==='string' ? body : JSON.stringify(body)}));
    return {status:response.status,body:await response.json()};
  };
  return {request,queries,calls};
}

test('missing and invalid credentials cannot read wallet',async()=>{
  const {request,queries}=setup();
  assert.equal((await request({action:'get'},{})).status,401);
  assert.equal((await request({action:'get'},{Authorization:'Bearer bad-token'})).status,401);
  assert.equal(queries.length,0);
});
test('unapproved accounts are denied',async()=>{
  const {request,calls}=setup({approved:false});
  assert.equal((await request({action:'request'})).status,403);assert.equal(calls.length,0);
});
test('wallet reads are scoped to authenticated owner, never body account_id',async()=>{
  const {request,queries}=setup();
  const response=await request({action:'get',account_id:'victim'});
  assert.equal(response.status,200);assert.equal(response.body.mode,'demo');
  for (const query of queries.filter(q=>q.table.startsWith('mucho_wallet'))) assert.deepEqual(query.filters,[['account_id','account-a']]);
});
test('admin operations require matching active admin credentials',async()=>{
  for (const options of [{},{admin:true,adminAccount:'other-account'},{admin:true,active:false}]) {
    const {request,calls}=setup(options);
    assert.equal((await request({action:'admin_review',id:'00000000-0000-4000-8000-000000000001',decision:'completed'},{Authorization:'Bearer valid-token','X-Admin-Session':'admin-token'})).status,403);
    assert.equal(calls.length,0);
  }
});
test('request rejects fractional cents, invalid providers and malformed keys',async()=>{
  const payload={action:'request',key:'00000000-0000-4000-8000-000000000001',kind:'deposit',provider:'paypal',amount_cents:1000,destination:'Test account'};
  const {request,calls}=setup();
  for(const change of [{amount_cents:100.5},{amount_cents:0},{provider:'other'},{key:'bad'}]) assert.equal((await request({...payload,...change})).status,400);
  assert.equal(calls.length,0);
  assert.equal((await request({...payload,account_id:'victim'})).status,200);
  assert.equal(calls[0].args.p_account_id,'account-a');
});
test('cancellation passes authenticated owner to atomic database operation',async()=>{
  const {request,calls}=setup();
  assert.equal((await request({action:'cancel',id:'00000000-0000-4000-8000-000000000001',owner:'victim'})).status,200);
  assert.equal(calls[0].args.p_owner,'account-a');assert.equal(calls[0].args.p_decision,'cancelled');
});
test('active matching admin can review a demo request',async()=>{
  const {request,calls}=setup({admin:true});
  assert.equal((await request({action:'admin_review',id:'00000000-0000-4000-8000-000000000001',decision:'completed'},{Authorization:'Bearer valid-token','X-Admin-Session':'admin-token'})).status,200);
  assert.equal(calls[0].args.p_actor,'Admin');
});
test('unknown actions, bad JSON and foreign origins are rejected',async()=>{
  const {request}=setup();
  assert.equal((await request({action:'enable_real_payments'})).status,400);
  assert.equal((await request('bad-json')).status,400);
  assert.equal((await request({action:'get'},{Authorization:'Bearer valid-token',Origin:'https://foreign.invalid'})).status,403);
});
test('amount parser uses exact cents and rejects ambiguous inputs',()=>{
  const wallet=fs.readFileSync(path.resolve(__dirname,'../../frontend/src/lib/wallet.js'),'utf8');
  const snippet=wallet.slice(wallet.indexOf('export function parseWalletAmount'),wallet.indexOf('export async function walletRequest')).replace('export function','function')+'\nparseWalletAmount;';
  const parse=vm.runInNewContext(snippet);
  assert.equal(parse('10,25'),1025);assert.equal(parse('1.01'),101);assert.equal(parse('1000'),100000);
  for(const value of ['0','-2','1e3','1.005','1.000,00','1001','']) assert.throws(()=>parse(value));
});
