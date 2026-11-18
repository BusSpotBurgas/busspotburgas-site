import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { BusSilhouette } from "@/components/BusSilhouette";
import { GalleryTabs } from "@/components/GalleryTabs";
import { PhotoCard } from "@/components/PhotoCard";
import { Avatar } from "@/components/ProfileForm";
import { getFleet } from "@/lib/fleet";
import { getDictionary, hasLocale, type Locale } from "@/lib/i18n";
import { PHOTO_KINDS, publicPhotoUrl } from "@/lib/photo-shared";
import { getVehiclePage } from "@/lib/photos";

export async function generateMetadata({ params }: PageProps<"/[lang]/bus/[number]">): Promise<Metadata> {
  const { number } = await params;
  const data = await getVehiclePage(number);
  if (!data) return {};
  const cover = data.photos[0];
  return {
    title: `№ ${number}`,
    openGraph: cover ? { images: [publicPhotoUrl(cover.id, "display")] } : undefined,
  };
}

export default async function BusPage({ params }: PageProps<"/[lang]/bus/[number]">) {
  return (
    <Suspense fallback={<div className="mx-auto h-96 max-w-5xl animate-pulse px-4 py-8" />}>
      <Bus params={params} />
    </Suspense>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  if (children === null || children === undefined || children === "") return null;
  return (
    <div className="flex justify-between gap-4 border-b border-line py-2 text-sm last:border-0">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}

async function Bus({ params }: { params: PageProps<"/[lang]/bus/[number]">["params"] }) {
  const { lang, number } = await params;
  if (!hasLocale(lang)) notFound();
  const [t, data, fleet] = await Promise.all([getDictionary(lang as Locale), getVehiclePage(number), getFleet()]);
  if (!data) notFound();
  const { vehicle: v, photos, holders } = data;
  const model = fleet.models.find((m) => m.id === v.model_id);
  const hero = photos.find((p) => p.kind === "exterior") ?? photos[0];
  const owner = holders.find((h) => h.role === "owner");
  const partners = holders.filter((h) => h.role === "partner");
  const color = model?.color ?? "#0B6FA4";

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-6 sm:py-8">
      {/* Голяма снимка + номер */}
      <section className="relative overflow-hidden rounded-[22px] border border-line bg-surface shadow-card">
        {hero ? (
          <Link href={`/${lang}/photo/${hero.id}`} className="block aspect-video bg-ink">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={publicPhotoUrl(hero.id, "display")} alt={`№ ${v.fleet_number}`} className="size-full object-cover" />
          </Link>
        ) : (
          <div className="grid aspect-video place-items-center" style={{ background: `linear-gradient(160deg, ${color}14, ${color}33)` }}>
            {model && <BusSilhouette kind={model.silhouette} color={color} className="w-2/3 max-w-md" />}
          </div>
        )}
        <div className="flex flex-wrap items-end justify-between gap-3 p-5">
          <div>
            <p className="num text-4xl font-extrabold sm:text-5xl">{v.fleet_number}</p>
            <p className="mt-1 flex items-center gap-2 text-muted">
              <span className="size-2.5 rounded-full" style={{ background: color }} />
              {model?.name} · {t.status[v.status]}
              {v.old_numbers.length > 0 && <span>· {t.bus.formerly} {v.old_numbers.join(", ")}</span>}
            </p>
          </div>
          <Link href={`/${lang}/upload?bus=${v.fleet_number}`} className="rounded-xl bg-sea-500 px-4 py-2.5 font-semibold text-white hover:bg-sea-600">
            📷 {photos.length ? t.bus.upload : t.bus.beFirst}
          </Link>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <section className="space-y-6">
          <div className="rounded-card border border-line bg-surface p-5 shadow-card">
            <h2 className="mb-2 font-display text-lg font-bold">{t.bus.data}</h2>
            <dl>
              <Row label={t.bus.model}>{model?.name}</Row>
              <Row label={t.bus.status}>{t.status[v.status]}</Row>
              <Row label={t.bus.reg}>{v.reg_number}</Row>
              <Row label={t.bus.garage}>{v.garage}</Row>
              <Row label={t.bus.built}>{v.built_year}</Row>
              <Row label={t.bus.since}>{v.in_service_since ?? model?.since}</Row>
              <Row label={t.bus.oldNumbers}>{v.old_numbers.length ? v.old_numbers.join(", ") : null}</Row>
              <Row label={t.bus.length}>{v.length_m ? `${v.length_m} m` : null}</Row>
              <Row label={t.bus.doors}>{v.doors}</Row>
              <Row label={t.bus.seats}>{v.seats}</Row>
              <Row label={t.bus.fuel}>{v.fuel}</Row>
            </dl>
          </div>

          <div className="rounded-card border border-line bg-surface p-5 shadow-card">
            <h2 className="mb-3 font-display text-lg font-bold">{t.bus.holders}</h2>
            {owner ? (
              <ul className="space-y-2">
                {[owner, ...partners].map((h) => (
                  <li key={h.user_id}>
                    <Link href={`/${lang}/spotter/${h.user_id}`} className="flex items-center gap-3 rounded-xl p-1.5 hover:bg-canvas">
                      <Avatar url={h.avatar_url} name={h.display_name} size="size-10 text-base" />
                      <span className="font-semibold">{h.display_name}</span>
                      <span className="ml-auto text-xs text-muted">{h.role === "owner" ? t.bus.owner : t.bus.partner}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">{t.bus.noHolder}</p>
            )}
          </div>
          <p className="rounded-card border border-sea-100 bg-sea-50 p-4 text-sm text-sea-800">{t.bus.ratingsSoon}</p>
        </section>

        <section>
          <h2 className="mb-3 font-display text-lg font-bold">
            {t.bus.gallery} <span className="text-muted">· {photos.length}</span>
          </h2>
          {photos.length === 0 ? (
            <p className="rounded-card border border-line bg-surface p-6 text-center text-muted">{t.bus.noPhotos}</p>
          ) : (
            <GalleryTabs
              tabs={[
                ...PHOTO_KINDS.map((k) => {
                  const list = photos.filter((p) => p.kind === k);
                  return {
                    id: k,
                    label: t.kinds[k],
                    count: list.length,
                    content: list.length ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {list.map((p) => (
                          <PhotoCard key={p.id} p={p} lang={lang} showNumber={false} former={t.photo.formerSpotter} />
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted">{t.bus.noPhotos}</p>
                    ),
                  };
                }),
                { id: "video", label: t.bus.video, content: <p className="text-sm text-muted">{t.bus.videoSoon}</p> },
              ]}
            />
          )}
        </section>
      </div>
    </div>
  );
}
