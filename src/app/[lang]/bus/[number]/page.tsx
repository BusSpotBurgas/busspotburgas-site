import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { BusSilhouette } from "@/components/BusSilhouette";
import { GalleryTabs } from "@/components/GalleryTabs";
import { PhotoCard } from "@/components/PhotoCard";
import { Avatar } from "@/components/ProfileForm";
import { DescriptionEditor, FollowButton, LeaveVehicle, RateForm, RemovePartner, RequestPartner } from "@/components/Social";
import { getCurrentUser } from "@/lib/auth";
import { getFleet } from "@/lib/fleet";
import { fmt } from "@/lib/fmt";
import { getDictionary, hasLocale, type Dictionary, type Locale } from "@/lib/i18n";
import { PHOTO_KINDS, publicPhotoUrl } from "@/lib/photo-shared";
import { getVehiclePage, type Holder } from "@/lib/photos";
import { adsTimeline, getVehicleSocial, getViewerVehicle, type RatingStats } from "@/lib/social";
import { createSessionClient } from "@/lib/supabase/server";
import { VideoForm } from "@/components/GameClient";
import { getVehicleVideos, youtubeId, type Video } from "@/lib/game";

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

function Card({ title, children, id }: { title: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="rounded-card border border-line bg-surface p-5 shadow-card">
      <h2 className="mb-3 font-display text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}

/** Черти със звезди + голяма обща средна. */
function RatingSummary({ stats, t }: { stats: RatingStats; t: Dictionary["social"] }) {
  if (!stats || !stats.votes) return <p className="text-sm text-muted">{t.noRatings}</p>;
  const rows = [
    ["look", stats.look],
    ["comfort", stats.comfort],
    ["sound", stats.sound],
    ["rarity", stats.rarity],
  ] as const;
  return (
    <div className="flex gap-5">
      <div className="text-center">
        <p className="num text-5xl font-extrabold">{Number(stats.overall).toFixed(1)}</p>
        <p className="text-stop">{"★".repeat(Math.round(Number(stats.overall)))}<span className="text-line">{"★".repeat(5 - Math.round(Number(stats.overall)))}</span></p>
        <p className="text-xs text-muted">{stats.votes} {t.votes}</p>
      </div>
      <dl className="flex-1 space-y-1.5">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt className="flex justify-between text-xs text-muted"><span>{t[k]}</span><span>{Number(v).toFixed(1)}</span></dt>
            <dd className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-line">
              <div className="h-full rounded-full bg-stop" style={{ width: `${(Number(v) / 5) * 100}%` }} />
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

async function Bus({ params }: { params: PageProps<"/[lang]/bus/[number]">["params"] }) {
  const { lang, number } = await params;
  if (!hasLocale(lang)) notFound();
  const [t, data, fleet] = await Promise.all([getDictionary(lang as Locale), getVehiclePage(number), getFleet()]);
  if (!data) notFound();
  const { vehicle: v, photos, holders } = data;
  const [social, videos] = await Promise.all([getVehicleSocial(v.id, v.fleet_number), getVehicleVideos(v.id, v.fleet_number)]);
  const model = fleet.models.find((m) => m.id === v.model_id);
  const hero = photos.find((p) => p.kind === "exterior") ?? photos[0];
  const owner = holders.find((h) => h.role === "owner");
  const partners = holders.filter((h) => h.role === "partner");
  const color = model?.color ?? "#0B6FA4";
  const ads = adsTimeline(photos);
  const date = (s: string) => new Date(s).toLocaleDateString(lang === "bg" ? "bg-BG" : "en-GB");

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-6 sm:py-8">
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
            <p className="mt-1 flex flex-wrap items-center gap-2 text-muted">
              <span className="size-2.5 rounded-full" style={{ background: color }} />
              {model?.name} · {t.status[v.status]}
              {v.old_numbers.length > 0 && <span>· {t.bus.formerly} {v.old_numbers.join(", ")}</span>}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Suspense>
              <ViewerFollow fleet={v.fleet_number} t={t} />
            </Suspense>
            <Link href={`/${lang}/upload?bus=${v.fleet_number}`} className="rounded-xl bg-sea-500 px-4 py-2.5 font-semibold text-white hover:bg-sea-600">
              📷 {photos.length ? t.bus.upload : t.bus.beFirst}
            </Link>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-6">
          <Card title={t.bus.holders}>
            {social.election && (
              <p className="mb-3 rounded-lg bg-sand p-2 text-xs">🗳 {t.social.vote} · {fmt(t.social.votesUntil, { date: date(social.election.ends_at) })}</p>
            )}
            {owner || partners.length ? (
              <ul className="space-y-2">
                {[...(owner ? [owner] : []), ...partners].map((h) => (
                  <HolderRow key={h.user_id} h={h} lang={lang} t={t} fleet={v.fleet_number} />
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">{t.bus.noHolder}</p>
            )}
            <Suspense>
              <ViewerHolder vehicleId={v.id} fleet={v.fleet_number} hasOwner={Boolean(owner)} active={["run", "new", "stop"].includes(v.status)} t={t} />
            </Suspense>
          </Card>

          <Card title={t.social.description}>
            {social.description ? <p className="whitespace-pre-line text-sm">{social.description}</p> : <p className="text-sm text-muted">{t.social.noDescription}</p>}
            <Suspense>
              <ViewerDescription vehicleId={v.id} fleet={v.fleet_number} current={social.description} ownerId={owner?.user_id} t={t} />
            </Suspense>
          </Card>

          <Card title={t.social.ratings}>
            <RatingSummary stats={social.stats} t={t.social} />
            <div className="mt-4 border-t border-line pt-4">
              <Suspense>
                <ViewerRating vehicleId={v.id} fleet={v.fleet_number} lang={lang} t={t} />
              </Suspense>
            </div>
          </Card>

          <Card title={t.bus.data}>
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
          </Card>

          <Card title={t.social.ads}>
            {ads.length === 0 ? (
              <p className="text-sm text-muted">{t.social.noAds}</p>
            ) : (
              <ol className="space-y-3 border-l-2 border-sea-100 pl-4">
                {ads.map((a) => (
                  <li key={a.ad} className="relative">
                    <span className="absolute -left-[1.4rem] top-2 size-2.5 rounded-full bg-sea-500" />
                    <Link href={`/${lang}/photo/${a.photo}`} className="flex items-center gap-3 rounded-lg p-1 hover:bg-canvas">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={publicPhotoUrl(a.photo, "thumb")} alt="" className="aspect-video w-24 shrink-0 rounded-md object-cover" loading="lazy" />
                      <span className="text-sm">
                        <b>📢 {a.ad}</b>
                        <br />
                        <span className="text-xs text-muted">{t.social.adFrom} {date(a.from)} {t.social.adTo} {date(a.to)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>

        <section>
          <h2 className="mb-3 font-display text-lg font-bold">
            {t.bus.gallery} <span className="text-muted">· {photos.length}</span>
          </h2>
          {photos.length === 0 && <p className="mb-4 rounded-card border border-line bg-surface p-6 text-center text-muted">{t.bus.noPhotos}</p>}
          {(
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
                {
                  id: "video",
                  label: t.video.tab,
                  count: videos.length,
                  content: (
                    <div className="space-y-4">
                      <VideoList videos={videos} t={t} />
                      <Suspense>
                        <ViewerVideoForm fleet={v.fleet_number} t={t} />
                      </Suspense>
                    </div>
                  ),
                },
              ]}
            />
          )}
        </section>
      </div>
    </div>
  );
}

function HolderRow({ h, lang, t, fleet }: { h: Holder; lang: string; t: Dictionary; fleet: string }) {
  return (
    <li className="flex items-center gap-3">
      <Link href={`/${lang}/spotter/${h.user_id}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-1.5 hover:bg-canvas">
        <Avatar url={h.avatar_url} name={h.display_name} size="size-10 text-base" />
        <span className="truncate font-semibold">{h.display_name}</span>
        <span className="ml-auto shrink-0 text-xs text-muted">{h.role === "owner" ? t.bus.owner : t.bus.partner}</span>
      </Link>
      {h.role === "partner" && (
        <Suspense>
          <AdminRemove fleet={fleet} userId={h.user_id} t={t} />
        </Suspense>
      )}
    </li>
  );
}

// ── Части според това кой гледа (четат сесията → в <Suspense>) ───────────

async function AdminRemove({ fleet, userId, t }: { fleet: string; userId: string; t: Dictionary }) {
  const user = await getCurrentUser();
  if (user?.profile.role !== "admin" || user.aal !== "aal2") return null;
  return <RemovePartner fleet={fleet} userId={userId} t={t.social} />;
}

async function ViewerFollow({ fleet, t }: { fleet: string; t: Dictionary }) {
  const user = await getCurrentUser();
  if (!user) return null;
  const db = await createSessionClient();
  const { data } = await db.from("follows").select("target_id").eq("user_id", user.id).eq("target_type", "vehicle").eq("target_id", fleet).maybeSingle();
  return <FollowButton type="vehicle" id={fleet} following={Boolean(data)} t={t.social} />;
}

async function ViewerHolder({ vehicleId, fleet, hasOwner, active, t }: { vehicleId: number; fleet: string; hasOwner: boolean; active: boolean; t: Dictionary }) {
  const user = await getCurrentUser();
  if (!user || user.profile.onboarding_step !== "done") return null;
  const view = await getViewerVehicle(user.id, vehicleId, fleet);
  if (view.role) return <div className="mt-3 text-right"><LeaveVehicle fleet={fleet} t={t.social} /></div>;
  if (hasOwner && active) return <div className="mt-3"><RequestPartner fleet={fleet} pending={view.invitePending} t={t.social} /></div>;
  return null;
}

async function ViewerDescription({ vehicleId, fleet, current, ownerId, t }: { vehicleId: number; fleet: string; current: string | null; ownerId?: string; t: Dictionary }) {
  const user = await getCurrentUser();
  if (!user || user.id !== ownerId) return null;
  void vehicleId;
  return <DescriptionEditor fleet={fleet} current={current} t={t.social} isAdmin={user.profile.role === "admin" && user.aal === "aal2"} />;
}

async function ViewerRating({ vehicleId, fleet, lang, t }: { vehicleId: number; fleet: string; lang: string; t: Dictionary }) {
  const user = await getCurrentUser();
  if (!user) {
    return <Link href={`/${lang}/login`} className="text-sm font-semibold text-sea-600 hover:underline">{t.social.loginToRate}</Link>;
  }
  const view = await getViewerVehicle(user.id, vehicleId, fleet);
  return <RateForm fleet={fleet} initial={view.rating} t={t.social} />;
}

function VideoList({ videos, t }: { videos: Video[]; t: Dictionary }) {
  if (!videos.length) return <p className="text-sm text-muted">{t.video.none}</p>;
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {videos.map((v) => {
        const yt = v.provider === "youtube" ? youtubeId(v.url) : null;
        return (
          <li key={v.id} className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
            {yt ? (
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${yt}`}
                title="YouTube"
                loading="lazy"
                allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="aspect-video w-full"
              />
            ) : (
              <a href={v.url} target="_blank" rel="noopener noreferrer nofollow" className="flex aspect-video items-center justify-center gap-2 bg-ink font-semibold text-white">
                ▶ {t.video.open}
              </a>
            )}
          </li>
        );
      })}
    </ul>
  );
}

async function ViewerVideoForm({ fleet, t }: { fleet: string; t: Dictionary }) {
  const user = await getCurrentUser();
  if (!user || !user.emailConfirmed) return null;
  return <VideoForm fleet={fleet} t={t.video} />;
}
