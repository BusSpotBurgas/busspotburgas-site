import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FleetGrid } from "@/components/FleetGrid";
import { getFleet } from "@/lib/fleet";
import { getDictionary, hasLocale } from "@/lib/i18n";

export async function generateMetadata({ params }: PageProps<"/[lang]/history">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  return { title: (await getDictionary(lang)).history.title };
}

/** История: бракуваните и историческите коли – със същия дизайн като автопарка. */
export default async function HistoryPage({ params }: PageProps<"/[lang]/history">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const [t, fleet] = await Promise.all([getDictionary(lang), getFleet(true)]);
  const models = fleet.models.filter((m) => fleet.vehicles.some((v) => v.model_id === m.id));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
      <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{t.history.title}</h1>
      <p className="mt-2 max-w-xl text-muted">{t.history.lead}</p>
      <div className="mt-6">
        {!fleet.ok ? (
          <p className="rounded-card border border-line bg-sand p-4 text-sm">{t.fleet.dbMissing}</p>
        ) : fleet.vehicles.length === 0 ? (
          <p className="rounded-card border border-line bg-surface p-6 text-center text-muted">{t.history.empty}</p>
        ) : (
          <FleetGrid
            models={models}
            vehicles={fleet.vehicles}
            lang={lang}
            labels={{ all: t.fleet.all, beFirst: t.fleet.beFirst, count: t.fleet.count, photos: t.fleet.photos, status: t.status }}
          />
        )}
      </div>
    </div>
  );
}
