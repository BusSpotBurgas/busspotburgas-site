import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { IconSearch } from "@/components/icons";
import { PhotoCard } from "@/components/PhotoCard";
import { Avatar } from "@/components/ProfileForm";
import { getDictionary, hasLocale } from "@/lib/i18n";
import { cleanQuery, search } from "@/lib/search";

type Dict = Awaited<ReturnType<typeof getDictionary>>;

export async function generateMetadata({ params }: PageProps<"/[lang]/search">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  return { title: (await getDictionary(lang)).search.title, robots: { index: false } };
}

export default async function SearchPage({ params, searchParams }: PageProps<"/[lang]/search">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = await getDictionary(lang);
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
      <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{t.search.title}</h1>
      <Suspense fallback={<SearchBox lang={lang} t={t} q="" />}>
        <Results lang={lang} t={t} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function SearchBox({ lang, t, q }: { lang: string; t: Dict; q: string }) {
  return (
    <form action={`/${lang}/search`} role="search" className="mt-5 flex max-w-xl gap-2">
      <label className="flex flex-1 items-center gap-2 rounded-full border border-line bg-surface px-4 py-3 shadow-card focus-within:border-sea-500">
        <IconSearch className="size-5 text-muted" />
        <input
          name="q"
          type="search"
          defaultValue={q}
          maxLength={40}
          autoFocus={!q}
          placeholder={t.search.placeholder}
          aria-label={t.search.title}
          className="w-full bg-transparent outline-none placeholder:text-muted/70"
        />
      </label>
      <button className="rounded-full bg-sea-600 px-5 font-semibold text-white hover:bg-sea-700">{t.search.go}</button>
    </form>
  );
}

async function Results({
  lang,
  t,
  searchParams,
}: {
  lang: string;
  t: Dict;
  searchParams: PageProps<"/[lang]/search">["searchParams"];
}) {
  const q = cleanQuery((await searchParams).q);
  const r = await search(q);
  const empty = !r.vehicles.length && !r.spotters.length && !r.lineGroups.length && !r.ads.length;
  const h2 = "font-display text-xl font-bold";
  return (
    <>
      <SearchBox lang={lang} t={t} q={q} />
      {!q ? (
        <p className="mt-4 max-w-xl text-muted">{t.search.hint}</p>
      ) : empty ? (
        <p className="mt-6 rounded-card border border-line bg-surface p-6 text-center text-muted">{t.search.none.replace("{q}", q)}</p>
      ) : (
        <div className="mt-8 space-y-10">
          {r.vehicles.length > 0 && (
            <section>
              <h2 className={h2}>{t.search.vehicles}</h2>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                {r.vehicles.map((v) => (
                  <Link
                    key={v.fleet_number}
                    href={`/${lang}/bus/${v.fleet_number}`}
                    className="rounded-card border border-line bg-surface p-3 shadow-card transition hover:-translate-y-0.5 hover:shadow-lift"
                  >
                    <span className="num block text-2xl font-extrabold">{v.fleet_number}</span>
                    <span className="text-xs text-muted">{t.status[v.status as keyof Dict["status"]] ?? v.status}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}
          {r.spotters.length > 0 && (
            <section>
              <h2 className={h2}>{t.search.spotters}</h2>
              <div className="mt-3 flex flex-wrap gap-3">
                {r.spotters.map((s) => (
                  <Link
                    key={s.id}
                    href={`/${lang}/spotter/${s.id}`}
                    className="flex items-center gap-2 rounded-full border border-line bg-surface py-1.5 pl-1.5 pr-4 shadow-card hover:shadow-lift"
                  >
                    <Avatar url={s.avatar_url} name={s.display_name} size="size-9 text-sm" />
                    <span className="font-semibold">{s.display_name}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}
          {r.lineGroups.map((g) => (
            <section key={g.line}>
              <h2 className={h2}>{t.search.line.replace("{line}", g.line)}</h2>
              <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                {g.photos.map((p) => (
                  <PhotoCard key={p.id} p={p} lang={lang} former={t.photo.formerSpotter} />
                ))}
              </div>
            </section>
          ))}
          {r.ads.length > 0 && (
            <section>
              <h2 className={h2}>{t.search.ads}</h2>
              <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                {r.ads.map((p) => (
                  <PhotoCard key={p.id} p={p} lang={lang} former={t.photo.formerSpotter} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </>
  );
}
