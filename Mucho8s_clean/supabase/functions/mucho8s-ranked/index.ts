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
const validMode=(value:unknown)=>String(value)==="hp";

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
    .select("id,player_id,player_request_status,created_at").eq("id",verified.user.id).maybeSingle();
  if(accountError)throw accountError;
  if(!account?.player_id)return fail(req,"Linked player required",403);
  // Accounts linked before the approval workflow launched remain eligible.
  // New members must have explicit Circle approval; never trust client metadata.
  const legacyCutoff=Date.parse("2026-09-28T18:00:00Z");
  const joinedAt=Date.parse(String(account.created_at||""));
  const isLegacyMember=account.player_request_status==null &&
    Number.isFinite(joinedAt) && joinedAt<legacyCutoff;
  if(account.player_request_status!=="approved"&&!isLegacyMember)
    return fail(req,"Circle Mucho8s approval required",403);
  const {data:app,error:appError}=await db.from("app_state").select("players").eq("id","main").maybeSingle();
  if(appError)throw appError;
  if(!(Array.isArray(app?.players)&&app.players.some((p:any)=>String(p?.id)===account.player_id)))return fail(req,"Player not found",403);
  const body=await req.json().catch(()=>({}));
  const action=String(body.action||"status");
  const {data:result,error}=await db.rpc("ranked_v2_action",{p_account_id:account.id,p_action:action,p_payload:body});
  if(error)return fail(req,error.message||"Ranked action failed",409);
  return json(req,result);
 }catch(error){console.error("ranked",error);return fail(req,"Ranked service unavailable",500);}
});
