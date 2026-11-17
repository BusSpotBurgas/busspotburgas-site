import type { Model } from "@/lib/fleet";
import { BusSilhouette } from "./BusSilhouette";
import { Avatar } from "./ProfileForm";

/** Корица + снимка + име. Използва се в „Моят профил“ и в публичния профил. */
export function ProfileHeader({
  name,
  avatar,
  tiktok,
  isAdmin,
  rank,
  points,
  pointsLabel,
}: {
  name: string;
  avatar: string | null;
  tiktok: string | null;
  isAdmin: boolean;
  rank: string;
  points: number;
  pointsLabel: string;
}) {
  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
      <div className="relative h-28 bg-gradient-to-r from-sea-500 to-sea-700 sm:h-36">
        <div className="absolute bottom-2 right-6 w-56 opacity-40">
          <BusSilhouette kind="18m" color="#ADD8F0" className="w-full" />
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-4 px-5 pb-5">
        <div className="relative z-10 -mt-12">
          <Avatar url={avatar} name={name} size="size-24" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold">
            <span className="truncate">{name}</span>
            {isAdmin && (
              <span className="rounded-md bg-ink px-2 py-0.5 font-sans text-[11px] font-bold uppercase tracking-wider text-white">Admin</span>
            )}
          </h1>
          <p className="text-sm text-muted">
            {rank} · <span className="num font-semibold text-ink">{points}</span> {pointsLabel}
            {tiktok && (
              <>
                {" · "}
                <a href={`https://www.tiktok.com/@${encodeURIComponent(tiktok)}`} target="_blank" rel="noopener noreferrer nofollow" className="text-sea-600 hover:underline">
                  @{tiktok}
                </a>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

/** Титулярите по модел. */
export function HoldersList({
  models,
  numbers,
  noHolder,
  emptyLabel,
  noneLabel,
}: {
  models: Model[];
  numbers: { fleet_number: string; model_id: string }[];
  noHolder: string[];
  emptyLabel: string;
  noneLabel: string;
}) {
  const rows = models
    .map((m) => ({ m, nums: numbers.filter((n) => n.model_id === m.id), none: noHolder.includes(m.id) }))
    .filter((r) => r.nums.length || r.none);
  if (!rows.length) return <p className="text-sm text-muted">{emptyLabel}</p>;
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {rows.map(({ m, nums, none }) => (
        <li key={m.id} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3">
          <div className="grid h-10 w-16 shrink-0 place-items-center rounded-lg" style={{ background: `${m.color}1a` }}>
            <BusSilhouette kind={m.silhouette} color={m.color} className="w-14" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs text-muted">{m.name}</p>
            {nums.length ? (
              <p className="flex flex-wrap gap-1.5">
                {nums.map((n) => (
                  <span key={n.fleet_number} className="num rounded-md px-1.5 py-0.5 text-sm font-bold text-white" style={{ background: m.color }}>
                    {n.fleet_number}
                  </span>
                ))}
              </p>
            ) : (
              <p className="text-sm text-muted">{none ? noneLabel : ""}</p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
