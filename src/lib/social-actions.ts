"use server";

import { updateTag } from "next/cache";
import { getCurrentUser } from "./auth";
import { deliver, pingAdmins } from "./notify";
import { UUID_RE } from "./photo-shared";
import { createAdminClient, createSessionClient } from "./supabase/server";

export type Result = { ok?: boolean; error?: string; value?: string | number | boolean };

const FLEET_RE = /^[0-9]{3,6}$/;
const clean = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

async function me() {
  const user = await getCurrentUser();
  if (!user) throw new Error("not_authenticated");
  return { user, db: await createSessionClient() };
}

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.profile.role !== "admin" || user.aal !== "aal2") throw new Error("not_admin");
  return { user, db: await createSessionClient() };
}

// ── Ортаци ───────────────────────────────────────────────────────────────

export async function requestPartnerAction(fleet: string, message = ""): Promise<Result> {
  if (!FLEET_RE.test(fleet)) return { error: "generic" };
  const { user, db } = await me();
  const { data, error } = await db.rpc("request_partner", { p_fleet_number: fleet, p_message: clean(message, 300) });
  if (error) return { error: "generic" };
  const r = String(data);
  if (!/^\d+$/.test(r)) return { error: r }; // free | already | pending | inactive
  const { data: inv } = await createAdminClient().from("holder_invites").select("owner_id").eq("id", Number(r)).single();
  if (inv?.owner_id) {
    await deliver([inv.owner_id], "invite_received", { fleet, from: user.profile.display_name ?? "", invite: Number(r) }, {}); // имейл винаги
  }
  return { ok: true };
}

export async function answerInviteAction(id: number, accept: boolean): Promise<Result> {
  const { db } = await me();
  const { data, error } = await db.rpc("answer_invite", { p_invite: id, p_accept: accept });
  if (error || data !== "ok") return { error: "generic" };
  const { data: inv } = await createAdminClient().from("holder_invites").select("requester_id,vehicles(fleet_number)").eq("id", id).single();
  const fleet = (inv?.vehicles as unknown as { fleet_number: string } | null)?.fleet_number ?? "";
  if (inv) await deliver([inv.requester_id], "invite_answered", { fleet, accepted: accept }, {}); // имейл винаги
  updateTag(`vehicle:${fleet}`);
  updateTag("fleet");
  return { ok: true };
}

export async function cancelInviteAction(id: number): Promise<Result> {
  const { db } = await me();
  const { error } = await db.rpc("cancel_invite", { p_invite: id });
  return error ? { error: "generic" } : { ok: true };
}

/** Отказ от кола. Ако е собственик с ортаци – тръгва гласуване (или единственият ортак става собственик). */
export async function leaveVehicleAction(fleet: string): Promise<Result> {
  if (!FLEET_RE.test(fleet)) return { error: "generic" };
  const { user, db } = await me();
  const admin = createAdminClient();
  const { data: v } = await admin.from("vehicles").select("id").eq("fleet_number", fleet).single();
  if (!v) return { error: "generic" };
  const { data: before } = await admin.from("vehicle_holders").select("user_id,role").eq("vehicle_id", v.id);
  const wasOwner = before?.some((h) => h.user_id === user.id && h.role === "owner");
  const { data, error } = await db.rpc("release_vehicle", { p_fleet_number: fleet });
  if (error || data !== "released") return { error: String(data ?? "generic") };
  if (wasOwner) {
    const partners = (before ?? []).filter((h) => h.role === "partner").map((h) => h.user_id as string);
    if (partners.length === 1) {
      const { data: w } = await admin.from("profiles").select("display_name").eq("id", partners[0]).single();
      await deliver(partners, "owner_elected", { fleet, winner: w?.display_name ?? "" });
    } else if (partners.length > 1) {
      await deliver(partners, "owner_vote", { fleet }, { pref: "owner_vote" });
    }
  }
  updateTag(`vehicle:${fleet}`);
  updateTag("fleet");
  return { ok: true };
}

