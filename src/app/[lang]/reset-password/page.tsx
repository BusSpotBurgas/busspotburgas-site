import { notFound } from "next/navigation";
import { ResetForm } from "@/components/AuthForms";
import { AuthShell } from "@/components/AuthShell";
import { getDictionary, hasLocale } from "@/lib/i18n";

// Тук идва спотърът от връзката „нова парола“ (сесията е създадена от /auth/confirm).
export default async function ResetPage({ params }: PageProps<"/[lang]/reset-password">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = await getDictionary(lang);
  return (
    <AuthShell title={t.auth.resetTitle}>
      <ResetForm lang={lang} t={{ auth: t.auth, errors: t.errors }} />
    </AuthShell>
  );
}
