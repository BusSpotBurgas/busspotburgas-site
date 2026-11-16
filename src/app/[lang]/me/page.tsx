import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { HoldersList, ProfileHeader } from "@/components/ProfileCard";
import { requireUser } from "@/lib/auth";
import { signOutAction } from "@/lib/auth-actions";
import { getHolderData } from "@/lib/holders";
import { getDictionary, hasLocale, type Locale } from "@/lib/i18n";

export const metadata: Metadata = { robots: { index: false } };

export default async function MePage({ params }: PageProps<"/[lang]/me">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  return (
    <Suspense fallback={<div className="mx-auto h-96 max-w-4xl animate-pulse px-4 py-8" />}>
      <Me lang={lang} />
    </Suspense>
  );
}

async function Me({ lang }: { lang: Locale }) {
  const user = await requireUser(lang, `/${lang}/me`);
  if (user.profile.onboarding_step !== "done") redirect(`/${lang}/onboarding`);
  const [t, data] = await Promise.all([getDictionary(lang), getHolderData(user.id)]);
  const p = user.profile;
  const isAdmin = p.role === "admin";

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      {!user.emailConfirmed && (
        <p className="rounded-card border border-stop/30 bg-sand p-4 text-sm">{t.me.emailUnconfirmed}</p>
      )}
      <ProfileHeader
        name={p.display_name ?? "—"}
        avatar={p.avatar_url}
        tiktok={p.tiktok}
        isAdmin={isAdmin}
        rank={t.me.rank}
        points={0}
        pointsLabel={t.me.points}
      />

      <div className="flex flex-wrap gap-2">
        <Link href={`/${lang}/settings`} className="rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-semibold hover:border-sea-300">
          ⚙ {t.me.settings}
        </Link>
        <Link href={`/${lang}/spotter/${user.id}`} className="rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-semibold hover:border-sea-300">
          👁 {t.me.publicProfile}
        </Link>
        {isAdmin && (
          <Link href={`/${lang}/admin`} className="rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white">
            🛡 {t.nav.admin}
          </Link>
        )}
        <form action={signOutAction} className="ml-auto">
          <input type="hidden" name="lang" value={lang} />
          <button className="rounded-xl px-4 py-2.5 text-sm font-semibold text-muted hover:text-scrapped">{t.nav.signOut}</button>
        </form>
      </div>

      <section>
        <h2 className="mb-3 font-display text-xl font-bold">{t.me.holders}</h2>
        <HoldersList
          models={data.models}
          numbers={data.vehicles.filter((v) => v.owner === "me")}
          noHolder={data.noHolder}
          emptyLabel={t.me.noHolders}
          noneLabel={t.me.noHolderModels}
        />
      </section>
    </div>
  );
}
