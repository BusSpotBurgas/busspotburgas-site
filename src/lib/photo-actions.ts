"use server";

import { updateTag } from "next/cache";
import { getCurrentUser } from "./auth";
import { layout, sendMail, SITE } from "./mail";
import { deliver, notifyUsers, pingAdmins } from "./notify";
import {
  FILE_LIMITS,
  LINE_RE,
  PHOTO_FILES,
  PHOTO_KINDS,
  REJECT_REASONS,
  UUID_RE,
  publicPhotoUrl,
  type PhotoKind,
  type RejectReason,
} from "./photo-shared";
import { createAdminClient, createSessionClient } from "./supabase/server";

export type ActionResult = { ok?: boolean; error?: string; id?: string; status?: string };

const clean = (v: unknown, max: number) => String(v ?? "").trim().replace(/\s+/g, " ").slice(0, max);

// ── Проверка на файл: да няма EXIF/XMP (GPS) ─────────────────────────────
function hasMetadata(buf: Uint8Array): boolean {
  // WebP: RIFF....WEBP + парчета; търсим EXIF и XMP
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) {
    let i = 12;
    while (i + 8 <= buf.length) {
      const tag = String.fromCharCode(buf[i], buf[i + 1], buf[i + 2], buf[i + 3]);
      const size = buf[i + 4] | (buf[i + 5] << 8) | (buf[i + 6] << 16) | (buf[i + 7] << 24);
      if (tag === "EXIF" || tag === "XMP ") return true;
      i += 8 + size + (size & 1);
    }
    return false;
  }
  // JPEG: маркер APP1 (EXIF/XMP)
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 4 <= buf.length && buf[i] === 0xff) {
      const marker = buf[i + 1];
      if (marker === 0xe1) return true;
      if (marker === 0xda) return false; // започват самите пиксели
      i += 2 + ((buf[i + 2] << 8) | buf[i + 3]);
    }
    return false;
  }
  return true; // непознат формат
}

/** Проверява трите качени файла в частната папка на спотъра. */
async function verifyUpload(uid: string, id: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data: list, error } = await admin.storage.from("photos-private").list(`${uid}/${id}`);
  if (error || !list) return "upload_missing";
  for (const f of PHOTO_FILES) {
    const obj = list.find((o) => o.name === f);
    const size = Number(obj?.metadata?.size ?? 0);
    const type = String(obj?.metadata?.mimetype ?? "");
    if (!obj || size <= 0 || size > FILE_LIMITS[f] || !["image/webp", "image/jpeg"].includes(type)) return "upload_invalid";
    const { data: blob } = await admin.storage.from("photos-private").download(`${uid}/${id}/${f}`);
    if (!blob || hasMetadata(new Uint8Array(await blob.arrayBuffer()))) return "upload_metadata";
  }
  return null;
}

/** Премества display + thumb в публичната кофа (при одобрение). */
async function publish(uid: string | null, id: string) {
  if (!uid) return;
  const admin = createAdminClient();
  for (const f of ["display", "thumb"] as const) {
    await admin.storage.from("photos-public").remove([`${id}/${f}`]);
    const { error } = await admin.storage
      .from("photos-private")
      .copy(`${uid}/${id}/${f}`, `${id}/${f}`, { destinationBucket: "photos-public" });
    if (error) throw error;
  }
}

async function unpublish(id: string) {
  await createAdminClient().storage.from("photos-public").remove([`${id}/display`, `${id}/thumb`]);
}

