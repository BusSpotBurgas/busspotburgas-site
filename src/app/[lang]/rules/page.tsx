import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalPage } from "@/components/Legal";
import { getDictionary, hasLocale } from "@/lib/i18n";

export async function generateMetadata({ params }: PageProps<"/[lang]/rules">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  return { title: (await getDictionary(lang)).legal.rulesTitle };
}

export default async function Page({ params }: PageProps<"/[lang]/rules">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = await getDictionary(lang);
  return <LegalPage kind="rules" lang={lang} title={t.legal.rulesTitle} draft={t.legal.draft} />;
}
