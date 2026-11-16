import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalPage } from "@/components/Legal";
import { getDictionary, hasLocale } from "@/lib/i18n";

export async function generateMetadata({ params }: PageProps<"/[lang]/privacy">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  return { title: (await getDictionary(lang)).legal.privacyTitle };
}

export default async function Page({ params }: PageProps<"/[lang]/privacy">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = await getDictionary(lang);
  return <LegalPage kind="privacy" lang={lang} title={t.legal.privacyTitle} draft={t.legal.draft} />;
}
