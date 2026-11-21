import type { Metadata, Viewport } from "next";
import { Inter, Unbounded } from "next/font/google";
import { notFound } from "next/navigation";
import { Footer, Header } from "@/components/Header";
import { BottomNav, BottomNavView } from "@/components/Nav";
import { Suspense } from "react";
import { RegisterSW } from "@/components/RegisterSW";
import { getDictionary, hasLocale, locales } from "@/lib/i18n";
import "../globals.css";

const unbounded = Unbounded({
  variable: "--font-unbounded",
  subsets: ["latin", "cyrillic"],
  weight: ["600", "700", "800"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

export async function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const t = await getDictionary(lang);
  return {
    metadataBase: new URL(process.env.URL ?? "https://busspotburgas.netlify.app"),
    title: { default: t.meta.title, template: "%s · busspotburgas" },
    description: t.meta.description,
    applicationName: "busspotburgas",
    appleWebApp: { capable: true, title: "busspot", statusBarStyle: "default" },
    alternates: { languages: { bg: "/bg", en: "/en" } },
    icons: { apple: "/icons/apple-touch-icon.png" },
  };
}

export const viewport: Viewport = {
  themeColor: "#0B6FA4",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = await getDictionary(lang);
  const navLabels = {
    home: t.nav.home,
    fleet: t.nav.fleet,
    upload: t.nav.upload,
    live: t.nav.rankings,
    profile: t.nav.profile,
  };

  return (
    <html lang={lang} className={`${unbounded.variable} ${inter.variable} antialiased`}>
      <body className="flex min-h-dvh flex-col">
        <Header lang={lang} t={t} />
        <main className="flex-1">{children}</main>
        <Footer t={t} lang={lang} />
        <Suspense fallback={<BottomNavView lang={lang} labels={navLabels} pathname="" />}>
          <BottomNav lang={lang} labels={navLabels} />
        </Suspense>
        <RegisterSW />
      </body>
    </html>
  );
}
