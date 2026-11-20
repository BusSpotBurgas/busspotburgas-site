import Link from "next/link";
import type { Model } from "@/lib/fleet";
import { fmt } from "@/lib/fmt";
import { nextRank, type Badge, type BoardRow, type Rank } from "@/lib/game";
import type { Dictionary } from "@/lib/i18n";
import { Avatar } from "./ProfileForm";

type G = Dictionary["game"];

const BADGE_ICON: Record<string, string> = {
  photos: "📸",
  model: "🚌",
  night: "🌙",
  rain: "🌧",
  photo_of_month: "🏆",
  spotter_of_month: "⭐",
};

export function badgeLabel(b: Pick<Badge, "badge" | "ref">, t: G, models: Model[]) {
  const ref = b.badge === "model" ? (models.find((m) => m.id === b.ref)?.name ?? b.ref) : b.ref;
  const tpl = (t.badgeNames as Record<string, string>)[b.badge] ?? b.badge;
  return fmt(tpl, { ref });
}

/** Значка във вид на автобусен билет. */
export function BadgeTicket({ b, t, models }: { b: Badge; t: G; models: Model[] }) {
  return (
    <li
      className="relative flex items-center gap-2 overflow-hidden rounded-lg border-2 border-dashed border-sea-300 bg-sea-50 py-2 pl-3 pr-4 text-sm font-semibold text-sea-800 shadow-sm"
      title={new Date(b.created_at).toLocaleDateString()}
    >
      {/* „перфорация“ на билета */}
      <span className="absolute -left-1.5 top-1/2 size-3 -translate-y-1/2 rounded-full bg-canvas" />
      <span className="absolute -right-1.5 top-1/2 size-3 -translate-y-1/2 rounded-full bg-canvas" />
      <span className="text-lg" aria-hidden="true">{BADGE_ICON[b.badge] ?? "🎫"}</span>
      {badgeLabel(b, t, models)}
    </li>
  );
}

export function BadgeList({ badges, t, models }: { badges: Badge[]; t: G; models: Model[] }) {
  if (!badges.length) return <p className="text-sm text-muted">{t.noBadges}</p>;
  return (
    <ul className="flex flex-wrap gap-2">
      {badges.map((b) => (
        <BadgeTicket key={`${b.badge}-${b.ref}`} b={b} t={t} models={models} />
      ))}
    </ul>
  );
}

/** Лента до следващия ранг. */
export function RankProgress({ total, rank, t, ranks }: { total: number; rank: Rank; t: G; ranks: Dictionary["ranks"] }) {
  const next = nextRank(total);
  const thresholds = [0, 50, 250, 750, 2000];
  const curMin = thresholds[["rookie", "spotter", "veteran", "expert", "legend"].indexOf(rank)] ?? 0;
  const pct = next ? Math.min(100, ((total - curMin) / (next.min - curMin)) * 100) : 100;
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-display text-lg font-bold">{ranks[rank]}</span>
        <span className="num font-bold">{total} <span className="font-sans text-xs font-normal text-muted">{t.points}</span></span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-gradient-to-r from-sea-400 to-sea-600" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-xs text-muted">{next ? fmt(t.nextRank, { rank: ranks[next.id], n: next.min - total }) : t.maxRank}</p>
    </div>
  );
}

/** Албум със стикери: всяка кола – стикер; снимана = цветна. */
export function StickerAlbum({ models, numbers, collected, lang, t }: { models: Model[]; numbers: { fleet_number: string; model_id: string }[]; collected: string[]; lang: string; t: G }) {
  const have = new Set(collected);
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">{fmt(t.albumOf, { n: have.size, total: numbers.length })}</p>
      {models.map((m) => {
        const list = numbers.filter((n) => n.model_id === m.id);
        if (!list.length) return null;
        const got = list.filter((n) => have.has(n.fleet_number)).length;
        return (
          <div key={m.id}>
            <p className="mb-1.5 flex items-center gap-2 text-xs font-semibold">
              <span className="size-2.5 rounded-full" style={{ background: m.color }} />
              {m.name} <span className="font-normal text-muted">{got}/{list.length}</span>
            </p>
            <ul className="flex flex-wrap gap-1">
              {list.map((n) => {
                const on = have.has(n.fleet_number);
                return (
                  <li key={n.fleet_number}>
                    <Link
                      href={`/${lang}/bus/${n.fleet_number}`}
                      className={`num block rounded-md px-1.5 py-0.5 text-[11px] font-bold transition ${on ? "text-white shadow-sm" : "border border-dashed border-line text-muted/60 hover:border-sea-300"}`}
                      style={on ? { background: m.color } : undefined}
                    >
                      {n.fleet_number}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

/** Подиум за топ 3 + списък. */
export function Board({ rows, unit, lang, t }: { rows: BoardRow[]; unit: string; lang: string; t: G }) {
  if (!rows.length) return <p className="rounded-card border border-line bg-surface p-6 text-center text-muted">{t.empty}</p>;
  const podium = [rows[1], rows[0], rows[2]].filter(Boolean);
  const heights = ["h-20", "h-28", "h-14"];
  const medals = ["🥈", "🥇", "🥉"];
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-center gap-3">
        {podium.map((r) => {
          const idx = rows.indexOf(r); // 0,1,2
          const pos = idx === 0 ? 1 : idx === 1 ? 0 : 2;
          return (
            <Link key={r.user_id} href={`/${lang}/spotter/${r.user_id}`} className="flex w-28 flex-col items-center text-center sm:w-36">
              <Avatar url={r.avatar_url} name={r.display_name} size={idx === 0 ? "size-20 text-3xl" : "size-16 text-2xl"} />
              <span className="mt-1 line-clamp-1 text-sm font-semibold">{r.display_name}</span>
              {r.role === "admin" && <span className="rounded bg-ink px-1.5 text-[10px] font-bold uppercase text-white">{t.adminBadge}</span>}
              <span className="num text-lg font-extrabold text-sea-600">{r.score} <span className="font-sans text-xs font-normal text-muted">{unit}</span></span>
              <span className={`mt-1 grid w-full place-items-start justify-center rounded-t-xl bg-gradient-to-b from-sea-100 to-sea-50 pt-2 text-2xl ${heights[pos]}`}>{medals[pos]}</span>
            </Link>
          );
        })}
      </div>
      {rows.length > 3 && (
        <ol start={4} className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface shadow-card">
          {rows.slice(3).map((r, i) => (
            <li key={r.user_id}>
              <Link href={`/${lang}/spotter/${r.user_id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-canvas">
                <span className="num w-6 text-right text-sm text-muted">{i + 4}</span>
                <Avatar url={r.avatar_url} name={r.display_name} size="size-8 text-sm" />
                <span className="flex-1 truncate font-semibold">
                  {r.display_name}
                  {r.role === "admin" && <span className="ml-2 rounded bg-ink px-1.5 text-[10px] font-bold uppercase text-white">{t.adminBadge}</span>}
                </span>
                <span className="num font-bold">{r.score} <span className="font-sans text-xs font-normal text-muted">{unit}</span></span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
