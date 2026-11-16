import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AuthShell } from "@/components/AuthShell";
import { MfaVerify } from "@/components/Mfa";
import { safeNext } from "@/lib/auth";
import { getDictionary, hasLocale } from "@/lib/i18n";

export default async function MfaPage({ params, searchParams }: PageProps<"/[lang]/mfa">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = await getDictionary(lang);
  return (
    <AuthShell title={t.auth.mfaTitle} lead={t.auth.mfaLead}>
      <Suspense>
        <Verify lang={lang} t={{ auth: t.auth, errors: t.errors, admin: t.admin }} searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}

async function Verify({
  lang,
  t,
  searchParams,
}: {
  lang: string;
  t: Parameters<typeof MfaVerify>[0]["t"];
  searchParams: PageProps<"/[lang]/mfa">["searchParams"];
}) {
  const sp = await searchParams;
  const next = safeNext(typeof sp.next === "string" ? sp.next : null) ?? `/${lang}/me`;
  return <MfaVerify t={t} next={next} />;
}