export async function voteOwnerAction(election: number, candidate: string): Promise<Result> {
  if (!UUID_RE.test(candidate)) return { error: "generic" };
  const { db } = await me();
  const { data, error } = await db.rpc("cast_owner_vote", { p_election: election, p_candidate: candidate });
  if (error) return { error: "generic" };
  if (data === "decided") {
    const admin = createAdminClient();
    const { data: e } = await admin.from("owner_elections").select("vehicle_id,winner_id,vehicles(fleet_number)").eq("id", election).single();
    const fleet = (e?.vehicles as unknown as { fleet_number: string } | null)?.fleet_number ?? "";
    const [{ data: holders }, { data: w }] = await Promise.all([
      admin.from("vehicle_holders").select("user_id").eq("vehicle_id", e?.vehicle_id ?? 0),
      admin.from("profiles").select("display_name").eq("id", e?.winner_id ?? "").maybeSingle(),
    ]);
    await deliver((holders ?? []).map((h) => h.user_id as string), "owner_elected", { fleet, winner: w?.display_name ?? "" });
    updateTag(`vehicle:${fleet}`);
    updateTag("fleet");
  }
  return { ok: true, value: String(data) };
}

export async function adminDecideElectionAction(election: number, winner: string): Promise<Result> {
  if (!UUID_RE.test(winner)) return { error: "generic" };
  const { db } = await requireAdmin();
  const { data, error } = await db.rpc("admin_decide_election", { p_election: election, p_winner: winner });
  if (error || data !== "ok") return { error: "generic" };
  updateTag("fleet");
  return { ok: true };
}

export async function adminRemovePartnerAction(fleet: string, userId: string): Promise<Result> {
  if (!FLEET_RE.test(fleet) || !UUID_RE.test(userId)) return { error: "generic" };
  const { db } = await requireAdmin();
  const { error } = await db.rpc("admin_remove_partner", { p_fleet_number: fleet, p_user: userId });
  if (error) return { error: "generic" };
  updateTag(`vehicle:${fleet}`);
  updateTag("fleet");
  return { ok: true };
}

// ── Описание на колата ───────────────────────────────────────────────────

export async function submitDescriptionAction(fleet: string, text: string): Promise<Result> {
  if (!FLEET_RE.test(fleet)) return { error: "generic" };
  const { db, user } = await me();
  const { data, error } = await db.rpc("submit_description", { p_fleet_number: fleet, p_text: clean(text, 1000) });
  if (error || data !== "ok") return { error: String(data ?? "generic") };
  if (user.profile.role === "admin") updateTag(`vehicle:${fleet}`);
  else await pingAdmins();
  return { ok: true };
}

export async function adminReviewDescriptionAction(vehicleId: number, approve: boolean, fleet: string): Promise<Result> {
  const { db } = await requireAdmin();
  const { error } = await db.rpc("admin_review_description", { p_vehicle: vehicleId, p_approve: approve });
  if (error) return { error: "generic" };
  updateTag(`vehicle:${fleet}`);
  return { ok: true };
}

// ── Оценки ───────────────────────────────────────────────────────────────

export async function rateVehicleAction(fleet: string, r: { look: number; comfort: number; sound: number; rarity: number }): Promise<Result> {
  if (!FLEET_RE.test(fleet)) return { error: "generic" };
  const vals = [r.look, r.comfort, r.sound, r.rarity].map((x) => Math.round(Number(x)));
  if (vals.some((x) => !(x >= 1 && x <= 5))) return { error: "generic" };
  const { db, user } = await me();
  const { data: v } = await db.from("vehicles").select("id").eq("fleet_number", fleet).single();
  if (!v) return { error: "generic" };
  const { error } = await db.from("vehicle_ratings").upsert(
    { vehicle_id: v.id, user_id: user.id, look: vals[0], comfort: vals[1], sound: vals[2], rarity: vals[3], updated_at: new Date().toISOString() },
    { onConflict: "vehicle_id,user_id" }
  );
  if (error) return { error: "generic" };
  updateTag(`vehicle:${fleet}`);
  return { ok: true };
}

// ── Харесвания ───────────────────────────────────────────────────────────

export async function toggleLikeAction(photoId: string): Promise<Result> {
  if (!UUID_RE.test(photoId)) return { error: "generic" };
  const { db, user } = await me();
  const { data: existing } = await db.from("photo_likes").select("photo_id").eq("photo_id", photoId).eq("user_id", user.id).maybeSingle();
  const { error } = existing
    ? await db.from("photo_likes").delete().eq("photo_id", photoId).eq("user_id", user.id)
    : await db.from("photo_likes").insert({ photo_id: photoId, user_id: user.id });
  if (error) return { error: "generic" };
  updateTag(`photo:${photoId}`);
  return { ok: true, value: !existing };
}

