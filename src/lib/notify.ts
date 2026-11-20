import "server-only";

import * as webpush from "web-push";
import { layout, sendMail, SITE } from "./mail";
import { notifHref, notifText, type NotifData } from "./notif-text";
import { VAPID_PUBLIC_KEY } from "./push-public";
import { createAdminClient } from "./supabase/server";

const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? "";
if (VAPID_PRIVATE) webpush.setVapidDetails("mailto:busspotburgas@gmail.com", VAPID_PUBLIC_KEY, VAPID_PRIVATE);

type Email = {
  /** ключ в email_prefs; ако е false – не пращаме. Без ключ = винаги (покани за ортак). */
  pref?: string;
};

/**
 * Известие до спотъри: запис в камбанката + push (ако е разрешен) + по желание имейл.
 * Работи със секретния ключ – викай само след проверка на правата.
 */
export async function notifyUsers(userIds: (string | null | undefined)[], type: string, data: NotifData, email?: Email) {
  const ids = [...new Set(userIds.filter((x): x is string => Boolean(x)))];
  if (!ids.length) return;
  const db = createAdminClient();
  await db.from("notifications").insert(ids.map((user_id) => ({ user_id, type, data })));
  await deliver(ids, type, data, email);
}

/** Push + имейл за известия, които базата вече е записала (покани, гласуване). */
export async function deliver(ids: string[], type: string, data: NotifData, email?: Email) {
  const db = createAdminClient();
  const { data: profiles } = await db.from("profiles").select("id,locale,email_prefs").in("id", ids);
  const locale = new Map((profiles ?? []).map((p) => [p.id as string, (p.locale === "en" ? "en" : "bg") as "bg" | "en"]));

  // Push
  if (VAPID_PRIVATE) {
    const { data: subs } = await db.from("push_subscriptions").select("id,user_id,endpoint,p256dh,auth").in("user_id", ids);
    await Promise.all(
      (subs ?? []).map(async (s) => {
        const l = locale.get(s.user_id) ?? "bg";
        const payload = JSON.stringify({ title: "busspotburgas", body: notifText(type, data, l), url: notifHref(type, data, l) });
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 86400 });
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) await db.from("push_subscriptions").delete().eq("id", s.id); // абонаментът е изтекъл
        }
      })
    );
  }

  // Имейл
  if (email) {
    for (const p of profiles ?? []) {
      const prefs = (p.email_prefs as Record<string, boolean>) ?? {};
      if (email.pref && prefs[email.pref] === false) continue;
      const { data: u } = await db.auth.admin.getUserById(p.id);
      if (!u.user?.email) continue;
      const l = locale.get(p.id) ?? "bg";
      const title = notifText(type, data, l);
      const href = `${SITE}${notifHref(type, data, l)}`;
      await sendMail(
        u.user.email,
        `${title} · busspotburgas`,
        layout({
          title,
          lines: [],
          button: { label: l === "bg" ? "Отвори" : "Open", href },
          footer: email.pref
            ? l === "bg" ? "Можеш да спреш тези имейли от Настройки." : "You can turn off these emails in Settings."
            : l === "bg" ? "Поканите за ортаци идват винаги." : "Co-owner requests are always sent.",
        }),
        `${title}\n${href}`
      );
    }
  }
}

/** Админите получават push веднага, когато има нещо ново за одобрение. */
export async function pingAdmins() {
  const db = createAdminClient();
  const [{ data: admins }, { count: photos }, { count: comments }] = await Promise.all([
    db.from("profiles").select("id").eq("role", "admin"),
    db.from("photos").select("id", { count: "exact", head: true }).eq("status", "pending"),
    db.from("photo_comments").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);
  const ids = (admins ?? []).map((a) => a.id as string);
  if (ids.length) await deliver(ids, "admin_pending", { count: (photos ?? 0) + (comments ?? 0) });
}
