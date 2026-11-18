import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { QueueItem, ResolveClaim } from "@/components/QueueItem";
import { fmt } from "@/lib/fmt";
import { requireUser } from "@/lib/auth";
import { getDictionary, hasLocale, type Locale } from "@/lib/i18n";
import { getQueue } from "@/lib/photos";

export const metadata: Metadata = { robots: { index: false, follow: false } };

const GB = 1024 ** 3;
const mb = (b: number) => `${(b / 1024 ** 2).toFixed(1)} MB`;

export default async function QueuePage({ params }: PageProps<"/[lang]/admin/queue">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  return (
    <Suspense fallback={<div className="mx-auto h-96 max-w-3xl animate-pulse px-4 py-8" />}>
      <Queue lang={lang} />
    </Suspense>
  );
}

// Ролята и входът с код се проверяват на сървъра; базата пак проверява (RLS + is_admin()).
async function Queue({ lang }: { lang: Locale }) {
  const user = await requireUser(lang, `/${lang}/admin/queue`);
  const t = await getDictionary(lang);
  if (user.profile.role !== "admin" || user.aal !== "aal2") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center text-muted">
        {t.admin.notAdmin}{" "}
        <Link href={`/${lang}/admin`} className="font-semibold text-sea-600">{t.admin.title} →</Link>
      </div>
    );
  }
  const { photos, claims, usage } = await getQueue();
  const used = usage.reduce((s, u) => s + Number(u.bytes), 0);
  const pct = Math.min(100, (used / GB) * 100);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <Link href={`/${lang}/admin`} className="text-sm font-semibold text-sea-600 hover:underline">← {t.admin.title}</Link>
      <h1 className="font-display text-3xl font-extrabold">{t.queue.title} <span className="text-muted">· {photos.length}</span></h1>

      <section className="rounded-card border border-line bg-surface p-4 shadow-card">
        <div className="flex justify-between text-sm">
          <span className="font-semibold">{t.queue.storage}</span>
          <span className="text-muted">{fmt(t.queue.storageOf, { used: mb(used) })}</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-line">
          <div className={`h-full rounded-full ${pct > 85 ? "bg-scrapped" : "bg-sea-500"}`} style={{ width: `${pct}%` }} />
        </div>
        {pct > 85 && <p className="mt-2 text-sm font-semibold text-scrapped">{t.queue.storageWarn}</p>}
      </section>

      {photos.length === 0 ? (
        <p className="rounded-card border border-line bg-surface p-8 text-center text-muted">{t.queue.empty}</p>
      ) : (
        <ul className="space-y-5">
          {photos.map((p) => (
            <QueueItem key={p.id} p={p} lang={lang} t={{ queue: t.queue, reasons: t.reasons, kinds: t.kinds, upload: t.upload }} />
          ))}
        </ul>
      )}

      <section className="rounded-card border border-line bg-surface p-4 shadow-card">
        <h2 className="mb-3 font-display text-lg font-bold">{t.queue.claims}</h2>
        {claims.length === 0 ? (
          <p className="text-sm text-muted">{t.queue.claimsEmpty}</p>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {claims.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <b>{c.profiles?.display_name}</b>{" → "}
                  <Link href={`/${lang}/photo/${c.photo_id}`} className="text-sea-600 hover:underline">{c.photo_id.slice(0, 8)}</Link>
                  {c.note && <span className="text-muted"> – {c.note}</span>}
                </span>
                <ResolveClaim id={c.id} label={t.queue.resolve} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
