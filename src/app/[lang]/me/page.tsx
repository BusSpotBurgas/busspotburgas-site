import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { HoldersList, ProfileHeader } from "@/components/ProfileCard";
import { requireUser } from "@/lib/auth";
import { signOutAction } from "@/lib/auth-actions";
import { getHolderData } from "@/lib/holders";
import { CancelInvite, InviteAnswer, VoteOwner } from "@/components/Social";
import { fmt } from "@/lib/fmt";
import { getHoldersActivity } from "@/lib/social";
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
  const [t, data, activity] = await Promise.all([getDictionary(lang), getHolderData(user.id), getHoldersActivity(user.id)]);
  const hasActivity = activity.forMe.length + activity.mine.length + activity.elections.length > 0;
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
        <Link href={`/${lang}/me/photos`} className="rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-semibold hover:border-sea-300">
          📷 {t.myPhotos.title}
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

      {hasActivity && (
        <section id="holders-activity" className="space-y-3 rounded-card border border-sea-200 bg-sea-50/60 p-5">
          <h2 className="font-display text-xl font-bold">🤝 {t.social.holdersActivity}</h2>
          {activity.forMe.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-semibold">{t.social.invitesForMe}</p>
              <ul className="space-y-2">
                {activity.forMe.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface p-3 text-sm">
                    <span>
                      <b>{i.profiles?.display_name}</b> → <Link href={`/${lang}/bus/${i.vehicles?.fleet_number}`} className="num font-bold text-sea-600">{i.vehicles?.fleet_number}</Link>
                      {i.message && <span className="block text-muted">„{i.message}“</span>}
                    </span>
                    <InviteAnswer id={i.id} t={t.social} />
                  </li>
                ))}
              </ul>
            </div>
          )}
          {activity.elections.map((e) => (
            <div key={e.id} className="rounded-xl bg-surface p-3 text-sm">
              <p className="mb-2"><b>🗳 {t.social.vote}</b> · <span className="num font-bold">{e.fleet}</span> · <span className="text-muted">{fmt(t.social.votesUntil, { date: new Date(e.ends_at).toLocaleDateString(lang === "bg" ? "bg-BG" : "en-GB") })}</span></p>
              <VoteOwner election={e.id} candidates={e.candidates} myVote={e.myVote} t={t.social} />
            </div>
          ))}
          {activity.mine.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-semibold">{t.social.myRequests}</p>
              <ul className="space-y-1 text-sm">
                {activity.mine.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-2">
                    <span><span className="num font-bold">{i.vehicles?.fleet_number}</span> · <span className="text-muted">{t.social.waiting}</span></span>
                    <CancelInvite id={i.id} t={t.social} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

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
