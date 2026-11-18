import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { MyPhotoItem } from "@/components/MyPhotoItem";
import { requireUser } from "@/lib/auth";
import { getDictionary, hasLocale, type Locale } from "@/lib/i18n";
import { getMyPhotos } from "@/lib/photos";

export const metadata: Metadata = { robots: { index: false } };

export default async function MyPhotosPage({ params }: PageProps<"/[lang]/me/photos">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  return (
    <Suspense fallback={<div className="mx-auto h-96 max-w-3xl animate-pulse px-4 py-8" />}>
      <MyPhotos lang={lang} />
    </Suspense>
  );
}

async function MyPhotos({ lang }: { lang: Locale }) {
  const user = await requireUser(lang, `/${lang}/me/photos`);
  const [t, photos] = await Promise.all([getDictionary(lang), getMyPhotos(user.id)]);
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link href={`/${lang}/me`} className="text-sm font-semibold text-sea-600 hover:underline">
        ← {t.me.title}
      </Link>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-extrabold">{t.myPhotos.title}</h1>
        <Link href={`/${lang}/upload`} className="rounded-xl bg-sea-500 px-4 py-2.5 font-semibold text-white hover:bg-sea-600">
          + {t.upload.title}
        </Link>
      </div>
      <p className="mt-2 text-sm text-muted">{t.myPhotos.autoDelete}</p>
      {photos.length === 0 ? (
        <p className="mt-6 rounded-card border border-line bg-surface p-6 text-center text-muted">{t.myPhotos.empty}</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {photos.map((p) => (
            <MyPhotoItem
              key={p.id}
              p={p}
              lang={lang}
              t={{ myPhotos: t.myPhotos, photoStatus: t.photoStatus, reasons: t.reasons, kinds: t.kinds, upload: t.upload }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