/** След одобрение: автор (камбанка), титуляри на колата и последователи на автора/колата. */
async function fanOutApproved(photoId: string) {
  try {
    const admin = createAdminClient();
    const { data: p } = await admin.from("photos").select("user_id,author_name,vehicle_id,vehicles(fleet_number)").eq("id", photoId).single();
    if (!p) return;
    const fleet = (p.vehicles as unknown as { fleet_number: string } | null)?.fleet_number ?? "";
    const data = { fleet, photo: photoId, author: p.author_name ?? "" };
    const [{ data: holders }, { data: followers }] = await Promise.all([
      admin.from("vehicle_holders").select("user_id").eq("vehicle_id", p.vehicle_id),
      admin
        .from("follows")
        .select("user_id")
        .or(`and(target_type.eq.vehicle,target_id.eq.${fleet}),and(target_type.eq.spotter,target_id.eq.${p.user_id ?? "-"})`),
    ]);
    const holderIds = (holders ?? []).map((h) => h.user_id as string).filter((id) => id !== p.user_id);
    const followerIds = (followers ?? []).map((f) => f.user_id as string).filter((id) => id !== p.user_id && !holderIds.includes(id));
    await notifyUsers([p.user_id], "photo_approved", data);
    // Значки и рангове: базата ги записва сама – тук само пращаме push
    if (p.user_id) {
      const since = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      const { data: fresh } = await admin.from("notifications").select("type,data").eq("user_id", p.user_id).in("type", ["badge", "rank"]).gte("created_at", since);
      for (const n of fresh ?? []) await deliver([p.user_id], n.type as string, n.data as Record<string, string>);
    }
    await notifyUsers(holderIds, "holder_new_photo", data);
    await notifyUsers(followerIds, "follow_photo", data);
  } catch (e) {
    console.error("fanout:", e);
  }
}

function refresh() {
  updateTag("photos");
  updateTag("fleet");
}

// ── Спотър ───────────────────────────────────────────────────────────────

export async function findSimilarAction(dhash: string) {
  if (!/^[0-9a-f]{16}$/.test(dhash)) return [];
  const db = await createSessionClient();
  const { data } = await db.rpc("find_similar_photos", { p_dhash: dhash });
  return (data ?? []) as { photo_id: string; author_name: string; fleet_number: string; distance: number }[];
}

export async function submitPhotoAction(input: {
  id: string;
  fleet: string;
  kind: string;
  line: string;
  place: string;
  ad?: string;
  description?: string;
  rights: boolean;
  width: number;
  height: number;
  dhash: string;
  takenAt: string | null;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "not_authenticated" };
  if (!user.emailConfirmed) return { error: "emailNotConfirmed" };
  if (!UUID_RE.test(input.id)) return { error: "generic" };

  const kind = input.kind as PhotoKind;
  const line = clean(input.line, 12);
  const place = clean(input.place, 80);
  if (!PHOTO_KINDS.includes(kind)) return { error: "kind" };
  if (!LINE_RE.test(line)) return { error: "line" };
  if (place.length < 2) return { error: "place" };
  if (!/^[0-9a-f]{16}$/.test(input.dhash)) return { error: "generic" };

  const db = await createSessionClient();
  const { data: v } = await db.from("vehicles").select("id").eq("fleet_number", clean(input.fleet, 10)).maybeSingle();
  if (!v) return { error: "vehicle" };

  const bad = await verifyUpload(user.id, input.id);
  if (bad) return { error: bad };

  const { data: row, error } = await db
    .from("photos")
    .insert({
      id: input.id,
      vehicle_id: v.id,
      user_id: user.id,
      kind,
      line,
      place,
      ad: clean(input.ad, 80) || null,
      description: clean(input.description, 500) || null,
      rights_shared: Boolean(input.rights),
      width: Math.round(input.width),
      height: Math.round(input.height),
      dhash: input.dhash,
    })
    .select("id,status")
    .single();
  if (error || !row) {
    console.error("photo insert:", error);
    return { error: error?.message?.includes("email_not_confirmed") ? "emailNotConfirmed" : "generic" };
  }

  const taken = input.takenAt && !isNaN(Date.parse(input.takenAt)) ? new Date(input.takenAt).toISOString() : null;
  await db.from("photo_private").insert({ photo_id: row.id, taken_at: taken });

  if (row.status === "approved") {
    await publish(user.id, row.id); // снимка на админа – веднага
    refresh();
    await fanOutApproved(row.id);
  } else {
    await pingAdmins(); // push до админите: ново за одобрение
  }
  return { ok: true, id: row.id, status: row.status };
}

/** Авторът поправя отказана/чакаща снимка → отива отново за одобрение. */
export async function editPhotoAction(id: string, input: { fleet: string; kind: string; line: string; place: string; ad?: string; description?: string }): Promise<ActionResult> {
  if (!UUID_RE.test(id)) return { error: "generic" };
  const db = await createSessionClient();
  const kind = input.kind as PhotoKind;
  const line = clean(input.line, 12);
  const place = clean(input.place, 80);
  if (!PHOTO_KINDS.includes(kind)) return { error: "kind" };
  if (!LINE_RE.test(line)) return { error: "line" };
  if (place.length < 2) return { error: "place" };
  const { data: v } = await db.from("vehicles").select("id").eq("fleet_number", clean(input.fleet, 10)).maybeSingle();
  if (!v) return { error: "vehicle" };
  const { error } = await db
    .from("photos")
    .update({ vehicle_id: v.id, kind, line, place, ad: clean(input.ad, 80) || null, description: clean(input.description, 500) || null })
    .eq("id", id);
  if (error) return { error: "generic" };
  await pingAdmins();
  return { ok: true };
}