// ── Коментари ────────────────────────────────────────────────────────────

export async function addCommentAction(photoId: string, body: string, parentId?: number): Promise<Result> {
  if (!UUID_RE.test(photoId)) return { error: "generic" };
  const text = clean(body, 1000);
  if (!text) return { error: "empty" };
  const { db, user } = await me();
  if (!user.emailConfirmed) return { error: "emailNotConfirmed" };
  const { data, error } = await db
    .from("photo_comments")
    .insert({ photo_id: photoId, body: text, parent_id: parentId ?? null })
    .select("status")
    .single();
  if (error) return { error: error.message.includes("rate_limit") ? "rate_limit" : "generic" };
  if (data?.status === "pending") await pingAdmins();
  else updateTag(`photo:${photoId}`);
  return { ok: true, value: data?.status ?? "pending" };
}

export async function deleteCommentAction(id: number, photoId: string): Promise<Result> {
  const { db } = await me();
  const { error } = await db.from("photo_comments").delete().eq("id", id);
  if (error) return { error: "generic" };
  updateTag(`photo:${photoId}`);
  return { ok: true };
}

export async function adminReviewCommentAction(id: number, approve: boolean): Promise<Result> {
  const { db } = await requireAdmin();
  const { data, error } = await db
    .from("photo_comments")
    .update({ status: approve ? "approved" : "rejected", reviewed_at: new Date().toISOString() })
    .eq("id", id)
    .select("photo_id")
    .single();
  if (error) return { error: "generic" };
  if (data?.photo_id) updateTag(`photo:${data.photo_id}`);
  return { ok: true };
}

// ── Докладване ───────────────────────────────────────────────────────────

export async function reportAction(type: "comment" | "photo" | "spotter", targetId: string, reason = ""): Promise<Result> {
  if (!["comment", "photo", "spotter"].includes(type) || !/^[0-9a-f-]{1,64}$/i.test(targetId)) return { error: "generic" };
  const { db, user } = await me();
  const { error } = await db.from("reports").insert({ target_type: type, target_id: targetId, user_id: user.id, reason: clean(reason, 300) || null });
  if (error && error.code !== "23505") return { error: "generic" };
  await pingAdmins();
  return { ok: true };
}

export async function resolveReportAction(id: number): Promise<Result> {
  const { db } = await requireAdmin();
  const { error } = await db.from("reports").update({ resolved: true }).eq("id", id);
  return error ? { error: "generic" } : { ok: true };
}

// ── Следване ─────────────────────────────────────────────────────────────

export async function toggleFollowAction(type: "spotter" | "vehicle" | "line", id: string): Promise<Result> {
  if (!["spotter", "vehicle", "line"].includes(type) || !/^[0-9A-Za-zА-Яа-я\- ]{1,64}$/.test(id)) return { error: "generic" };
  const { db, user } = await me();
  if (type === "spotter" && id === user.id) return { error: "generic" };
  const { data: existing } = await db.from("follows").select("target_id").eq("user_id", user.id).eq("target_type", type).eq("target_id", id).maybeSingle();
  const { error } = existing
    ? await db.from("follows").delete().eq("user_id", user.id).eq("target_type", type).eq("target_id", id)
    : await db.from("follows").insert({ user_id: user.id, target_type: type, target_id: id });
  return error ? { error: "generic" } : { ok: true, value: !existing };
}

// ── Известия и push ──────────────────────────────────────────────────────

export async function markAllReadAction(): Promise<Result> {
  const { db, user } = await me();
  await db.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).is("read_at", null);
  return { ok: true };
}

export async function savePushAction(sub: { endpoint: string; keys: { p256dh: string; auth: string } }): Promise<Result> {
  if (!sub?.endpoint?.startsWith("https://") || !sub.keys?.p256dh || !sub.keys?.auth) return { error: "generic" };
  const { db, user } = await me();
  await db.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  const { error } = await db
    .from("push_subscriptions")
    .insert({ user_id: user.id, endpoint: sub.endpoint.slice(0, 1000), p256dh: sub.keys.p256dh.slice(0, 200), auth: sub.keys.auth.slice(0, 100) });
  return error ? { error: "generic" } : { ok: true };
}

export async function removePushAction(endpoint: string): Promise<Result> {
  const { db } = await me();
  await db.from("push_subscriptions").delete().eq("endpoint", endpoint);
  return { ok: true };
}

