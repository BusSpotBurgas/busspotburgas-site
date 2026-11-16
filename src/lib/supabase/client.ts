"use client";

import { createBrowserClient } from "@supabase/ssr";
import { supabaseKey, supabaseUrl } from "./env";

// Клиент за браузъра (вход, Realtime) – използва се от Етап 2 нататък.
export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseKey);
}
