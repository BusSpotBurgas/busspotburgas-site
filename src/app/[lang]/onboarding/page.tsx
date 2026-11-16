import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { Onboarding } from "@/components/Onboarding";
import { requireUser } from "@/lib/auth";
import { getHolderData } from "@/lib/holders";
import { getDictionary, hasLocale, type Locale } from "@/lib/i18n";

export default async function OnboardingPage({ params }: PageProps<"/[lang]/onboarding">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  return (
    <Suspense fallback={<div className="mx-auto h-96 max-w-xl animate-pulse px-4 py-8" />}>
      <Flow lang={lang} />
    </Suspense>
  );
}

async function Flow({ lang }: { lang: Locale }) {
  const user = await requireUser(lang, `/${lang}/onboarding`);
  if (user.profile.onboarding_step === "done") redirect(`/${lang}/me`);
  const [t, data] = await Promise.all([getDictionary(lang), getHolderData(user.id)]);
  return (
    <Onboarding
      lang={lang}
      uid={user.id}
      t={{ onboarding: t.onboarding, errors: t.errors, settings: t.settings, auth: t.auth }}
      step={user.profile.onboarding_step}
      profile={user.profile}
      models={data.models}
      vehicles={data.vehicles}
      noHolder={data.noHolder}
    />
  );
}
