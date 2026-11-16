// Само ПУБЛИЧНИТЕ стойности – безопасни са за браузъра (защитата идва от RLS).
// Service ключът НИКОГА не се слага с префикс NEXT_PUBLIC_.
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "";

export const hasSupabase = Boolean(supabaseUrl && supabaseKey);
