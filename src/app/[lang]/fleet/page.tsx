import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FleetGrid } from "@/components/FleetGrid";
import { getFleet } from "@/lib/fleet";
import { getDictionary, hasLocale } from "@/lib/i18n";

export async function generateMetadata({ params }: PageProps<"/[lang]/fleet">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  return { title: (await getDictionary(lang)).fleet.title };
}

export default async function FleetPage({ params }: PageProps<"/[lang]/fleet">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const [t, fleet] = await Promise.all([getDictionary(lang), getFleet()]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
      <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{t.fleet.title}</h1>
      <p className="mt-2 max-w-xl text-muted">{t.fleet.lead}</p>
      <div className="mt-6">
        {fleet.ok ? (
          <FleetGrid
            models={fleet.models}
            vehicles={fleet.vehicles}
            lang={lang}
            labels={{ all: t.fleet.all, beFirst: t.fleet.beFirst, count: t.fleet.count, status: t.status }}
          />
        ) : (
          <p className="rounded-card border border-line bg-sand p-4 text-sm">{t.fleet.dbMissing}</p>
        )}
      </div>
    </div>
  );
}
