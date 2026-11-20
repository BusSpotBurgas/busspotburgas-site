import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { HoldersEditor } from "@/components/SettingsParts";
import { requireUser } from "@/lib/auth";
import { getHolderData } from "@/lib/holders";
import { getDictionary, hasLocale, type Locale } from "@/lib/i18n";

export const metadata: Metadata = { robots: { index: false } };

export default async function HoldersPage({ params }: PageProps<"/[lang]/settings/holders">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  return (
    <Suspense fallback={<div className="mx-auto h-96 max-w-2xl animate-pulse px-4 py-8" />}>
      <Holders lang={lang} />
    </Suspense>
  );
}

async function Holders({ lang }: { lang: Locale }) {
  const user = await requireUser(lang, `/${lang}/settings/holders`);
  const [t, data] = await Promise.all([getDictionary(lang), getHolderData(user.id)]);
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link href={`/${lang}/me`} className="text-sm font-semibold text-sea-600 hover:underline">
        ← {t.me.title}
      </Link>
      <h1 className="mt-2 font-display text-3xl font-extrabold">{t.onboarding.holdersTitle}</h1>
      <p className="mt-2 mb-6 text-sm text-muted">{t.onboarding.holdersLead}</p>
      <HoldersEditor models={data.models} vehicles={data.vehicles} noHolder={data.noHolder} t={{ onboarding: t.onboarding, errors: t.errors, social: t.social }} />
    </div>
  );
}
