import { createClient } from "@supabase/supabase-js";

const url = (process.env.REACT_APP_SUPABASE_URL || "").replace(/\/$/, "");
const key = process.env.REACT_APP_SUPABASE_ANON_KEY || "";

export const hasSupabaseAuth = Boolean(url && key);

export const supabaseAuth = hasSupabaseAuth
  ? createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce",
      },
    })
  : null;
