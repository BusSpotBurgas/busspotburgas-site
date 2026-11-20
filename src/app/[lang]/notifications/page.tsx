import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { MarkRead, PushToggle } from "@/components/Push";
import { requireUser } from "@/lib/auth";
import { getDictionary, hasLocale, type Locale } from "@/lib/i18n";
import { notifHref, notifText, type NotifData } from "@/lib/notif-text";
import { getNotifications } from "@/lib/social";

export const metadata: Metadata = { robots: { index: false } };

export default async function NotificationsPage({ params }: PageProps<"/[lang]/notifications">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  return (
    <Suspense fallback={<div className="mx-auto h-96 max-w-2xl animate-pulse px-4 py-8" />}>
      <Notifications lang={lang} />
    </Suspense>
  );
}

async function Notifications({ lang }: { lang: Locale }) {
  const user = await requireUser(lang, `/${lang}/notifications`);
  const [t, list] = await Promise.all([getDictionary(lang), getNotifications(user.id)]);
  const fmt = (s: string) => new Date(s).toLocaleString(lang === "bg" ? "bg-BG" : "en-GB", { dateStyle: "short", timeStyle: "short" });
  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 py-8">
      <MarkRead />
      <h1 className="font-display text-3xl font-extrabold">{t.notif.title}</h1>
      <section className="rounded-card border border-line bg-surface p-5 shadow-card">
        <h2 className="mb-2 font-display text-lg font-bold">{t.notif.pushTitle}</h2>
        <PushToggle t={t.notif} />
      </section>
      {list.length === 0 ? (
        <p className="rounded-card border border-line bg-surface p-6 text-center text-muted">{t.notif.empty}</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface shadow-card">
          {list.map((n) => (
            <li key={n.id}>
              <Link href={notifHref(n.type, n.data as NotifData, lang)} className={`flex items-start gap-3 px-4 py-3 hover:bg-canvas ${n.read_at ? "" : "bg-sea-50/60"}`}>
                {!n.read_at && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-sea-500" />}
                <span className="flex-1 text-sm">{notifText(n.type, n.data as NotifData, lang)}</span>
                <span className="shrink-0 text-xs text-muted">{fmt(n.created_at)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
