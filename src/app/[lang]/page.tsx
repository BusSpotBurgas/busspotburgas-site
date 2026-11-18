import Link from "next/link";
import { notFound } from "next/navigation";
import { BusSilhouette } from "@/components/BusSilhouette";
import { IconArrow } from "@/components/icons";
import { PhotoCard } from "@/components/PhotoCard";
import { getFleet } from "@/lib/fleet";
import { getLatestPhotos } from "@/lib/photos";
import { getDictionary, hasLocale } from "@/lib/i18n";

export default async function HomePage({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const [t, fleet, latest] = await Promise.all([getDictionary(lang), getFleet(), getLatestPhotos(8)]);

  const active = fleet.vehicles.filter((v) => v.status === "run").length;
  const stats = [
    { value: fleet.vehicles.length, label: t.home.statVehicles },
    { value: fleet.models.length, label: t.home.statModels },
    { value: active, label: t.home.statActive },
  ];

  return (
    <>
      {/* Начало: тук в Етап 5 идва „Снимка на месеца“ */}
      <section className="relative overflow-hidden bg-gradient-to-b from-sea-50 to-canvas">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 sm:py-16 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-sea-500">{t.home.kicker}</p>
            <h1 className="mt-3 font-display text-[2rem] font-extrabold leading-[1.1] tracking-tight text-balance sm:text-5xl">
              {t.home.title}
            </h1>
            <p className="mt-4 max-w-lg text-lg text-muted text-pretty">{t.home.lead}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href={`/${lang}/fleet`}
                className="inline-flex items-center gap-2 rounded-xl bg-sea-500 px-5 py-3 font-semibold text-white shadow-lift transition hover:bg-sea-600"
              >
                {t.home.ctaFleet} <IconArrow className="size-4" />
              </Link>
              <Link
                href={`/${lang}/register`}
                className="inline-flex items-center rounded-xl border border-line bg-surface px-5 py-3 font-semibold text-ink transition hover:border-sea-300"
              >
                {t.home.ctaJoin}
              </Link>
            </div>
            {fleet.ok && (
              <dl className="mt-10 flex gap-8">
                {stats.map((s) => (
                  <div key={s.label}>
                    <dt className="sr-only">{s.label}</dt>
                    <dd className="num text-3xl font-bold text-ink">{s.value}</dd>
                    <dd className="text-sm text-muted">{s.label}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
          <div aria-hidden="true" className="relative hidden aspect-video lg:block">
            <div className="absolute inset-0 rotate-2 rounded-[28px] bg-sea-500/10" />
            <div className="absolute inset-0 grid place-items-center overflow-hidden rounded-[28px] border border-line bg-surface shadow-lift">
              <div className="animate-drive">
                <BusSilhouette kind="18m" color="#0B6FA4" className="w-[340px]" />
              </div>
              <span className="num absolute right-6 top-5 rounded-lg bg-sea-50 px-3 py-1 text-2xl font-bold text-sea-600">2941</span>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-6">
        <h2 className="font-display text-2xl font-bold tracking-tight">{t.home.latest}</h2>
        {latest.length ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {latest.map((p) => (
              <PhotoCard key={p.id} p={p} lang={lang} former={t.photo.formerSpotter} />
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-card border border-line bg-surface p-4 text-sm text-muted">
            {t.home.noPhotos}{" "}
            <Link href={`/${lang}/upload`} className="font-semibold text-sea-600 hover:underline">{t.upload.title} →</Link>
          </p>
        )}
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-10">
        <h2 className="font-display text-2xl font-bold tracking-tight">{t.home.modelsTitle}</h2>
        {fleet.ok ? (
          <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {fleet.models.map((m) => {
              const n = fleet.vehicles.filter((v) => v.model_id === m.id).length;
              return (
                <li key={m.id} className="flex items-center gap-4 rounded-card border border-line bg-surface p-4 shadow-card">
                  <div className="grid h-14 w-24 shrink-0 place-items-center rounded-xl" style={{ background: `${m.color}1a` }}>
                    <BusSilhouette kind={m.silhouette} color={m.color} className="w-20" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{m.name}</p>
                    <p className="text-sm text-muted">
                      {lang === "bg" ? m.type_bg : m.type_en} · <span className="num font-semibold text-ink">{n}</span>
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-4 rounded-card border border-line bg-sand p-4 text-sm">{t.fleet.dbMissing}</p>
        )}
        <p className="mt-8 rounded-card border border-sea-100 bg-sea-50 p-4 text-sm text-sea-800">{t.home.stageNote}</p>
      </section>
    </>
  );
}
