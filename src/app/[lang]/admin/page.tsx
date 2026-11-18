import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { MfaEnroll, MfaFactors } from "@/components/Mfa";
import { requireUser } from "@/lib/auth";
import { getDictionary, hasLocale, type Locale } from "@/lib/i18n";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AdminPage({ params }: PageProps<"/[lang]/admin">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  return (
    <Suspense fallback={<div className="mx-auto h-96 max-w-3xl animate-pulse px-4 py-8" />}>
      <Admin lang={lang} />
    </Suspense>
  );
}

// Ролята се проверява тук, на сървъра. В базата всяко админ действие изисква и роля, и вход с код (RLS).
async function Admin({ lang }: { lang: Locale }) {
  const user = await requireUser(lang, `/${lang}/admin`); // при включена 2FA → първо код
  const t = await getDictionary(lang);
  const tt = { auth: t.auth, errors: t.errors, admin: t.admin };

  if (user.profile.role !== "admin") {
    return <p className="mx-auto max-w-3xl px-4 py-16 text-center text-muted">{t.admin.notAdmin}</p>;
  }

  if (user.aal !== "aal2") {
    return (
      <div className="mx-auto max-w-md px-4 py-10">
        <h1 className="font-display text-2xl font-extrabold">{t.admin.enrollTitle}</h1>
        <p className="mt-2 mb-6 text-sm text-muted">{t.admin.enrollLead}</p>
        <div className="rounded-card border border-line bg-surface p-5 shadow-card">
          <MfaEnroll t={tt} friendlyName="admin" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <h1 className="font-display text-3xl font-extrabold">🛡 {t.admin.title}</h1>
      <Link href={`/${lang}/admin/queue`} className="flex items-center justify-between rounded-card border border-line bg-surface p-5 shadow-card transition hover:border-sea-300">
        <span className="font-display text-lg font-bold">📥 {t.queue.title}</span>
        <span className="font-semibold text-sea-600">{t.queue.open} →</span>
      </Link>
      <p className="rounded-card border border-sea-100 bg-sea-50 p-4 text-sm text-sea-800">{t.admin.dashboardLead}</p>
      <section className="rounded-card border border-line bg-surface p-5 shadow-card">
        <h2 className="mb-3 font-display text-lg font-bold">{t.admin.factors}</h2>
        <MfaFactors t={tt} />
      </section>
    </div>
  );
}
