import "server-only";

import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { supabaseKey, supabaseUrl } from "./env";

/** Клиент с бисквитката на влезлия спотър (Етап 2+). */
export async function createSessionClient() {
  const store = await cookies();
  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Извикано от Server Component – сесията се обновява в proxy.
        }
      },
    },
  });
}

/** Анонимен клиент за публични данни (автопарк) – може да се кешира. */
export function createPublicClient() {
  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Клиент със СЕКРЕТНИЯ ключ – само за сървъра (изтриване на акаунт).
 * Заобикаля RLS, затова се ползва само след проверка кой е спотърът.
 */
export function createAdminClient() {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error("SUPABASE_SECRET_KEY липсва");
  return createClient(supabaseUrl, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
