import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { fmt } from "@/lib/fmt";
import { getLeaderboard, getMonthly, getMyPotmVote } from "@/lib/game";
import type { Dictionary } from "@/lib/i18n";
import { publicPhotoUrl } from "@/lib/photo-shared";
import { PotmVoteButton } from "./GameClient";
import { Avatar } from "./ProfileForm";

/** Най-горе на началната: снимката на месеца (цял месец), с автор и „Създай профил“. */
export async function PhotoOfMonthHero({ lang, t }: { lang: string; t: Dictionary }) {
  const m = await getMonthly();
  if (!m.award?.photo_id) return null;
  const month = new Date(m.award.month).toLocaleDateString(lang === "bg" ? "bg-BG" : "en-GB", { month: "long", year: "numeric" });
  return (
    <section className="relative overflow-hidden bg-ink">
      <Link href={`/${lang}/photo/${m.award.photo_id}`} className="block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={publicPhotoUrl(m.award.photo_id, "display")} alt="" className="mx-auto max-h-[70dvh] w-full object-cover opacity-90" />
      </Link>
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent">
        <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-3 px-4 pb-5 pt-16 text-white">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-sea-200">🏆 {t.game.potmTitle} · {month}</p>
            <p className="font-display text-2xl font-extrabold">{fmt(t.game.potmBy, { author: m.authorName ?? "" })}</p>
          </div>
          <Link href={`/${lang}/register`} className="rounded-xl bg-white px-4 py-2.5 font-semibold text-ink hover:bg-sea-50">
            {t.game.createProfile}
          </Link>
        </div>
      </div>
    </section>
  );
}

/** Гласуване (последните 3 дни) + спотър на месеца + топ спотъри. */
export async function MonthlyBlock({ lang, t }: { lang: string; t: Dictionary }) {
  const [m, top, user] = await Promise.all([getMonthly(), getLeaderboard("month", undefined, 5), getCurrentUser()]);
  const voting = m.window?.voting && m.candidates.length > 0;
  const myVote = voting && user && m.window ? await getMyPotmVote(user.id, m.window.month) : null;

  return (
    <section className="mx-auto grid max-w-6xl gap-4 px-4 pt-8 lg:grid-cols-[2fr_1fr]">
      <div className="rounded-card border border-line bg-surface p-5 shadow-card">
        <h2 className="font-display text-xl font-bold">🗳 {t.game.potmVote}</h2>
        <p className="mt-1 text-sm text-muted">{voting ? t.game.potmVoteLead : t.game.potmSoon}</p>
        {voting && (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {m.candidates.map((c) => (
              <li key={c.photo_id} className="overflow-hidden rounded-xl border border-line">
                <Link href={`/${lang}/photo/${c.photo_id}`} className="block aspect-video bg-canvas">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={publicPhotoUrl(c.photo_id, "thumb")} alt="" className="size-full object-cover" loading="lazy" />
                </Link>
                <div className="flex items-center justify-between gap-2 p-2 text-xs">
                  <span className="truncate">
                    <b className="num">{c.fleet_number}</b> · {c.author_name} · ♥ {c.likes}
                  </span>
                  {user ? (
                    <PotmVoteButton photoId={c.photo_id} voted={myVote === c.photo_id} own={c.user_id === user.id} t={t.game} />
                  ) : (
                    <Link href={`/${lang}/login`} className="text-sea-600">{t.game.potmLogin}</Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-4">
        {m.spotter && (
          <Link href={`/${lang}/spotter/${m.spotter.id}`} className="flex items-center gap-3 rounded-card border-2 border-dashed border-sea-300 bg-sea-50 p-4 hover:bg-sea-100">
            <Avatar url={m.spotter.avatar_url} name={m.spotter.display_name} size="size-14 text-xl" />
            <span>
              <span className="block text-xs font-semibold uppercase tracking-wider text-sea-600">⭐ {t.game.sotmTitle}</span>
              <span className="font-display text-lg font-bold">{m.spotter.display_name}</span>
            </span>
          </Link>
        )}
        <div className="rounded-card border border-line bg-surface p-4 shadow-card">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-display text-lg font-bold">{t.game.topSpotters}</h2>
            <Link href={`/${lang}/rankings`} className="text-xs font-semibold text-sea-600">{t.game.rankingsTitle} →</Link>
          </div>
          {top.length === 0 ? (
            <p className="text-sm text-muted">{t.game.empty}</p>
          ) : (
            <ol className="space-y-1.5">
              {top.map((r, i) => (
                <li key={r.user_id}>
                  <Link href={`/${lang}/spotter/${r.user_id}`} className="flex items-center gap-2 rounded-lg p-1 hover:bg-canvas">
                    <span className="w-5 text-center">{["🥇", "🥈", "🥉"][i] ?? i + 1}</span>
                    <Avatar url={r.avatar_url} name={r.display_name} size="size-7 text-xs" />
                    <span className="flex-1 truncate text-sm font-semibold">{r.display_name}</span>
                    <span className="num text-sm font-bold">{r.score}</span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </section>
  );
}
