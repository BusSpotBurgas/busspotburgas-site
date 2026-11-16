import Link from "next/link";
import { notFound } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import { getDictionary, hasLocale } from "@/lib/i18n";

export default async function CheckEmailPage({ params }: PageProps<"/[lang]/register/check-email">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = await getDictionary(lang);
  return (
    <AuthShell title={t.auth.checkTitle}>
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="grid size-16 place-items-center rounded-2xl bg-sea-50 text-3xl" aria-hidden="true">
          ✉️
        </span>
        <p className="text-muted">{t.auth.checkLead}</p>
        <Link href={`/${lang}`} className="text-sm font-semibold text-sea-600 hover:underline">
          {t.auth.backHome}
        </Link>
      </div>
    </AuthShell>
  );
}
