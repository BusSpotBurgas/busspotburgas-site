import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Board } from "@/components/Game";
import { getFleet } from "@/lib/fleet";
import { getLeaderboard, type BoardKind } from "@/lib/game";
import { getDictionary, hasLocale, type Locale } from "@/lib/i18n";

export async function generateMetadata({ params }: PageProps<"/[lang]/rankings">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  return { title: (await getDictionary(lang)).game.rankingsTitle };
}

export default async function RankingsPage({ params, searchParams }: PageProps<"/[lang]/rankings">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = await getDictionary(lang);
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div>
        <h1 className="font-display text-3xl font-extrabold">🏆 {t.game.rankingsTitle}</h1>
        <p className="mt-2 text-muted">{t.game.rankingsLead}</p>
      </div>
      <Suspense fallback={<div className="h-96 animate-pulse" />}>
        <Rankings lang={lang} searchParams={searchParams} />
      </Suspense>
      <section className="rounded-card border border-line bg-surface p-5 shadow-card">
        <h2 className="mb-3 font-display text-lg font-bold">{t.game.howTitle}</h2>
        <ul className="divide-y divide-line text-sm">
          {t.game.how.map(([what, pts]) => (
            <li key={what} className="flex justify-between py-1.5">
              <span>{what}</span>
              <span className="num font-bold text-sea-600">{pts}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

const KINDS: BoardKind[] = ["month", "all", "model", "collection"];

async function Rankings({ lang, searchParams }: { lang: Locale; searchParams: PageProps<"/[lang]/rankings">["searchParams"] }) {
  const [t, sp, fleet] = await Promise.all([getDictionary(lang), searchParams, getFleet()]);
  const kind = (KINDS.includes(sp.tab as BoardKind) ? sp.tab : "month") as BoardKind;
  const model = typeof sp.model === "string" && fleet.models.some((m) => m.id === sp.model) ? sp.model : fleet.models[0]?.id;
  const rows = await getLeaderboard(kind, kind === "model" ? model : undefined);
  const labels: Record<BoardKind, string> = { month: t.game.tabMonth, all: t.game.tabAll, model: t.game.tabModel, collection: t.game.tabCollection };
  const unit = kind === "model" ? t.game.scorePhotos : kind === "collection" ? t.game.scoreVehicles : t.game.scorePoints;
  const tab = (k: BoardKind) => `/${lang}/rankings?tab=${k}${k === "model" && model ? `&model=${model}` : ""}`;

  return (
    <div className="space-y-5">
      <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {KINDS.map((k) => (
          <Link
            key={k}
            href={tab(k)}
            aria-current={k === kind ? "page" : undefined}
            className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium ${k === kind ? "border-sea-500 bg-sea-500 text-white" : "border-line bg-surface hover:border-sea-300"}`}
          >
            {labels[k]}
          </Link>
        ))}
      </nav>
      {kind === "model" && (
        <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          {fleet.models.map((m) => (
            <Link
              key={m.id}
              href={`/${lang}/rankings?tab=model&model=${m.id}`}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${m.id === model ? "border-ink bg-ink text-white" : "border-line bg-surface"}`}
            >
              <span className="size-2 rounded-full" style={{ background: m.color }} />
              {m.name.replace("Solaris Urbino III", "Urbino")}
            </Link>
          ))}
        </nav>
      )}
      <Board rows={rows} unit={unit} lang={lang} t={t.game} />
    </div>
  );
}
