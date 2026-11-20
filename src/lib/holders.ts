import "server-only";

import type { HolderVehicle } from "@/components/HolderPicker";
import { getFleet, type Model } from "./fleet";
import { createSessionClient } from "./supabase/server";

export type HolderData = {
  models: Model[];
  vehicles: HolderVehicle[];
  noHolder: string[];
};

/** Активните коли (за избор на титуляр) и кой ги държи – от гледната точка на спотъра uid. */
export async function getHolderData(uid: string): Promise<HolderData> {
  const db = await createSessionClient();
  const [fleet, holders, none] = await Promise.all([
    getFleet(),
    db.from("vehicle_holders").select("role,user_id,vehicles(fleet_number)").eq("role", "owner"),
    db.from("model_no_holder").select("model_id").eq("user_id", uid),
  ]);
  const owners = new Map<string, string>();
  for (const h of (holders.data ?? []) as unknown as { user_id: string; vehicles: { fleet_number: string } | null }[]) {
    if (h.vehicles) owners.set(h.vehicles.fleet_number, h.user_id);
  }
  // И колите, където спотърът е ортак, броим за „негови“
  const mineAny = await db.from("vehicle_holders").select("vehicles(fleet_number)").eq("user_id", uid);
  const mine = new Set(
    ((mineAny.data ?? []) as unknown as { vehicles: { fleet_number: string } | null }[]).map((r) => r.vehicles?.fleet_number)
  );

  const vehicles: HolderVehicle[] = fleet.vehicles
    .filter((v) => v.status === "run" || v.status === "new" || v.status === "stop" || v.status === "service")
    .map((v) => ({
      fleet_number: v.fleet_number,
      model_id: v.model_id,
      owner: mine.has(v.fleet_number) ? "me" : owners.has(v.fleet_number) ? "other" : null,
    }));

  return { models: fleet.models, vehicles, noHolder: (none.data ?? []).map((r) => r.model_id) };
}
