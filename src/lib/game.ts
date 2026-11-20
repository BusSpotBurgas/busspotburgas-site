import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { hasSupabase } from "./supabase/env";
import { createPublicClient, createSessionClient } from "./supabase/server";

export type Rank = "rookie" | "spotter" | "veteran" | "expert" | "legend";
export const RANKS: { id: Rank; min: number }[] = [
  { id: "rookie", min: 0 },
  { id: "spotter", min: 50 },
  { id: "veteran", min: 250 },
  { id: "expert", min: 750 },
  { id: "legend", min: 2000 },
];

export function nextRank(total: number) {
  return RANKS.find((r) => r.min > total) ?? null;
}

export type Badge = { badge: string; ref: string; created_at: string };
export type BoardRow = { user_id: string; display_name: string; avatar_url: string | null; role: string; score: number };
export type BoardKind = "month" | "all" | "model" | "collection";

/** Точки, ранг, значки и колекция (кои коли е снимал) на спотър. */
export async function getSpotterGame(uid: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag("photos", `game:${uid}`);
  if (!hasSupabase) return { total: 0, month: 0, rank: "rookie" as Rank, badges: [] as Badge[], collected: [] as string[] };
  const db = createPublicClient();
  const [pts, badges, photos] = await Promise.all([
    db.from("user_points").select("total,month_total,rank").eq("user_id", uid).maybeSingle(),
    db.from("user_badges").select("badge,ref,created_at").eq("user_id", uid).order("created_at"),
    db.from("photos").select("vehicles(fleet_number)").eq("user_id", uid).eq("status", "approved"),
  ]);
  const collected = [
    ...new Set(((photos.data ?? []) as unknown as { vehicles: { fleet_number: string } | null }[]).map((p) => p.vehicles?.fleet_number).filter(Boolean) as string[]),
  ];
  return {
    total: Number(pts.data?.total ?? 0),
    month: Number(pts.data?.month_total ?? 0),
    rank: (pts.data?.rank as Rank) ?? "rookie",
    badges: (badges.data ?? []) as Badge[],
    collected,
  };
}

export async function getLeaderboard(kind: BoardKind, model?: string, limit = 50) {
  "use cache";
  cacheLife("minutes");
  cacheTag("photos", "leaderboard");
  if (!hasSupabase) return [] as BoardRow[];
  const { data } = await createPublicClient().rpc("leaderboard", { p_kind: kind, p_model: model ?? null, p_limit: limit });
  return (data ?? []) as BoardRow[];
}

/** Снимка и спотър на месеца (последното решено) + кандидатите за гласуване сега. */
export async function getMonthly() {
  "use cache";
  cacheLife("minutes");
  cacheTag("photos", "monthly");
  const empty = { award: null as null | { month: string; photo_id: string | null; photo_author: string | null; spotter_id: string | null }, window: null as null | { month: string; voting: boolean; ends: string }, candidates: [] as { photo_id: string; user_id: string; author_name: string; fleet_number: string; likes: number; votes: number }[], authorName: null as string | null, spotter: null as null | { id: string; display_name: string; avatar_url: string | null } };
  if (!hasSupabase) return empty;
  const db = createPublicClient();
  const [{ data: award }, { data: win }] = await Promise.all([
    db.from("monthly_awards").select("month,photo_id,photo_author,spotter_id").not("photo_id", "is", null).order("month", { ascending: false }).limit(1).maybeSingle(),
    db.rpc("potm_window"),
  ]);
  const w = (win as { month: string; voting: boolean; ends: string }[] | null)?.[0] ?? null;
  const { data: cands } = w ? await db.rpc("potm_candidates", { p_month: w.month }) : { data: [] };
  const { data: latestSpotter } = await db.from("monthly_awards").select("spotter_id").not("spotter_id", "is", null).order("month", { ascending: false }).limit(1).maybeSingle();
  const ids = [award?.photo_author, latestSpotter?.spotter_id].filter(Boolean) as string[];
  const { data: people } = ids.length ? await db.from("profiles").select("id,display_name,avatar_url").in("id", ids) : { data: [] };
  const byId = new Map((people ?? []).map((p) => [p.id as string, p]));
  const sp = latestSpotter?.spotter_id ? byId.get(latestSpotter.spotter_id) : null;
  return {
    award: award ?? null,
    window: w,
    candidates: (cands ?? []) as typeof empty.candidates,
    authorName: award?.photo_author ? ((byId.get(award.photo_author)?.display_name as string) ?? null) : null,
    spotter: sp ? { id: sp.id as string, display_name: sp.display_name as string, avatar_url: (sp.avatar_url as string) ?? null } : null,
  };
}

export async function getMyPotmVote(uid: string, month: string) {
  const db = await createSessionClient();
  const { data } = await db.from("potm_votes").select("photo_id").eq("user_id", uid).eq("month", month).maybeSingle();
  return (data?.photo_id as string | undefined) ?? null;
}

export type Video = { id: number; url: string; provider: "youtube" | "tiktok"; user_id: string | null; created_at: string };

export async function getVehicleVideos(vehicleId: number, fleet: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag(`vehicle:${fleet}`);
  if (!hasSupabase) return [] as Video[];
  const { data } = await createPublicClient().from("videos").select("id,url,provider,user_id,created_at").eq("vehicle_id", vehicleId).eq("status", "approved").order("created_at", { ascending: false });
  return (data ?? []) as Video[];
}

/** YouTube → id за вграждане (без бисквитки: youtube-nocookie). */
export function youtubeId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|v=|shorts\/|embed\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}