export async function deletePhotoAction(id: string): Promise<ActionResult> {
  if (!UUID_RE.test(id)) return { error: "generic" };
  const user = await getCurrentUser();
  if (!user) return { error: "not_authenticated" };
  const db = await createSessionClient();
  const { data: p } = await db.from("photos").select("id,user_id").eq("id", id).maybeSingle();
  if (!p) return { error: "generic" };
  const { error } = await db.from("photos").delete().eq("id", id); // RLS: автор или админ
  if (error) return { error: "generic" };
  const admin = createAdminClient();
  if (p.user_id) await admin.storage.from("photos-private").remove(PHOTO_FILES.map((f) => `${p.user_id}/${id}/${f}`));
  await unpublish(id);
  refresh();
  return { ok: true };
}

/** Сваляне в пълен размер (2048 px, без воден знак) – само авторът. */
export async function originalUrlAction(id: string): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user || !UUID_RE.test(id)) return null;
  const db = await createSessionClient();
  const { data: p } = await db.from("photos").select("user_id").eq("id", id).maybeSingle();
  if (!p || p.user_id !== user.id) return null;
  const { data } = await db.storage.from("photos-private").createSignedUrl(`${user.id}/${id}/original`, 120, { download: `busspot-${id.slice(0, 8)}.webp` });
  return data?.signedUrl ?? null;
}

/** „Това е моя снимка“. */
export async function claimPhotoAction(id: string, note: string): Promise<ActionResult> {
  if (!UUID_RE.test(id)) return { error: "generic" };
  const user = await getCurrentUser();
  if (!user) return { error: "not_authenticated" };
  const db = await createSessionClient();
  const { error } = await db.from("photo_claims").insert({ photo_id: id, user_id: user.id, note: clean(note, 300) || null });
  return error ? { error: error.code === "23505" ? "already" : "generic" } : { ok: true };
}

// ── Админ ────────────────────────────────────────────────────────────────

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.profile.role !== "admin" || user.aal !== "aal2") throw new Error("not_admin");
  return user;
}

const REASON_TEXT: Record<RejectReason, { bg: string; en: string }> = {
  blurry: { bg: "размазана", en: "blurry" },
  wrong_number: { bg: "грешен номер", en: "wrong fleet number" },
  duplicate: { bg: "дубликат", en: "duplicate" },
  not_own: { bg: "не е твоя снимка", en: "not your photo" },
  other: { bg: "друго", en: "other" },
};

