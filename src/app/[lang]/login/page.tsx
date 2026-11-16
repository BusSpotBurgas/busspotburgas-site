import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LoginForm } from "@/components/AuthForms";
import { AuthShell } from "@/components/AuthShell";
import { getDictionary, hasLocale } from "@/lib/i18n";

export async function generateMetadata({ params }: PageProps<"/[lang]/login">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  return { title: (await getDictionary(lang)).auth.loginTitle, robots: { index: false } };
}

export default async function LoginPage({ params }: PageProps<"/[lang]/login">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = await getDictionary(lang);
  return (
    <AuthShell
      title={t.auth.loginTitle}
      lead={t.auth.loginLead}
      footer={
        <>
          {t.auth.noAccount}{" "}
          <Link href={`/${lang}/register`} className="font-semibold text-sea-600 hover:underline">
            {t.nav.register}
          </Link>
        </>
      }
    >
      <Suspense>
        <LoginForm lang={lang} t={{ auth: t.auth, errors: t.errors }} />
      </Suspense>
    </AuthShell>
  );
}
