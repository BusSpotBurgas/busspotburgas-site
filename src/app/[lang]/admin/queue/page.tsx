import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { QueueItem, ResolveClaim } from "@/components/QueueItem";
import { fmt } from "@/lib/fmt";
import { requireUser } from "@/lib/auth";
import { getDictionary, hasLocale, type Locale } from "@/lib/i18n";
import { getQueue } from "@/lib/photos";
import { CommentReview, DescriptionReview, ElectionDecide, ReportResolve } from "@/components/AdminSocial";
import { getAdminSocialQueue } from "@/lib/social";
import { VideoReview } from "@/components/GameClient";

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
  const [{ photos, claims, usage }, social] = await Promise.all([getQueue(), getAdminSocialQueue()]);
  const labels = { approve: t.adminQ.approve, reject: t.adminQ.reject };
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
        <h2 className="mb-3 font-display text-lg font-bold">💬 {t.adminQ.comments} <span className="text-muted">· {social.comments.length}</span></h2>
        {social.comments.length === 0 ? <p className="text-sm text-muted">{t.adminQ.none}</p> : (
          <ul className="divide-y divide-line text-sm">
            {social.comments.map((c) => (
              <li key={c.id} className="flex flex-wrap items-start justify-between gap-2 py-2">
                <span className="min-w-0 flex-1">
                  <b>{c.profiles?.display_name}</b> · <Link href={`/${lang}/photo/${c.photo_id}`} className="num text-sea-600">{c.photos?.vehicles?.fleet_number}</Link>
                  <span className="block whitespace-pre-line break-words">{c.body}</span>
                </span>
                <CommentReview id={c.id} labels={labels} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-card border border-line bg-surface p-4 shadow-card">
        <h2 className="mb-3 font-display text-lg font-bold">🎬 {t.video.queue} <span className="text-muted">· {social.videos.length}</span></h2>
        {social.videos.length === 0 ? <p className="text-sm text-muted">{t.adminQ.none}</p> : (
          <ul className="divide-y divide-line text-sm">
            {social.videos.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="min-w-0 flex-1">
                  <span className="num font-bold">{v.vehicles?.fleet_number}</span> · <b>{v.profiles?.display_name}</b>
                  <a href={v.url} target="_blank" rel="noopener noreferrer nofollow" className="block truncate text-sea-600 underline">{v.url}</a>
                </span>
                <VideoReview id={v.id} labels={labels} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-card border border-line bg-surface p-4 shadow-card">
        <h2 className="mb-3 font-display text-lg font-bold">📝 {t.adminQ.descriptions} <span className="text-muted">· {social.descriptions.length}</span></h2>
        {social.descriptions.length === 0 ? <p className="text-sm text-muted">{t.adminQ.none}</p> : (
          <ul className="divide-y divide-line text-sm">
            {social.descriptions.map((d) => (
              <li key={d.vehicle_id} className="flex flex-wrap items-start justify-between gap-2 py-2">
                <span className="min-w-0 flex-1">
                  <Link href={`/${lang}/bus/${d.fleet_number}`} className="num font-bold text-sea-600">{d.fleet_number}</Link> · <b>{d.author}</b>
                  <span className="block whitespace-pre-line break-words">{d.pending || "—"}</span>
                  {d.approved && <span className="block text-xs text-muted">{t.adminQ.current}: {d.approved}</span>}
                </span>
                <DescriptionReview vehicleId={d.vehicle_id} fleet={d.fleet_number} labels={labels} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-card border border-line bg-surface p-4 shadow-card">
        <h2 className="mb-1 font-display text-lg font-bold">🗳 {t.adminQ.elections} <span className="text-muted">· {social.elections.length}</span></h2>
        <p className="mb-3 text-xs text-muted">{t.adminQ.electionsLead}</p>
        {social.elections.length === 0 ? <p className="text-sm text-muted">{t.adminQ.none}</p> : (
          <ul className="space-y-2 text-sm">
            {social.elections.map((e) => (
              <li key={e.id} className="space-y-1">
                <Link href={`/${lang}/bus/${e.fleet}`} className="num font-bold text-sea-600">{e.fleet}</Link>
                <ElectionDecide id={e.id} candidates={e.candidates} label={t.adminQ.choose} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-card border border-line bg-surface p-4 shadow-card">
        <h2 className="mb-3 font-display text-lg font-bold">🚩 {t.adminQ.reports} <span className="text-muted">· {social.reports.length}</span></h2>
        {social.reports.length === 0 ? <p className="text-sm text-muted">{t.adminQ.none}</p> : (
          <ul className="divide-y divide-line text-sm">
            {social.reports.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span><b>{r.profiles?.display_name}</b> → {r.target_type} #{r.target_id.slice(0, 8)}{r.reason ? ` – ${r.reason}` : ""}</span>
                <ReportResolve id={r.id} label={t.adminQ.resolve} />
              </li>
            ))}
          </ul>
        )}
      </section>

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
