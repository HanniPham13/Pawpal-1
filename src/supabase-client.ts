import { createClient } from "@supabase/supabase-js";

// Hardcoded as per user instruction. DO NOT expose service keys in frontend code!
const supabaseUrl = "https://xnskynghatlhxplxcmal.supabase.co";
// This is the ANON/public key
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhuc2t5bmdoYXRsaHhwbHhjbWFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI3MTQzNzgsImV4cCI6MjA1ODI5MDM3OH0.HCVQ7gJMoIIdRTEgPFkAkTgWb3_R-5DdnKASgyVA474";

if (!supabaseUrl) throw new Error("Missing SUPABASE URL");
if (!supabaseAnonKey) throw new Error("Missing SUPABASE ANON KEY");

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
