import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AdminFleet } from "@/components/AdminFleet";
import { requireUser } from "@/lib/auth";
import { getDictionary, hasLocale, type Locale } from "@/lib/i18n";
import { createSessionClient } from "@/lib/supabase/server";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AdminFleetPage({ params }: PageProps<"/[lang]/admin/fleet">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  return (
    <Suspense fallback={<div className="mx-auto h-96 max-w-3xl animate-pulse px-4 py-8" />}>
      <Fleet lang={lang} />
    </Suspense>
  );
}

async function Fleet({ lang }: { lang: Locale }) {
  const user = await requireUser(lang, `/${lang}/admin/fleet`);
  const t = await getDictionary(lang);
  if (user.profile.role !== "admin" || user.aal !== "aal2") {
    return <p className="mx-auto max-w-3xl px-4 py-16 text-center text-muted">{t.admin.notAdmin}</p>;
  }
  const db = await createSessionClient();
  const [{ data: models }, { data: vehicles }] = await Promise.all([
    db.from("models").select("id,name,color").order("sort_order"),
    db.from("vehicles").select("fleet_number,model_id,status").eq("is_historic", false).order("fleet_number"),
  ]);
  const sorted = (vehicles ?? []).sort((a, b) => a.fleet_number.length - b.fleet_number.length || a.fleet_number.localeCompare(b.fleet_number));
  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-8">
      <Link href={`/${lang}/admin`} className="text-sm font-semibold text-sea-600 hover:underline">← {t.admin.title}</Link>
      <h1 className="font-display text-3xl font-extrabold">🚌 {t.nav.fleet}</h1>
      <AdminFleet
        vehicles={sorted}
        models={models ?? []}
        labels={t.status}
        searchLabel={t.upload.vehiclePlaceholder}
        scrapConfirm={lang === "bg" ? "да стане „Бракувана“? Титулярите ѝ ще трябва да изберат друга кола." : "mark as scrapped? Its owners will need to pick another vehicle."}
      />
    </div>
  );
}
