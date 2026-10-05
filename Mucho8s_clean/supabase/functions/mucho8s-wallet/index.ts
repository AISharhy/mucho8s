import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const origins = new Set(["https://aisharhy.github.io", "http://localhost:3000", "http://127.0.0.1:3000"]);
const hash = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))).map(b => b.toString(16).padStart(2,"0")).join("");
const uuid = (value: unknown) => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") || "";
  const headers = {
    "Access-Control-Allow-Origin": origins.has(origin) ? origin : "https://aisharhy.github.io",
    "Access-Control-Allow-Headers": "content-type,apikey,authorization,x-admin-session",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Content-Type": "application/json", "Cache-Control": "no-store", "Vary": "Origin",
  };
  const json = (body: unknown, status=200) => new Response(JSON.stringify(body), {status,headers});
  if (origin && !origins.has(origin)) return json({error:"Origin non consentita"},403);
  if (req.method === "OPTIONS") return new Response(null,{status:204,headers});
  if (req.method !== "POST") return json({error:"Metodo non consentito"},405);
  try {
    const db = createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false,autoRefreshToken:false}});
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i,"");
    if (!token) return json({error:"Accedi con Discord"},401);
    const {data:auth,error:authError} = await db.auth.getUser(token);
    if (authError || !auth.user) return json({error:"Sessione scaduta. Accedi di nuovo."},401);
    const {data:account,error:accountError} = await db.from("player_accounts").select("id,player_id,paypal_url,revolut_url").eq("id",auth.user.id).maybeSingle();
    if (accountError) throw accountError;
    if (!account?.player_id) return json({error:"Il wallet è riservato ai membri approvati del Circle."},403);
    if (Number(req.headers.get("content-length") || 0)>4096) return json({error:"Richiesta troppo grande"},413);
    const raw = await req.text();
    if (raw.length>4096) return json({error:"Richiesta troppo grande"},413);
    let body;
    try { body=JSON.parse(raw); } catch { return json({error:"Richiesta non valida"},400); }
    const action = body?.action;
    let actor = "";
    if (["admin_list","admin_review"].includes(action)) {
      const adminToken = req.headers.get("x-admin-session") || "";
      if (!adminToken) return json({error:"Accesso admin richiesto"},403);
      const {data:session,error:sessionError} = await db.from("admin_sessions").select("username,account_id,user_agent_hash,expires_at,revoked_at").eq("token_hash",await hash(adminToken)).maybeSingle();
      if (sessionError) throw sessionError;
      if (!session || session.revoked_at || session.account_id!==account.id || new Date(session.expires_at).getTime()<=Date.now() || session.user_agent_hash!==await hash(req.headers.get("user-agent") || "unknown")) return json({error:"Sessione admin non valida"},403);
      const {data:credential,error:credentialError} = await db.from("admin_credentials").select("is_active,required_account_id").eq("username",session.username).maybeSingle();
      const {data:access,error:accessError} = await db.from("admin_access").select("username,is_active").eq("player_id",account.player_id).maybeSingle();
      if (credentialError || accessError) throw credentialError || accessError;
      if (!credential?.is_active || credential.required_account_id!==account.id || !access?.is_active || access.username!==session.username) return json({error:"Accesso admin negato"},403);
      actor=session.username;
    }
    if (action === "get") {
      const results = await Promise.all([
        db.from("mucho_wallets").select("balance_cents,reserved_cents,currency,mode").eq("account_id",account.id).maybeSingle(),
        db.from("mucho_wallet_requests").select("*").eq("account_id",account.id).order("created_at",{ascending:false}).limit(100),
        db.from("mucho_wallet_transactions").select("*").eq("account_id",account.id).order("created_at",{ascending:false}).limit(100),
      ]);
      for (const result of results) if (result.error) throw result.error;
      return json({mode:"demo",wallet:results[0].data || {balance_cents:0,reserved_cents:0,currency:"EUR",mode:"demo"},requests:results[1].data,transactions:results[2].data});
    }
    if (action === "request") {
      if (!uuid(body.key) || !["deposit","withdrawal"].includes(body.kind) || !["paypal","revolut"].includes(body.provider) || !Number.isInteger(body.amount_cents) || body.amount_cents<100 || body.amount_cents>100000 || typeof body.destination!=="string" || body.destination.trim().length<2 || body.destination.trim().length>200) return json({error:"Controlla importo (1–1.000 €), metodo e nome del conto."},400);
      const {data,error} = await db.rpc("mucho_wallet_request",{p_account_id:account.id,p_key:body.key,p_kind:body.kind,p_provider:body.provider,p_amount:body.amount_cents,p_destination:body.destination.trim()});
      if (error) return json({error:error.message},409);
      return json({mode:"demo",request:data});
    }
    if (action === "cancel" || action === "admin_review") {
      if (!uuid(body.id)) return json({error:"Richiesta non valida"},400);
      const decision = action==="cancel" ? "cancelled" : body.decision;
      if (action==="admin_review" && !["completed","rejected"].includes(decision)) return json({error:"Decisione non valida"},400);
      if (body.note!=null && (typeof body.note!=="string" || body.note.length>300)) return json({error:"Nota troppo lunga"},400);
      const {data,error} = await db.rpc("mucho_wallet_review",{p_request_id:body.id,p_decision:decision,p_actor:actor || account.id,p_owner:account.id,p_note:body.note || ""});
      if (error) return json({error:error.message},409);
      return json({mode:"demo",request:data});
    }
    if (action === "admin_list") {
      const {data,error} = await db.from("mucho_wallet_requests").select("*").order("created_at",{ascending:false}).limit(200);
      if (error) throw error;
      const ids=[...new Set((data || []).map(row=>row.account_id))];
      const {data:accounts,error:accountsError} = ids.length ? await db.from("player_accounts").select("id,display_name,player_id").in("id",ids) : {data:[],error:null};
      if (accountsError) throw accountsError;
      const byId=new Map((accounts || []).map(row=>[row.id,row]));
      return json({mode:"demo",requests:(data || []).map(row=>({...row,player_accounts:byId.get(row.account_id)}))});
    }
    return json({error:"Azione non valida"},400);
  } catch (error) {
    console.error("Wallet service error",error);
    return json({error:"Wallet temporaneamente non disponibile. Riprova."},500);
  }
});
