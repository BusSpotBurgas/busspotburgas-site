// Всеки ден в 18:00 българско време (16:00 UTC; през лятото – 19:00):
//  1) обобщение до админите – какво чака одобрение;
//  2) изтриване на отказани и непоправени снимки, по-стари от 30 дни;
//  3) предупреждение, ако мястото за снимки свършва.
// Работи със секретния ключ на Supabase и Gmail паролата (само в Netlify).
import type { Config } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

const SITE = process.env.URL ?? "https://busspotburgas.netlify.app";
const GB = 1024 ** 3;

const daily = async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return new Response("missing env", { status: 500 });
  const db = createClient(url, key, { auth: { persistSession: false } });

  // 2) Почистване
  const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const { data: old } = await db.from("photos").select("id,user_id").eq("status", "rejected").lt("reviewed_at", cutoff).limit(200);
  for (const p of old ?? []) {
    if (p.user_id) await db.storage.from("photos-private").remove(["original", "display", "thumb"].map((f) => `${p.user_id}/${p.id}/${f}`));
    await db.storage.from("photos-public").remove([`${p.id}/display`, `${p.id}/thumb`]);
    await db.from("photos").delete().eq("id", p.id);
  }

  // 1) + 3) Обобщение за админите
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const [{ count: pending }, { count: claims }, { count: newUsers }, usage] = await Promise.all([
    db.from("photos").select("id", { count: "exact", head: true }).eq("status", "pending"),
    db.from("photo_claims").select("id", { count: "exact", head: true }).eq("resolved", false),
    db.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", since),
    db.rpc("storage_usage"),
  ]);
  const used = ((usage.data ?? []) as { bytes: number }[]).reduce((s, u) => s + Number(u.bytes), 0);
  const pct = Math.round((used / GB) * 100);
  const lowSpace = pct >= 85;

  const pass = process.env.GMAIL_APP_PASSWORD;
  if (pass && ((pending ?? 0) > 0 || (claims ?? 0) > 0 || lowSpace)) {
    const { data: admins } = await db.from("profiles").select("id").eq("role", "admin");
    const emails: string[] = [];
    for (const a of admins ?? []) {
      const { data } = await db.auth.admin.getUserById(a.id);
      if (data.user?.email) emails.push(data.user.email);
    }
    if (emails.length) {
      const lines = [
        `Снимки за одобрение: ${pending ?? 0}`,
        `Спорове за авторство: ${claims ?? 0}`,
        `Нови спотъри за 24 ч: ${newUsers ?? 0}`,
        `Място за снимки: ${(used / 1024 ** 2).toFixed(0)} MB от 1 GB (${pct}%)${lowSpace ? " – СВЪРШВА!" : ""}`,
        `Изтрити стари отказани снимки: ${old?.length ?? 0}`,
      ];
      const t = nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user: process.env.GMAIL_USER ?? "busspotburgas@gmail.com", pass } });
      await t.sendMail({
        from: `"busspotburgas" <${process.env.GMAIL_USER ?? "busspotburgas@gmail.com"}>`,
        to: emails.join(","),
        subject: `Обобщение за деня · ${pending ?? 0} за одобрение · busspotburgas`,
        text: `${lines.join("\n")}\n\n${SITE}/bg/admin/queue`,
        html: `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#0F1B26"><h2 style="margin:0 0 12px">Обобщение за деня</h2>${lines
          .map((l) => `<div>${l.replace(/[<>&]/g, "")}</div>`)
          .join("")}<p style="margin-top:18px"><a href="${SITE}/bg/admin/queue" style="background:#0B6FA4;color:#fff;padding:10px 16px;border-radius:10px;text-decoration:none;font-weight:700">Към опашката</a></p></div>`,
      });
    }
  }
  return new Response("ok");
};

export default daily;

export const config: Config = { schedule: "0 16 * * *" };
