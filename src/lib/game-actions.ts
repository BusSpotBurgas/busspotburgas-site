"use server";

import { updateTag } from "next/cache";
import { getCurrentUser } from "./auth";
import { pingAdmins } from "./notify";
import { UUID_RE } from "./photo-shared";
import { createSessionClient } from "./supabase/server";

type Result = { ok?: boolean; error?: string; value?: string };

export async function votePotmAction(photoId: string): Promise<Result> {
  if (!UUID_RE.test(photoId)) return { error: "generic" };
  const user = await getCurrentUser();
  if (!user) return { error: "not_authenticated" };
  const db = await createSessionClient();
  const { data, error } = await db.rpc("vote_potm", { p_photo: photoId });
  if (error) return { error: "generic" };
  updateTag("monthly");
  return data === "ok" ? { ok: true } : { error: String(data) };
}

const VIDEO_RE = /^https:\/\/(www\.|m\.|vm\.)?(youtube\.com|youtu\.be|tiktok\.com)\/[^\s<>"']{1,250}$/;

export async function submitVideoAction(fleet: string, url: string): Promise<Result> {
  const u = String(url ?? "").trim();
  if (!/^[0-9]{3,6}$/.test(fleet) || !VIDEO_RE.test(u)) return { error: "invalid" };
  const user = await getCurrentUser();
  if (!user) return { error: "not_authenticated" };
  if (!user.emailConfirmed) return { error: "emailNotConfirmed" };
  const db = await createSessionClient();
  const { data: v } = await db.from("vehicles").select("id").eq("fleet_number", fleet).single();
  if (!v) return { error: "generic" };
  const provider = u.includes("tiktok.com") ? "tiktok" : "youtube";
  const { data, error } = await db.from("videos").insert({ vehicle_id: v.id, url: u, provider }).select("status").single();
  if (error) return { error: error.code === "23505" ? "duplicate" : "generic" };
  if (data?.status === "approved") updateTag(`vehicle:${fleet}`);
  else await pingAdmins();
  return { ok: true, value: data?.status };
}

export async function adminReviewVideoAction(id: number, approve: boolean): Promise<Result> {
  const user = await getCurrentUser();
  if (!user || user.profile.role !== "admin" || user.aal !== "aal2") return { error: "not_admin" };
  const db = await createSessionClient();
  const { data, error } = await db
    .from("videos")
    .update({ status: approve ? "approved" : "rejected", reviewed_at: new Date().toISOString() })
    .eq("id", id)
    .select("vehicles(fleet_number)")
    .single();
  if (error) return { error: "generic" };
  const fleet = (data?.vehicles as unknown as { fleet_number: string } | null)?.fleet_number;
  if (fleet) updateTag(`vehicle:${fleet}`);
  updateTag("leaderboard");
  return { ok: true };
}