async function notifyAuthor(photoId: string, kind: "approved" | "rejected" | "edited") {
  try {
    const admin = createAdminClient();
    const { data: p } = await admin
      .from("photos")
      .select("user_id,line,reject_reason,reject_note,vehicles(fleet_number),profiles:user_id(locale,email_prefs)")
      .eq("id", photoId)
      .single();
    const row = p as unknown as {
      user_id: string | null;
      line: string;
      reject_reason: RejectReason | null;
      reject_note: string | null;
      vehicles: { fleet_number: string } | null;
      profiles: { locale: string; email_prefs: Record<string, boolean> } | null;
    } | null;
    if (!row?.user_id || row.profiles?.email_prefs?.photo_review === false) return;
    const { data: u } = await admin.auth.admin.getUserById(row.user_id);
    const email = u.user?.email;
    if (!email) return;
    const en = row.profiles?.locale === "en";
    const num = row.vehicles?.fleet_number ?? "";
    const lang = en ? "en" : "bg";
    const t = {
      approved: { s: en ? `Your photo of ${num} is approved` : `Снимката ти на ${num} е одобрена`, l: en ? "It is now visible to everyone." : "Вече се вижда от всички." },
      edited: { s: en ? `The admin corrected your photo of ${num}` : `Админът поправи снимката ти на ${num}`, l: en ? `The fleet number or line was corrected (now: ${num}, line ${row.line}).` : `Номерът или линията бяха поправени (сега: ${num}, линия ${row.line}).` },
      rejected: {
        s: en ? `Your photo of ${num} was not approved` : `Снимката ти на ${num} не е одобрена`,
        l: `${en ? "Reason" : "Причина"}: ${row.reject_reason ? REASON_TEXT[row.reject_reason][lang] : "—"}${row.reject_note ? ` – ${row.reject_note}` : ""}`,
      },
    }[kind];
    const lines = [t.l];
    if (kind === "rejected") lines.push(en ? "You can fix it and send it again within 30 days." : "Можеш да я поправиш и да я изпратиш отново до 30 дни.");
    const href = kind === "rejected" ? `${SITE}/${lang}/me` : `${SITE}/${lang}/photo/${photoId}`;
    const html = layout({
      title: t.s,
      lines,
      image: kind === "rejected" ? undefined : publicPhotoUrl(photoId, "thumb"),
      button: { label: en ? "Open" : "Отвори", href },
      footer: en ? "You can turn off these emails in Settings." : "Можеш да спреш тези имейли от Настройки.",
    });
    await sendMail(email, `${t.s} · busspotburgas`, html, `${t.s}\n${lines.join("\n")}\n${href}`);
  } catch (e) {
    console.error("notify:", e);
  }
}

export async function approvePhotoAction(id: string, flags: { night: boolean; rain: boolean }): Promise<ActionResult> {
  await requireAdmin();
  if (!UUID_RE.test(id)) return { error: "generic" };
  const db = await createSessionClient();
  const { data: p, error } = await db
    .from("photos")
    .update({ status: "approved", reviewed_at: new Date().toISOString(), reject_reason: null, reject_note: null, is_night: !!flags.night, is_rain: !!flags.rain })
    .eq("id", id)
    .select("user_id")
    .single();
  if (error || !p) return { error: "generic" };
  await publish(p.user_id, id);
  refresh();
  await fanOutApproved(id);
  await notifyAuthor(id, "approved");
  return { ok: true };
}

export async function rejectPhotoAction(id: string, reason: string, note: string): Promise<ActionResult> {
  await requireAdmin();
  if (!UUID_RE.test(id) || !REJECT_REASONS.includes(reason as RejectReason)) return { error: "generic" };
  const db = await createSessionClient();
  const { error } = await db
    .from("photos")
    .update({ status: "rejected", reviewed_at: new Date().toISOString(), reject_reason: reason, reject_note: clean(note, 300) || null })
    .eq("id", id);
  if (error) return { error: "generic" };
  await unpublish(id);
  refresh();
  const { data: who } = await db.from("photos").select("user_id,vehicles(fleet_number)").eq("id", id).single();
  await notifyUsers([who?.user_id], "photo_rejected", { fleet: (who?.vehicles as unknown as { fleet_number: string } | null)?.fleet_number ?? "" });
  await notifyAuthor(id, "rejected");
  return { ok: true };
}

/** Админът поправя номер/линия преди одобрение – авторът получава известие. */
export async function adminEditPhotoAction(id: string, fleet: string, line: string): Promise<ActionResult> {
  await requireAdmin();
  if (!UUID_RE.test(id)) return { error: "generic" };
  const l = clean(line, 12);
  if (!LINE_RE.test(l)) return { error: "line" };
  const db = await createSessionClient();
  const { data: v } = await db.from("vehicles").select("id").eq("fleet_number", clean(fleet, 10)).maybeSingle();
  if (!v) return { error: "vehicle" };
  const { error } = await db.from("photos").update({ vehicle_id: v.id, line: l, edited_by_admin: true }).eq("id", id);
  if (error) return { error: "generic" };
  const { data: who } = await db.from("photos").select("user_id").eq("id", id).single();
  await notifyUsers([who?.user_id], "photo_edited", { fleet: clean(fleet, 10), photo: id });
  await notifyAuthor(id, "edited");
  return { ok: true };
}

export async function resolveClaimAction(claimId: number): Promise<ActionResult> {
  await requireAdmin();
  const db = await createSessionClient();
  const { error } = await db.from("photo_claims").update({ resolved: true }).eq("id", claimId);
  return error ? { error: "generic" } : { ok: true };
}
