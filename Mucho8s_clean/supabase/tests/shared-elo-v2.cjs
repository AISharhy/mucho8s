const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {stripTypeScriptTypes}=require('node:module');
const {webcrypto}=require('node:crypto');
function harness(failFirst=false){
 const ids=Array.from({length:8},(_,i)=>`player-${i}`),a=ids.slice(0,4),b=ids.slice(4);
 let state={version:1,players:ids.map(id=>({id,name:id,currentElo:1000,peakElo:1000,wins:0,losses:0,totalMatches:0,mvpCount:0,merdaCount:0,currentStreak:0,last10:[],eloHistory:[{match:0,elo:1000}]})),matches:[]};
 const report={id:'report',match_id:'match',team_a:a,team_b:b,winner:'A',score_a:1,score_b:0,pairings:[],maps:['Den'],map_results:[{map:'Den',winner:'A'}],game:'BO7',mode:'Hardpoint',season_number:2,played_at:'2026-10-12T12:00:00Z'};
 let attempts=0,commits=0;
 const db={rpc:async(name,payload)=>{assert.equal(name,'commit_match_state');attempts++;if(failFirst&&attempts===1)return {data:false,error:null};state={version:state.version+1,players:structuredClone(payload.p_players),matches:structuredClone(payload.p_matches)};commits++;return{data:true,error:null};},from(table){let data=table==='app_state'?structuredClone(state):null;const chain={select(){return chain;},eq(){return chain;},is(){return chain;},update(payload){data={...report,...payload};return chain;},insert(){return Promise.resolve({error:null});},maybeSingle:async()=>({data:table==='ranked_lobbies'?{id:'ranked-lobby'}:data,error:null}),single:async()=>({data,error:null}),then(resolve){return Promise.resolve({data,error:null}).then(resolve);}};return chain;}};
 const source=fs.readFileSync(path.join(__dirname,'../functions/mucho8s-match-reports/index.ts'),'utf8').replace(/^import .*\n/gm,'');
 const context={Deno:{serve(){}},crypto:webcrypto,TextEncoder,Request,Response,URL,console};
 vm.runInNewContext(stripTypeScriptTypes(source)+'\nglobalThis.finalize = finalizeReport;',context);
 return {run:()=>context.finalize(db,report,'opponent-account',b[0],'claim'),state:()=>state,counts:()=>({attempts,commits}),a,b};
}
test('Ranked uses shared 8s +25/-15 rules and records actual Elo snapshots without earnings',async()=>{
 const h=harness();await h.run();for(const p of h.state().players){assert.equal(p.currentElo,h.a.includes(p.id)?1025:985);assert.equal(p.totalMatches,1);}
 const m=h.state().matches[0];assert.equal(m.source,'mucho-ranked');assert.equal(m.eloBefore[h.a[0]],1000);assert.equal(m.eloAfter[h.a[0]],1025);assert.equal(m.eloAfter[h.b[0]],985);assert.equal(m.pairings.length,0);
});
test('retry after concurrent version change applies a result exactly once',async()=>{
 const h=harness(true);await h.run();assert.deepEqual(h.counts(),{attempts:2,commits:1});assert.equal(h.state().matches.length,1);assert.equal(h.state().players[0].currentElo,1025);
});
test('retrying an already stored verified result never applies Elo again',async()=>{
 const h=harness();await h.run();await h.run();assert.equal(h.counts().commits,1);assert.equal(h.state().matches.length,1);assert.equal(h.state().players[0].currentElo,1025);
});
