import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ClaimButton, DownloadOriginal, SwipeNav } from "@/components/PhotoClient";
import { ShareStory } from "@/components/ShareStory";
import { Comments, FollowButton, LikeButton } from "@/components/Social";
import { getPhotoSocial, getViewerPhoto } from "@/lib/social";
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
            <div className="flex items-center gap-3">
              <ShareStory
                src={publicPhotoUrl(p.id, "display")}
                number={num}
                line={p.line}
                author={p.author_name ?? t.photo.formerSpotter}
                labels={{ share: t.photo.share, making: t.photo.making, failed: t.photo.failed }}
              />
              <Link href={`/${lang}/bus/${num}`} className="text-sm font-semibold text-sea-600 hover:underline">
                ← {t.photo.back}
              </Link>
            </div>
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

          <Suspense fallback={<div className="h-10" />}>
            <Viewer photoId={p.id} authorId={p.user_id} t={t} lang={lang} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

/** Харесване, коментари и бутони според това кой гледа. */
async function Viewer({ photoId, authorId, t, lang }: { photoId: string; authorId: string | null; t: Dictionary; lang: string }) {
  const [user, social] = await Promise.all([getCurrentUser(), getPhotoSocial(photoId)]);
  const view = user ? await getViewerPhoto(user.id, photoId) : { liked: false, pending: [], followsAuthor: false };
  const isAuthor = Boolean(user && user.id === authorId);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <LikeButton photoId={photoId} liked={view.liked} count={social.likes} t={t.social} canLike={Boolean(user)} />
        {user && authorId && !isAuthor && <FollowButton type="spotter" id={authorId} following={view.followsAuthor} t={t.social} />}
        {isAuthor && <DownloadOriginal id={photoId} label={t.photo.download} />}
        {user && !isAuthor && <ClaimButton id={photoId} t={t.photo} />}
      </div>
      <div className="rounded-card border border-line bg-surface p-5 shadow-card">
        <Comments photoId={photoId} comments={social.comments} pending={view.pending} uid={user?.id ?? null} lang={lang} t={t.social} />
      </div>
    </div>
  );
}
