import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RegisterForm } from "@/components/AuthForms";
import { AuthShell } from "@/components/AuthShell";
import { getDictionary, hasLocale } from "@/lib/i18n";

export async function generateMetadata({ params }: PageProps<"/[lang]/register">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  return { title: (await getDictionary(lang)).auth.registerTitle };
}

export default async function RegisterPage({ params }: PageProps<"/[lang]/register">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = await getDictionary(lang);
  return (
    <AuthShell
      title={t.auth.registerTitle}
      lead={t.auth.registerLead}
      footer={
        <>
          {t.auth.haveAccount}{" "}
          <Link href={`/${lang}/login`} className="font-semibold text-sea-600 hover:underline">
            {t.nav.login}
          </Link>
        </>
      }
    >
      <RegisterForm lang={lang} t={{ auth: t.auth, errors: t.errors }} />
    </AuthShell>
  );
}
