import type { Metadata, Viewport } from "next";
import { Inter, Unbounded } from "next/font/google";
import { notFound } from "next/navigation";
import { Footer, Header } from "@/components/Header";
import { BottomNav } from "@/components/Nav";
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

  return (
    <html lang={lang} className={`${unbounded.variable} ${inter.variable} antialiased`}>
      <body className="flex min-h-dvh flex-col">
        <Header lang={lang} t={t} />
        <main className="flex-1">{children}</main>
        <Footer t={t} />
        <BottomNav
          lang={lang}
          labels={{
            home: t.nav.home,
            fleet: t.nav.fleet,
            upload: t.nav.upload,
            live: t.nav.liveShort,
            profile: t.nav.profile,
          }}
        />
        <RegisterSW />
      </body>
    </html>
  );
}
