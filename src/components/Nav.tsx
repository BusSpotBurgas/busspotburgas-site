"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { IconBus, IconHome, IconLive, IconPlus, IconUser } from "./icons";

type Item = { href: string | null; label: string };

function isActive(pathname: string, href: string, lang: string) {
  return href === `/${lang}` ? pathname === href : pathname.startsWith(href);
}

/** BG / EN превключвател – запазва същата страница и помни избора. */
export function LangSwitch(p: { lang: string; label: string }) {
  return <LangSwitchView {...p} pathname={usePathname()} />;
}

export function LangSwitchView({ lang, label, pathname }: { lang: string; label: string; pathname: string }) {
  const rest = pathname.replace(/^\/(bg|en)(?=\/|$)/, "");
  return (
    <div role="group" aria-label={label} className="flex rounded-full border border-line bg-surface p-0.5 text-xs font-semibold">
      {(["bg", "en"] as const).map((l) => (
        <Link
          key={l}
          href={`/${l}${rest}`}
          hrefLang={l}
          aria-current={l === lang ? "true" : undefined}
          onClick={() => {
            document.cookie = `lang=${l}; path=/; max-age=31536000; samesite=lax`;
          }}
          className={`rounded-full px-2.5 py-1 uppercase transition-colors ${
            l === lang ? "bg-sea-500 text-white" : "text-muted hover:text-ink"
          }`}
        >
          {l}
        </Link>
      ))}
    </div>
  );
}

/** Горно меню на компютър. */
export function TopNav(p: { lang: string; items: Item[]; soon: string }) {
  return <TopNavView {...p} pathname={usePathname()} />;
}

export function TopNavView({ lang, items, soon, pathname }: { lang: string; items: Item[]; soon: string; pathname: string }) {
  return (
    <nav className="hidden items-center gap-1 lg:flex">
      {items.map((it) =>
        it.href ? (
          <Link
            key={it.label}
            href={it.href}
            className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive(pathname, it.href, lang) ? "bg-sea-50 text-sea-600" : "text-muted hover:bg-canvas hover:text-ink"
            }`}
          >
            {it.label}
          </Link>
        ) : (
          <span key={it.label} title={soon} className="cursor-default whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-muted/50">
            {it.label}
          </span>
        )
      )}
    </nav>
  );
}

/** Долно меню на телефон: Начало, Автопарк, „+“, Live, Профил. */
type BottomLabels = { home: string; fleet: string; upload: string; live: string; profile: string };

export function BottomNav(p: { lang: string; labels: BottomLabels }) {
  return <BottomNavView {...p} pathname={usePathname()} />;
}

export function BottomNavView({ lang, labels, pathname }: { lang: string; labels: BottomLabels; pathname: string }) {
  const items: { href: string | null; label: string; icon: ReactNode; main?: boolean }[] = [
    { href: `/${lang}`, label: labels.home, icon: <IconHome className="size-6" /> },
    { href: `/${lang}/fleet`, label: labels.fleet, icon: <IconBus className="size-6" /> },
    { href: null, label: labels.upload, icon: <IconPlus className="size-6" />, main: true },
    { href: null, label: labels.live, icon: <IconLive className="size-6" /> },
    { href: `/${lang}/me`, label: labels.profile, icon: <IconUser className="size-6" /> },
  ];
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {items.map((it) => {
          const active = it.href ? isActive(pathname, it.href, lang) : false;
          const inner = it.main ? (
            <span className="-mt-5 grid size-13 place-items-center rounded-2xl bg-sea-500 text-white shadow-lift">{it.icon}</span>
          ) : (
            it.icon
          );
          const cls = `flex h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
            active ? "text-sea-500" : it.href ? "text-muted" : "text-muted/45"
          }`;
          return (
            <li key={it.label}>
              {it.href ? (
                <Link href={it.href} className={cls} aria-current={active ? "page" : undefined}>
                  {inner}
                  <span>{it.label}</span>
                </Link>
              ) : (
                <span className={cls} aria-disabled="true">
                  {inner}
                  <span>{it.label}</span>
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
