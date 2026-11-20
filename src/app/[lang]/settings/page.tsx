import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { ProfileForm } from "@/components/ProfileForm";
import { DeleteAccount, DownloadData, EmailPref } from "@/components/SettingsParts";
import { PushToggle } from "@/components/Push";
import { createSessionClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { getDictionary, hasLocale, type Locale } from "@/lib/i18n";

export const metadata: Metadata = { robots: { index: false } };

export default async function SettingsPage({ params }: PageProps<"/[lang]/settings">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  return (
    <Suspense fallback={<div className="mx-auto h-96 max-w-2xl animate-pulse px-4 py-8" />}>
      <Settings lang={lang} />
    </Suspense>
  );
}

function Section({ title, lead, children, danger }: { title: string; lead?: string; children: ReactNode; danger?: boolean }) {
  return (
    <section className={`rounded-card border bg-surface p-5 shadow-card sm:p-6 ${danger ? "border-scrapped/25" : "border-line"}`}>
      <h2 className={`font-display text-lg font-bold ${danger ? "text-scrapped" : ""}`}>{title}</h2>
      {lead && <p className="mt-1 text-sm text-muted">{lead}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

async function Settings({ lang }: { lang: Locale }) {
  const user = await requireUser(lang, `/${lang}/settings`);
  const t = await getDictionary(lang);
  const { data: prefs } = await (await createSessionClient()).from("profiles").select("email_prefs").eq("id", user.id).single();
  const emailPrefs = (prefs?.email_prefs as Record<string, boolean>) ?? {};
  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 py-8">
      <h1 className="font-display text-3xl font-extrabold">{t.settings.title}</h1>

      <Section title={t.settings.profileSection}>
        <ProfileForm
          uid={user.id}
          t={{ onboarding: t.onboarding, errors: t.errors, settings: t.settings }}
          initial={user.profile}
          submitLabel={t.settings.save}
        />
      </Section>

      <Section title={t.settings.holdersSection}>
        <Link href={`/${lang}/settings/holders`} className="font-semibold text-sea-600 hover:underline">
          {t.settings.holdersLink} →
        </Link>
      </Section>

      <Section title={t.settingsEmail.title}>
        <div className="space-y-3">
          <EmailPref name="photo_review" label={t.settingsEmail.photoReview} initial={emailPrefs.photo_review !== false} />
          <EmailPref name="owner_vote" label={t.notif.ownerVoteEmail} initial={emailPrefs.owner_vote !== false} />
        </div>
      </Section>

      <Section title={t.notif.pushTitle}>
        <PushToggle t={t.notif} />
      </Section>

      <Section title={t.settings.dataSection} lead={t.settings.dataLead}>
        <DownloadData label={t.settings.download} />
      </Section>

      <Section title={t.settings.deleteSection} lead={t.settings.deleteLead} danger>
        <DeleteAccount lang={lang} t={{ settings: t.settings, errors: t.errors }} />
      </Section>
    </div>
  );
}
