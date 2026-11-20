import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "./supabase/server";
import { hasSupabase } from "./supabase/env";

export type VehicleStatus = "run" | "new" | "stop" | "service" | "off" | "scrapped";

/** Активни коли: могат да имат титуляри. */
export const ACTIVE_STATUSES: VehicleStatus[] = ["run", "new", "stop", "service"];
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
  /** брой одобрени снимки */
  photos: number;
  /** последната одобрена снимка (за картата) */
  cover: string | null;
  /** собственикът (титуляр) */
  owner: string | null;
};

export type Fleet =
  | { ok: true; models: Model[]; vehicles: Vehicle[] }
  | { ok: false; models: []; vehicles: [] };

const EMPTY: Fleet = { ok: false, models: [], vehicles: [] };

/** Модели и коли от Supabase. Кешира се за няколко минути. */
export async function getFleet(): Promise<Fleet> {
  "use cache";
  cacheLife("minutes");
  cacheTag("fleet", "photos");

  if (!hasSupabase) return EMPTY;
  const db = createPublicClient();
  const [models, vehicles, stats, owners] = await Promise.all([
    db.from("models").select("id,name,type_bg,type_en,since,color,silhouette,sort_order").order("sort_order"),
    db.from("vehicles").select("fleet_number,model_id,status").eq("is_historic", false).neq("status", "scrapped"),
    db.from("vehicle_photo_stats").select("fleet_number,photo_count,cover_photo_id"),
    db.from("vehicle_holders").select("vehicles(fleet_number),profiles(display_name)").eq("role", "owner"),
  ]);
  if (models.error || vehicles.error) {
    console.error("Supabase:", models.error ?? vehicles.error);
    return EMPTY;
  }
  // Снимките и титулярите идват от по-късни етапи – ако таблиците ги няма, просто са празни
  const statMap = new Map((stats.data ?? []).map((r) => [r.fleet_number as string, r]));
  const ownerMap = new Map(
    ((owners.data ?? []) as unknown as { vehicles: { fleet_number: string } | null; profiles: { display_name: string | null } | null }[]).map(
      (o) => [o.vehicles?.fleet_number ?? "", o.profiles?.display_name ?? null]
    )
  );
  const list = (vehicles.data as Omit<Vehicle, "photos" | "cover" | "owner">[])
    .map((v) => ({
      ...v,
      photos: Number(statMap.get(v.fleet_number)?.photo_count ?? 0),
      cover: (statMap.get(v.fleet_number)?.cover_photo_id as string | null) ?? null,
      owner: ownerMap.get(v.fleet_number) ?? null,
    }))
    .sort(
    (a, b) => a.fleet_number.length - b.fleet_number.length || a.fleet_number.localeCompare(b.fleet_number)
  );
  return { ok: true, models: models.data as Model[], vehicles: list };
}
