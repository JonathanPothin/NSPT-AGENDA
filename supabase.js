// Connexion Supabase
const SUPABASE_URL = "TON_URL";
const SUPABASE_ANON_KEY = "TA_CLE";
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
console.log('supabase.js chargé');