import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LineBadge } from "@/components/LineBadge";
import { getDictionary, hasLocale } from "@/lib/i18n";
import { getLines, type LineKind } from "@/lib/lines";

export async function generateMetadata({ params }: PageProps<"/[lang]/lines">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  return { title: (await getDictionary(lang)).lines.title };
}

export default async function LinesPage({ params }: PageProps<"/[lang]/lines">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const [t, { lines, importedAt, source }] = await Promise.all([getDictionary(lang), getLines()]);
  const groups: { kind: LineKind; title: string }[] = [
    { kind: "bus", title: t.lines.bus },
    { kind: "express", title: t.lines.express },
    { kind: "trolley", title: t.lines.trolley },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
      <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{t.lines.title}</h1>
      <p className="mt-2 max-w-xl text-muted">{t.lines.lead}</p>

      {lines.length === 0 ? (
        <p className="mt-6 rounded-card border border-line bg-surface p-6 text-center text-muted">{t.lines.empty}</p>
      ) : (
        <div className="mt-8 space-y-10">
          {groups.map((g) => {
            const list = lines.filter((l) => l.kind === g.kind);
            if (!list.length) return null;
            return (
              <section key={g.kind}>
                <h2 className="font-display text-xl font-bold">{g.title}</h2>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {list.map((l) => (
                    <Link
                      key={l.id}
                      href={`/${lang}/lines/${encodeURIComponent(l.id)}`}
                      className="flex items-center gap-3 rounded-card border border-line bg-surface p-3 shadow-card transition hover:-translate-y-0.5 hover:shadow-lift"
                    >
                      <LineBadge id={l.id} kind={l.kind} />
                      <span className="line-clamp-2 text-sm font-medium">{l.name ?? t.lines.circular}</span>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
      {importedAt && (
        <p className="mt-10 text-xs text-muted">
          {t.lines.source}: {source ?? "Бургасбус"} · {t.lines.updated} {new Date(importedAt).toLocaleDateString(lang === "bg" ? "bg-BG" : "en-GB")}
        </p>
      )}
    </div>
  );
}
