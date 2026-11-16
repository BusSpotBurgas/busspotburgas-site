import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "./supabase/server";
import { hasSupabase } from "./supabase/env";

export type VehicleStatus = "run" | "new" | "stop" | "off" | "scrapped";
export type Silhouette = "12m" | "18m" | "9m" | "mini" | "trolley";

export type Model = {
  id: string;
  name: string;
  type_bg: string;
  type_en: string;
  since: string | null;
  color: string;
  silhouette: Silhouette;
  sort_order: number;
};

export type Vehicle = {
  fleet_number: string;
  model_id: string;
  status: VehicleStatus;
};

export type Fleet =
  | { ok: true; models: Model[]; vehicles: Vehicle[] }
  | { ok: false; models: []; vehicles: [] };

const EMPTY: Fleet = { ok: false, models: [], vehicles: [] };

/** Модели и коли от Supabase. Кешира се за няколко минути. */
export async function getFleet(): Promise<Fleet> {
  "use cache";
  cacheLife("minutes");
  cacheTag("fleet");

  if (!hasSupabase) return EMPTY;
  const db = createPublicClient();
  const [models, vehicles] = await Promise.all([
    db.from("models").select("id,name,type_bg,type_en,since,color,silhouette,sort_order").order("sort_order"),
    db.from("vehicles").select("fleet_number,model_id,status").eq("is_historic", false).neq("status", "scrapped"),
  ]);
  if (models.error || vehicles.error) {
    console.error("Supabase:", models.error ?? vehicles.error);
    return EMPTY;
  }
  const list = (vehicles.data as Vehicle[]).sort(
    (a, b) => a.fleet_number.length - b.fleet_number.length || a.fleet_number.localeCompare(b.fleet_number)
  );
  return { ok: true, models: models.data as Model[], vehicles: list };
}
