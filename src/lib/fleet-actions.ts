"use server";

import { updateTag } from "next/cache";
import { getCurrentUser } from "./auth";
import { notifyUsers } from "./notify";
import { createAdminClient, createSessionClient } from "./supabase/server";

const STATUSES = ["run", "new", "stop", "service", "off", "scrapped"] as const;

/** Админът сменя статуса на кола. При бракуване титулярите избират нов номер. */
export async function adminSetStatusAction(fleet: string, status: string): Promise<{ ok?: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user || user.profile.role !== "admin" || user.aal !== "aal2") return { error: "not_admin" };
  if (!/^[0-9]{3,6}$/.test(fleet) || !STATUSES.includes(status as (typeof STATUSES)[number])) return { error: "generic" };

  const db = await createSessionClient();
  const { data: v, error } = await db.from("vehicles").update({ status }).eq("fleet_number", fleet).select("id").single();
  if (error || !v) return { error: "generic" };

  if (status === "scrapped") {
    const admin = createAdminClient();
    const { data: holders } = await admin.from("vehicle_holders").select("user_id,role").eq("vehicle_id", v.id);
    // първо ортаците, после собственика – за да не тръгне гласуване
    await admin.from("vehicle_holders").delete().eq("vehicle_id", v.id).eq("role", "partner");
    await admin.from("vehicle_holders").delete().eq("vehicle_id", v.id);
    await notifyUsers((holders ?? []).map((h) => h.user_id as string), "vehicle_scrapped", { fleet });
  }
  updateTag("fleet");
  updateTag(`vehicle:${fleet}`);
  return { ok: true };
}
