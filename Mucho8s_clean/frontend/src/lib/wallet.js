import { supabaseAuth } from "@/lib/supabaseClient";

export const formatWalletMoney = (cents) => new Intl.NumberFormat("it-IT", {style:"currency",currency:"EUR"}).format(Number(cents || 0)/100);

export function parseWalletAmount(value) {
  const text = String(value).trim().replace(",", ".");
  if (!/^\d{1,4}(\.\d{1,2})?$/.test(text)) throw new Error("Inserisci un importo con massimo due decimali.");
  const [euros,decimals=""] = text.split(".");
  const cents=Number(euros)*100+Number(decimals.padEnd(2,"0"));
  if (cents<100 || cents>100000) throw new Error("L’importo deve essere tra 1 € e 1.000 €.");
  return cents;
}

export async function walletRequest(payload, adminToken="") {
  if (!supabaseAuth) throw new Error("Wallet non disponibile in questa versione.");
  const {data,error} = await supabaseAuth.auth.getSession();
  if (error || !data.session?.access_token) throw new Error("Accedi con Discord per usare il wallet.");
  const response=await fetch(`${process.env.REACT_APP_SUPABASE_URL.replace(/\/$/,"")}/functions/v1/mucho8s-wallet`,{
    method:"POST",headers:{"Content-Type":"application/json",apikey:process.env.REACT_APP_SUPABASE_ANON_KEY,Authorization:`Bearer ${data.session.access_token}`,...(adminToken ? {"X-Admin-Session":adminToken} : {})},body:JSON.stringify(payload),
  });
  const result=await response.json().catch(()=>({}));
  if (!response.ok) throw new Error(result.error || "Impossibile completare la richiesta.");
  return result;
}
