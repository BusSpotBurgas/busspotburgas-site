import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ClaimButton, DownloadOriginal, SwipeNav } from "@/components/PhotoClient";
import { getCurrentUser } from "@/lib/auth";
import { getDictionary, hasLocale, type Dictionary, type Locale } from "@/lib/i18n";
import { publicPhotoUrl } from "@/lib/photo-shared";
import { getPhoto } from "@/lib/photos";

export async function generateMetadata({ params }: PageProps<"/[lang]/photo/[id]">): Promise<Metadata> {
  const { id } = await params;
  const data = await getPhoto(id);
  if (!data) return {};
  const n = data.photo.vehicles?.fleet_number ?? "";
  return { title: `№ ${n} · ${data.photo.author_name ?? ""}`, openGraph: { images: [publicPhotoUrl(id, "display")] } };
}

export default async function PhotoPage({ params }: PageProps<"/[lang]/photo/[id]">) {
  return (
    <Suspense fallback={<div className="mx-auto aspect-video max-w-5xl animate-pulse bg-ink/90" />}>
      <Photo params={params} />
    </Suspense>
  );
}

async function Photo({ params }: { params: PageProps<"/[lang]/photo/[id]">["params"] }) {
  const { lang, id } = await params;
  if (!hasLocale(lang)) notFound();
  const [t, data] = await Promise.all([getDictionary(lang as Locale), getPhoto(id)]);
  if (!data) notFound();
  const { photo: p, prev, next } = data;
  const num = p.vehicles?.fleet_number ?? "";
  const href = (x: string | null) => (x ? `/${lang}/photo/${x}` : null);

  return (
    <div className="bg-ink">
      <SwipeNav prev={href(prev)} next={href(next)}>
        <div className="relative mx-auto max-w-6xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={publicPhotoUrl(p.id, "display")}
            alt={`№ ${num}`}
            width={p.width ?? undefined}
            height={p.height ?? undefined}
            className="mx-auto max-h-[78dvh] w-auto object-contain"
          />
          {prev && (
            <Link href={href(prev)!} aria-label={t.photo.prev} className="absolute left-2 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-black/40 text-2xl text-white hover:bg-black/60">
              ‹
            </Link>
          )}
          {next && (
            <Link href={href(next)!} aria-label={t.photo.next} className="absolute right-2 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-black/40 text-2xl text-white hover:bg-black/60">
              ›
            </Link>
          )}
        </div>
      </SwipeNav>

      <div className="bg-canvas">
        <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <Link href={`/${lang}/bus/${num}`} className="num text-3xl font-extrabold hover:text-sea-600">
                {num}
              </Link>
              <p className="text-sm text-muted">
                {t.kinds[p.kind]} ·{" "}
                {p.user_id ? (
                  <Link href={`/${lang}/spotter/${p.user_id}`} className="font-semibold text-ink hover:underline">
                    {p.author_name}
                  </Link>
                ) : (
                  t.photo.formerSpotter
                )}
              </p>
            </div>
            <Link href={`/${lang}/bus/${num}`} className="text-sm font-semibold text-sea-600 hover:underline">
              ← {t.photo.back}
            </Link>
          </div>

          <dl className="grid grid-cols-2 gap-3 rounded-card border border-line bg-surface p-4 text-sm shadow-card sm:grid-cols-4">
            <div><dt className="text-muted">{t.photo.line}</dt><dd className="font-semibold">{p.line}</dd></div>
            <div><dt className="text-muted">{t.photo.place}</dt><dd className="font-semibold">{p.place}</dd></div>
            <div><dt className="text-muted">{t.photo.ad}</dt><dd className="font-semibold">{p.ad ?? "—"}</dd></div>
            <div>
              <dt className="text-muted">{t.photo.date}</dt>
              <dd className="font-semibold">{new Date(p.created_at).toLocaleDateString(lang === "bg" ? "bg-BG" : "en-GB")}</dd>
            </div>
          </dl>
          {/* Текстовете на потребителите – само като обикновен текст */}
          {p.description && <p className="whitespace-pre-line rounded-card border border-line bg-surface p-4 text-sm shadow-card">{p.description}</p>}

          <Suspense>
            <Viewer photoId={p.id} authorId={p.user_id} t={t} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

/** Бутони според това кой гледа: авторът сваля оригинала, другите могат да заявят авторство. */
async function Viewer({ photoId, authorId, t }: { photoId: string; authorId: string | null; t: Dictionary }) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.id === authorId) return <DownloadOriginal id={photoId} label={t.photo.download} />;
  return <ClaimButton id={photoId} t={t.photo} />;
}
