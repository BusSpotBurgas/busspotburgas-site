"use server";

import { redirect } from "next/navigation";
import type { OnboardingStep } from "./auth";
import { supabaseUrl } from "./supabase/env";
import { createAdminClient, createSessionClient } from "./supabase/server";
import type { FormState } from "./auth-actions";

const ORDER: OnboardingStep[] = ["consent", "profile", "holders", "tour", "done"];
const NAME_BAD = /[<>"\\/{}]/;
const TIKTOK_RE = /^[A-Za-z0-9._]{2,24}$/;

/** Сесията се проверява във ВСЯКО действие – не вярваме на браузъра. */
async function session() {
  const db = await createSessionClient();
  const { data } = await db.auth.getUser();
  if (!data.user) throw new Error("not_authenticated");
  return { db, uid: data.user.id, user: data.user };
}

async function advance(db: Awaited<ReturnType<typeof createSessionClient>>, uid: string, to: OnboardingStep) {
  const { data: p } = await db.from("profiles").select("onboarding_step").eq("id", uid).single();
  const cur = ORDER.indexOf((p?.onboarding_step ?? "consent") as OnboardingStep);
  if (ORDER.indexOf(to) > cur) {
    await db.from("profiles").update({ onboarding_step: to }).eq("id", uid);
  }
}

export async function consentAction(_: FormState, f: FormData): Promise<FormState> {
  if (f.get("age") !== "on") return { error: "ageRequired" };
  if (f.get("terms") !== "on") return { error: "termsRequired" };
  const { db, uid } = await session();
  const { error } = await db
    .from("profiles")
    .update({ age_confirmed: true, terms_accepted_at: new Date().toISOString() })
    .eq("id", uid);
  if (error) return { error: "generic" };
  await advance(db, uid, "profile");
  return { ok: true };
}

export async function saveProfileAction(_: FormState, f: FormData): Promise<FormState> {
  const { db, uid } = await session();
  const name = String(f.get("display_name") ?? "").trim().replace(/\s+/g, " ");
  const tiktok = String(f.get("tiktok") ?? "").trim().replace(/^@/, "");
  const avatar = String(f.get("avatar_url") ?? "").trim();

  if (name.length < 2 || name.length > 32 || NAME_BAD.test(name)) return { error: "nameInvalid" };
  if (tiktok && !TIKTOK_RE.test(tiktok)) return { error: "tiktokInvalid" };
  // Снимката трябва да е в собствената папка на спотъра в нашия Supabase
  const avatarPrefix = `${supabaseUrl}/storage/v1/object/public/avatars/${uid}/`;
  if (avatar && !avatar.startsWith(avatarPrefix)) return { error: "avatarType" };

  const { error } = await db
    .from("profiles")
    .update({ display_name: name, tiktok: tiktok || null, avatar_url: avatar || null })
    .eq("id", uid);
  if (error) return { error: error.code === "23505" ? "nameTaken" : error.code === "23514" ? "nameInvalid" : "generic" };
  if (f.get("advance") === "1") await advance(db, uid, "holders");
  return { ok: true };
}

export type HolderResult = "owner" | "already" | "taken" | "inactive" | "not_found" | "released" | "not_holder" | "has_partners" | "ok" | "has_holders" | "error";

export async function claimVehicleAction(fleet: string): Promise<HolderResult> {
  const { db } = await session();
  const { data, error } = await db.rpc("claim_vehicle", { p_fleet_number: String(fleet).slice(0, 10) });
  return error ? "error" : (data as HolderResult);
}

export async function releaseVehicleAction(fleet: string): Promise<HolderResult> {
  const { db } = await session();
  const { data, error } = await db.rpc("release_vehicle", { p_fleet_number: String(fleet).slice(0, 10) });
  return error ? "error" : (data as HolderResult);
}

export async function setNoHolderAction(modelId: string, value: boolean): Promise<HolderResult> {
  const { db } = await session();
  const { data, error } = await db.rpc("set_no_holder", { p_model_id: String(modelId).slice(0, 20), p_value: Boolean(value) });
  return error ? "error" : (data as HolderResult);
}

export async function setStepAction(step: OnboardingStep, lang: string) {
  if (!ORDER.includes(step)) return;
  const { db, uid } = await session();
  await advance(db, uid, step);
  if (step === "done") redirect(`/${lang === "en" ? "en" : "bg"}/me`);
}

/** „Изтегли моите данни“ (GDPR) – всичко, което пазим за спотъра. */
export async function exportDataAction(): Promise<string> {
  const { db, uid, user } = await session();
  const [profile, holders, noHolder] = await Promise.all([
    db.from("profiles").select("*").eq("id", uid).single(),
    db.from("vehicle_holders").select("role,created_at,vehicles(fleet_number,model_id)").eq("user_id", uid),
    db.from("model_no_holder").select("model_id").eq("user_id", uid),
  ]);
  return JSON.stringify(
    {
      exported_at: new Date().toISOString(),
      account: {
        id: uid,
        email: user.email,
        created_at: user.created_at,
        email_confirmed_at: user.email_confirmed_at,
        last_sign_in_at: user.last_sign_in_at,
        providers: user.app_metadata?.providers ?? [],
      },
      profile: profile.data,
      holders: holders.data,
      no_holder_models: noHolder.data?.map((r) => r.model_id),
    },
    null,
    2
  );
}

/** Спотърът сам изтрива профила си. */
export async function deleteAccountAction(_: FormState, f: FormData): Promise<FormState> {
  const lang = f.get("lang") === "en" ? "en" : "bg";
  const word = lang === "en" ? "DELETE" : "ИЗТРИЙ";
  if (String(f.get("confirm") ?? "").trim() !== word) return { error: "deleteConfirm" };
  const { db, uid } = await session();

  // Снимката на профила
  const { data: files } = await db.storage.from("avatars").list(uid);
  if (files?.length) await db.storage.from("avatars").remove(files.map((x) => `${uid}/${x.name}`));

  const { error } = await createAdminClient().auth.admin.deleteUser(uid);
  if (error) return { error: "generic" };
  await db.auth.signOut();
  redirect(`/${lang}`);
}
