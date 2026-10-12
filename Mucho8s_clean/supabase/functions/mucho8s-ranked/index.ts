import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const origins = new Set(["https://aisharhy.github.io","http://localhost:3000","http://127.0.0.1:3000"]);
const json = (req: Request, value: unknown, status = 200) => {
  const origin = req.headers.get("origin") || "";
  return new Response(JSON.stringify(value), {status,headers:{
    "Content-Type":"application/json","Cache-Control":"no-store",
    "Access-Control-Allow-Origin":origins.has(origin)?origin:"https://aisharhy.github.io",
    "Access-Control-Allow-Headers":"content-type,apikey,authorization",
    "Access-Control-Allow-Methods":"POST,OPTIONS","Vary":"Origin"
  }});
};
const fail = (req:Request,message:string,status=400)=>json(req,{error:message},status);
const validMode=(value:unknown)=>["snd","hp","mixed"].includes(String(value));

Deno.serve(async (req:Request)=>{
 if(req.method==="OPTIONS") return json(req,{ok:true});
 if(req.method!=="POST")return fail(req,"Method not allowed",405);
 try {
  const url=Deno.env.get("SUPABASE_URL");
  const secrets=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}");
  const key=secrets.default||Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!key)throw Error("Server not configured");
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const token=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"").trim();
  if(!token)return fail(req,"Discord login required",401);
  const {data:verified,error:authError}=await db.auth.getUser(token);
  if(authError||!verified.user)return fail(req,"Invalid session",401);
  const {data:account,error:accountError}=await db.from("player_accounts")
    .select("id,player_id,player_request_status").eq("id",verified.user.id).maybeSingle();
  if(accountError)throw accountError;
  if(!account?.player_id)return fail(req,"Linked player required",403);
  const {data:app,error:appError}=await db.from("app_state").select("players").eq("id","main").maybeSingle();
  if(appError)throw appError;
  if(!(Array.isArray(app?.players)&&app.players.some((p:any)=>String(p?.id)===account.player_id)))return fail(req,"Player not found",403);
  const body=await req.json().catch(()=>({}));
  const action=String(body.action||"status");
  const {data:membership,error:membershipError}=await db.from("ranked_lobby_players")
    .select("lobby_id,ready,report").eq("account_id",account.id).order("lobby_id",{ascending:false}).limit(25);
  if(membershipError)throw membershipError;
  let active:any=null, currentMember:any=null;
  for(const member of membership||[]){
    const {data:lobby,error}=await db.from("ranked_lobbies").select("*").eq("id",member.lobby_id).maybeSingle();
    if(error)throw error;
    if(lobby&&["ready","live","disputed"].includes(lobby.status)){active=lobby;currentMember=member;break;}
  }
  if(active&&active.status==="ready"&&new Date(active.ready_deadline).getTime()<Date.now()){
    await db.from("ranked_lobbies").update({status:"cancelled"}).eq("id",active.id).eq("status","ready");
    active=null;currentMember=null;
  }
  if(action==="join"){
    if(active)return fail(req,"Finish your current Ranked lobby first",409);
    const mode=String(body.mode||"snd");
    if(!validMode(mode))return fail(req,"Invalid playlist");
    const {data:previous,error:queueError}=await db.from("ranked_queue")
       .select("account_id,mode").eq("account_id",account.id).maybeSingle();
    if(queueError)throw queueError;
    if(previous)return fail(req,"Already queued",409);
    const {error:insertError}=await db.from("ranked_queue")
      .insert({account_id:account.id,player_id:account.player_id,mode});
    if(insertError)return fail(req,"Unable to join queue",409);
  } else if(action==="leave"){
    const {error}=await db.from("ranked_queue").delete().eq("account_id",account.id);
    if(error)throw error;
  } else if(action==="ready"){
    if(!active||active.status!=="ready")return fail(req,"No pending ready check",409);
    const {error}=await db.from("ranked_lobby_players").update({ready:body.ready===true})
      .eq("lobby_id",active.id).eq("account_id",account.id);
    if(error)throw error;
    const {data:members,error:membersError}=await db.from("ranked_lobby_players").select("ready").eq("lobby_id",active.id);
    if(membersError)throw membersError;
    if(members?.length===8&&members.every((m:any)=>m.ready===true)){
      await db.from("ranked_lobbies").update({status:"live"}).eq("id",active.id).eq("status","ready");
    }
  } else if(action==="report"){
    if(!active||!["live","disputed"].includes(active.status))return fail(req,"No live match",409);
    if(!["A","B"].includes(body.winner))return fail(req,"Invalid winner");
    const {error}=await db.from("ranked_lobby_players").update({report:body.winner})
      .eq("lobby_id",active.id).eq("account_id",account.id);
    if(error)throw error;
    const {data:reports,error:reportError}=await db.from("ranked_lobby_players").select("report").eq("lobby_id",active.id);
    if(reportError)throw reportError;
    if(reports?.length===8&&reports.every((m:any)=>m.report===body.winner)){
      const {error:finalError}=await db.rpc("ranked_finalize",{p_lobby_id:active.id});
      if(finalError)throw finalError;
    } else if((reports||[]).some((m:any)=>m.report==="A")&&(reports||[]).some((m:any)=>m.report==="B")){
      await db.from("ranked_lobbies").update({status:"disputed"}).eq("id",active.id).in("status",["live","disputed"]);
    }
  } else if(action!=="status")return fail(req,"Unknown action");
  const {data:queue,error:qError}=await db.from("ranked_queue").select("mode,joined_at").eq("account_id",account.id).maybeSingle();
  if(qError)throw qError;
  // Match assembly can be triggered by each authenticated poll. Database serializes per playlist.
  if(queue?.mode){
    const {error}=await db.rpc("ranked_find_match",{p_mode:queue.mode});
    if(error)throw error;
  }
  const {data:activeMembers,error:membersError}=await db.from("ranked_lobby_players")
    .select("lobby_id,ready,report").eq("account_id",account.id).limit(30);
  if(membersError)throw membersError;
  let lobby:any=null, member:any=null,players:any[]=[];
  for(const entry of activeMembers||[]){
    const {data:row,error}=await db.from("ranked_lobbies").select("*").eq("id",entry.lobby_id).maybeSingle();
    if(error)throw error;
    if(row&&["ready","live","disputed"].includes(row.status)){
      lobby=row;member=entry;break;
    }
  }
  if(lobby){
    const {data:rows,error}=await db.from("ranked_lobby_players").select("player_id,ready,report").eq("lobby_id",lobby.id);
    if(error)throw error;
    players=rows||[];
  }
  const {data:finalQueue}=await db.from("ranked_queue").select("mode,joined_at").eq("account_id",account.id).maybeSingle();
  const {count}=await db.from("ranked_queue").select("*",{head:true,count:"exact"}).eq("mode",finalQueue?.mode||lobby?.mode||"snd");
  return json(req,{ok:true,queue:finalQueue,lobby,member,players,queuedPlayers:count||0,playerId:account.player_id});
 }catch(error){console.error("ranked",error);return fail(req,"Ranked service unavailable",500);}
});
