import Link from "next/link";
import { notFound } from "next/navigation";
import { ForgotForm } from "@/components/AuthForms";
import { AuthShell } from "@/components/AuthShell";
import { getDictionary, hasLocale } from "@/lib/i18n";

export default async function ForgotPage({ params }: PageProps<"/[lang]/forgot-password">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = await getDictionary(lang);
  return (
    <AuthShell
      title={t.auth.forgotTitle}
      lead={t.auth.forgotLead}
      footer={
        <Link href={`/${lang}/login`} className="font-semibold text-sea-600 hover:underline">
          {t.nav.login}
        </Link>
      }
    >
      <ForgotForm lang={lang} t={{ auth: t.auth, errors: t.errors }} />
    </AuthShell>
  );
}
