import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { PHOTO_COLS, UUID_RE, type PhotoRow } from "./photo-shared";
import { hasSupabase } from "./supabase/env";
import { createPublicClient, createSessionClient } from "./supabase/server";

export type VehicleDetails = {
  id: number;
  fleet_number: string;
  model_id: string;
  status: "run" | "new" | "stop" | "service" | "off" | "scrapped";
  reg_number: string | null;
  garage: string | null;
  built_year: number | null;
  in_service_since: string | null;
  old_numbers: string[];
  length_m: number | null;
  doors: number | null;
  seats: number | null;
  fuel: string | null;
};

export type Holder = { user_id: string; role: "owner" | "partner"; display_name: string | null; avatar_url: string | null };

/** Кола + одобрените ѝ снимки + титулярите. */
export async function getVehiclePage(fleetNumber: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag("photos", `vehicle:${fleetNumber}`);
  if (!hasSupabase || !/^[0-9]{3,6}$/.test(fleetNumber)) return null;
  const db = createPublicClient();
  const { data: v } = await db
    .from("vehicles")
    .select("id,fleet_number,model_id,status,reg_number,garage,built_year,in_service_since,old_numbers,length_m,doors,seats,fuel")
    .eq("fleet_number", fleetNumber)
    .maybeSingle();
  if (!v) return null;
  const [photos, holders] = await Promise.all([
    db.from("photos").select(PHOTO_COLS).eq("vehicle_id", v.id).eq("status", "approved").order("created_at", { ascending: false }),
    db.from("vehicle_holders").select("user_id,role,profiles(display_name,avatar_url)").eq("vehicle_id", v.id),
  ]);
  return {
    vehicle: v as VehicleDetails,
    photos: (photos.data ?? []) as unknown as PhotoRow[],
    holders: ((holders.data ?? []) as unknown as { user_id: string; role: Holder["role"]; profiles: { display_name: string | null; avatar_url: string | null } | null }[]).map(
      (h) => ({ user_id: h.user_id, role: h.role, display_name: h.profiles?.display_name ?? null, avatar_url: h.profiles?.avatar_url ?? null })
    ),
  };
}

/** Една одобрена снимка + съседните снимки на същата кола (за плъзгане). */
export async function getPhoto(id: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag("photos", `photo:${id}`);
  if (!hasSupabase || !UUID_RE.test(id)) return null;
  const db = createPublicClient();
  const { data: p } = await db.from("photos").select(PHOTO_COLS).eq("id", id).eq("status", "approved").maybeSingle();
  if (!p) return null;
  const photo = p as unknown as PhotoRow;
  const { data: siblings } = await db
    .from("photos")
    .select("id")
    .eq("vehicle_id", photo.vehicle_id)
    .eq("status", "approved")
    .order("created_at", { ascending: false });
  const ids = (siblings ?? []).map((s) => s.id as string);
  const i = ids.indexOf(id);
  return { photo, prev: i > 0 ? ids[i - 1] : null, next: i >= 0 && i < ids.length - 1 ? ids[i + 1] : null };
}

export async function getLatestPhotos(limit = 12) {
  "use cache";
  cacheLife("minutes");
  cacheTag("photos");
  if (!hasSupabase) return [];
  const { data } = await createPublicClient()
    .from("photos")
    .select(PHOTO_COLS)
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as unknown as PhotoRow[];
}

/** Снимките на влезлия спотър (всички статуси). Чете бисквитката – само в <Suspense>. */
export async function getMyPhotos(uid: string) {
  const db = await createSessionClient();
  const { data } = await db.from("photos").select(PHOTO_COLS).eq("user_id", uid).order("created_at", { ascending: false }).limit(200);
  const rows = (data ?? []) as unknown as PhotoRow[];
  return withPrivatePreviews(db, rows.filter((r) => r.status !== "approved"), rows);
}

/** Опашката за админа. */
export async function getQueue() {
  const db = await createSessionClient();
  const [{ data }, { data: claims }, { data: usage }] = await Promise.all([
    db.from("photos").select(PHOTO_COLS).eq("status", "pending").order("created_at", { ascending: true }).limit(50),
    db.from("photo_claims").select("id,photo_id,note,created_at,profiles(display_name)").eq("resolved", false).order("created_at"),
    db.rpc("storage_usage"),
  ]);
  const rows = (data ?? []) as unknown as PhotoRow[];
  const { data: priv } = rows.length
    ? await db.from("photo_private").select("photo_id,taken_at").in("photo_id", rows.map((r) => r.id))
    : { data: [] };
  const takenAt = new Map((priv ?? []).map((p) => [p.photo_id as string, p.taken_at as string | null]));
  const withUrls = await withPrivatePreviews(db, rows, rows);
  return {
    photos: withUrls.map((p) => ({ ...p, taken_at: takenAt.get(p.id) ?? null })),
    claims: (claims ?? []) as unknown as { id: number; photo_id: string; note: string | null; created_at: string; profiles: { display_name: string | null } | null }[],
    usage: (usage ?? []) as { bucket: string; files: number; bytes: number }[],
  };
}

/** Подписани (временни) адреси за снимки, които още не са публични. */
async function withPrivatePreviews(
  db: Awaited<ReturnType<typeof createSessionClient>>,
  privateRows: PhotoRow[],
  all: PhotoRow[]
): Promise<(PhotoRow & { preview?: string })[]> {
  const paths = privateRows.filter((r) => r.user_id).map((r) => `${r.user_id}/${r.id}/display`);
  const signed = paths.length ? (await db.storage.from("photos-private").createSignedUrls(paths, 3600)).data ?? [] : [];
  const map = new Map(signed.map((s) => [s.path ?? "", s.signedUrl]));
  return all.map((r) => ({ ...r, preview: (r.user_id && map.get(`${r.user_id}/${r.id}/display`)) || undefined }));
}
