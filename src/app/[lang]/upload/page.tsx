import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Uploader } from "@/components/Uploader";
import { requireUser } from "@/lib/auth";
import { getFleet } from "@/lib/fleet";
import { getDictionary, hasLocale, type Locale } from "@/lib/i18n";

export const metadata: Metadata = { robots: { index: false } };

export default async function UploadPage({ params, searchParams }: PageProps<"/[lang]/upload">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  return (
    <Suspense fallback={<div className="mx-auto h-96 max-w-2xl animate-pulse px-4 py-8" />}>
      <Upload lang={lang} searchParams={searchParams} />
    </Suspense>
  );
}

async function Upload({ lang, searchParams }: { lang: Locale; searchParams: PageProps<"/[lang]/upload">["searchParams"] }) {
  const user = await requireUser(lang, `/${lang}/upload`);
  const [t, fleet, sp] = await Promise.all([getDictionary(lang), getFleet(), searchParams]);
  if (!user.emailConfirmed || user.profile.onboarding_step !== "done") {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-muted">{user.emailConfirmed ? t.upload.needLogin : t.upload.needConfirm}</p>
        <Link href={`/${lang}/me`} className="mt-4 inline-block font-semibold text-sea-600 hover:underline">
          {t.me.title} →
        </Link>
      </div>
    );
  }
  const models = new Map(fleet.models.map((m) => [m.id, m.name.replace("Solaris Urbino III", "Urbino")]));
  const vehicles = fleet.vehicles.map((v) => ({ fleet_number: v.fleet_number, model: models.get(v.model_id) ?? "" }));
  const pre = typeof sp.bus === "string" && vehicles.some((v) => v.fleet_number === sp.bus) ? sp.bus : undefined;
  return (
    <Uploader
      t={{ upload: t.upload, kinds: t.kinds }}
      lang={lang}
      uid={user.id}
      authorName={user.profile.display_name ?? "spotter"}
      isAdmin={user.profile.role === "admin" && user.aal === "aal2"}
      vehicles={vehicles}
      initialFleet={pre}
    />
  );
}
