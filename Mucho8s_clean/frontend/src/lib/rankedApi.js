import { supabaseAuth } from "@/lib/supabaseClient";
const URL=(process.env.REACT_APP_SUPABASE_URL||"").replace(/\/$/,"");
const KEY=process.env.REACT_APP_SUPABASE_ANON_KEY||"";
export async function rankedRequest(action,payload={}){
 if(!URL||!KEY||!supabaseAuth)throw new Error("Ranked requires Supabase");
 const {data}=await supabaseAuth.auth.getSession();
 const token=data?.session?.access_token;
 if(!token)throw new Error("Connect Discord to play Ranked");
 const response=await fetch(`${URL}/functions/v1/mucho8s-ranked`,{
  method:"POST",headers:{"Content-Type":"application/json","apikey":KEY,"Authorization":`Bearer ${token}`},
  body:JSON.stringify({action,...payload})
 });
 const result=await response.json().catch(()=>({}));
 if(!response.ok||!result.ok)throw new Error(result.error||"Ranked request failed");
 return result;
}
