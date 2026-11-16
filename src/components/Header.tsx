import Link from "next/link";
import type { Dictionary, Locale } from "@/lib/i18n";
import { IconBell, IconSearch } from "./icons";
import { Logo } from "./Logo";
import { LangSwitch, TopNav } from "./Nav";

export function Header({ lang, t }: { lang: Locale; t: Dictionary }) {
  const items = [
    { href: `/${lang}/fleet`, label: t.nav.fleet },
    { href: null, label: t.nav.history },
    { href: null, label: t.nav.lines },
    { href: null, label: t.nav.rankings },
    { href: null, label: t.nav.live },
  ];
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
        <Link href={`/${lang}`} aria-label={t.nav.home} className="shrink-0">
          <Logo />
        </Link>
        <TopNav lang={lang} items={items} soon={t.nav.soon} />
        <div className="ml-auto flex items-center gap-2">
          {/* Търсачката заработва в Етап 6 */}
          <label className="hidden items-center gap-2 rounded-full border border-line bg-canvas px-3 py-2 text-sm text-muted md:flex">
            <IconSearch className="size-4" />
            <input
              disabled
              placeholder={t.nav.search}
              title={t.nav.soon}
              className="w-44 bg-transparent outline-none placeholder:text-muted/70 xl:w-56"
            />
          </label>
          <button
            type="button"
            disabled
            title={t.nav.soon}
            aria-label={t.nav.notifications}
            className="grid size-9 place-items-center rounded-full text-muted hover:bg-canvas"
          >
            <IconBell className="size-5" />
          </button>
          <LangSwitch lang={lang} label={t.nav.language} />
        </div>
      </div>
    </header>
  );
}

export function Footer({ t }: { t: Dictionary }) {
  return (
    <footer className="mt-16 border-t border-line bg-surface pb-24 lg:pb-0">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>{t.footer.tagline}</p>
        <nav className="flex flex-wrap gap-x-5 gap-y-2">
          <span title={t.nav.soon}>{t.footer.rules}</span>
          <span title={t.nav.soon}>{t.footer.privacy}</span>
          <span title={t.nav.soon}>TikTok</span>
          <a href="mailto:busspotburgas@gmail.com" className="text-sea-600 hover:underline">
            {t.footer.contact}
          </a>
        </nav>
      </div>
    </footer>
  );
}
