import { supabaseAuth } from "@/lib/supabaseClient";
const URL=(process.env.REACT_APP_SUPABASE_URL||"").replace(/\/$/,""), KEY=process.env.REACT_APP_SUPABASE_ANON_KEY||"";
export const fetchTourney=async()=>{if(!URL||!KEY)return null;try{const r=await fetch(`${URL}/functions/v1/mucho8s-tourney`,{method:"POST",headers:{"Content-Type":"application/json",apikey:KEY},body:JSON.stringify({action:"get"})});const d=await r.json();return r.ok?d.tourney:null}catch{return null}};
export const saveTourney=async(state,sessionToken)=>{if(!URL||!KEY||!sessionToken)return null;const r=await fetch(`${URL}/functions/v1/mucho8s-tourney`,{method:"POST",headers:{"Content-Type":"application/json",apikey:KEY,"X-Admin-Session":sessionToken},body:JSON.stringify({action:"save",state})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||"Tournament save failed");return d.tourney};
export const subscribeTourney=(onChange)=>{
  if(!supabaseAuth)return()=>{};
  let active=true;
  let timer=null;
  const pull=async()=>{const row=await fetchTourney();if(active&&row)onChange(row)};
  // Supabase Realtime channels are single-use after subscribe(). Keep this
  // subscription unfiltered and filter the payload client-side to avoid the
  // "cannot add postgres_changes callbacks after subscribe()" runtime crash.
  const channel=supabaseAuth
    .channel(`muchotourney-live-${Math.random().toString(36).slice(2)}`)
    .on("postgres_changes",{event:"*",schema:"public",table:"tourney_state"},payload=>{
      if(payload?.new?.id==="current"&&payload.new.state)onChange(payload.new.state);
    })
    .subscribe(status=>{
      if(status==="CHANNEL_ERROR"||status==="TIMED_OUT"){
        if(!timer)timer=setInterval(pull,5000);
      }
    });
  return()=>{
    active=false;
    if(timer)clearInterval(timer);
    try{supabaseAuth.removeChannel(channel)}catch{}
  };
};
