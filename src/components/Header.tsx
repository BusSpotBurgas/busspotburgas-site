import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { getUnreadCount } from "@/lib/social";
import type { Dictionary, Locale } from "@/lib/i18n";
import { IconBell, IconSearch } from "./icons";
import { Logo } from "./Logo";
import { LangSwitch, LangSwitchView, TopNav, TopNavView } from "./Nav";
import { Avatar } from "./ProfileForm";

export function Header({ lang, t }: { lang: Locale; t: Dictionary }) {
  const items = [
    { href: `/${lang}/fleet`, label: t.nav.fleet },
    { href: null, label: t.nav.history },
    { href: null, label: t.nav.lines },
    { href: `/${lang}/rankings`, label: t.nav.rankings },
    { href: null, label: t.nav.live },
  ];
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
        <Link href={`/${lang}`} aria-label={t.nav.home} className="shrink-0">
          <Logo />
        </Link>
        <Suspense fallback={<TopNavView lang={lang} items={items} soon={t.nav.soon} pathname="" />}>
          <TopNav lang={lang} items={items} soon={t.nav.soon} />
        </Suspense>
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
          <Suspense fallback={<span className="grid size-9 place-items-center text-muted"><IconBell className="size-5" /></span>}>
            <Bell lang={lang} label={t.nav.notifications} />
          </Suspense>
          <Suspense fallback={<LangSwitchView lang={lang} label={t.nav.language} pathname={`/${lang}`} />}>
            <LangSwitch lang={lang} label={t.nav.language} />
          </Suspense>
          <Suspense fallback={<span className="size-9" />}>
            <UserSlot lang={lang} t={t} />
          </Suspense>
        </div>
      </div>
    </header>
  );
}

/** Камбанката с брояча на непрочетените известия. */
async function Bell({ lang, label }: { lang: Locale; label: string }) {
  const user = await getCurrentUser();
  const count = user ? await getUnreadCount(user.id) : 0;
  return (
    <Link
      href={user ? `/${lang}/notifications` : `/${lang}/login`}
      aria-label={count ? `${label} (${count})` : label}
      className="relative grid size-9 place-items-center rounded-full text-muted hover:bg-canvas hover:text-ink"
    >
      <IconBell className="size-5" />
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 grid min-w-4.5 place-items-center rounded-full bg-scrapped px-1 text-[10px] font-bold leading-4.5 text-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}

/** Вход или снимката на спотъра (чете бисквитката – затова е в <Suspense>). */
async function UserSlot({ lang, t }: { lang: Locale; t: Dictionary }) {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <Link href={`/${lang}/login`} className="hidden rounded-full bg-sea-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sea-600 sm:inline-block">
        {t.nav.login}
      </Link>
    );
  }
  return (
    <Link href={`/${lang}/me`} aria-label={t.nav.profile} className="hidden sm:block">
      <Avatar url={user.profile.avatar_url} name={user.profile.display_name ?? user.email} size="size-9 text-sm" />
    </Link>
  );
}

export function Footer({ t, lang }: { t: Dictionary; lang: Locale }) {
  return (
    <footer className="mt-16 border-t border-line bg-surface pb-24 lg:pb-0">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>{t.footer.tagline}</p>
        <nav className="flex flex-wrap gap-x-5 gap-y-2">
          <Link href={`/${lang}/rules`} className="hover:text-ink">{t.footer.rules}</Link>
          <Link href={`/${lang}/privacy`} className="hover:text-ink">{t.footer.privacy}</Link>
          <span title={t.nav.soon}>TikTok</span>
          <a href="mailto:busspotburgas@gmail.com" className="text-sea-600 hover:underline">
            {t.footer.contact}
          </a>
        </nav>
      </div>
    </footer>
  );
}
