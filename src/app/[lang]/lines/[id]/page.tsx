import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LineBadge } from "@/components/LineBadge";
import { getDictionary, hasLocale } from "@/lib/i18n";
import { getLine, getLines, type Direction } from "@/lib/lines";

type Dict = Awaited<ReturnType<typeof getDictionary>>;

export async function generateMetadata({ params }: PageProps<"/[lang]/lines/[id]">): Promise<Metadata> {
  const { lang, id } = await params;
  if (!hasLocale(lang)) return {};
  return { title: `${(await getDictionary(lang)).lines.line} ${decodeURIComponent(id)}` };
}

export default async function LinePage({ params }: PageProps<"/[lang]/lines/[id]">) {
  return (
    <Suspense fallback={<div className="mx-auto h-96 max-w-4xl animate-pulse px-4 py-10" />}>
      <Line params={params} />
    </Suspense>
  );
}

async function Line({ params }: { params: PageProps<"/[lang]/lines/[id]">["params"] }) {
  const { lang, id } = await params;
  if (!hasLocale(lang)) notFound();
  const [t, data, meta] = await Promise.all([getDictionary(lang), getLine(decodeURIComponent(id)), getLines()]);
  if (!data) notFound();
  const { line, directions } = data;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:py-10">
      <Link href={`/${lang}/lines`} className="text-sm font-semibold text-sea-600 hover:underline">
        ← {t.lines.all}
      </Link>
      <div className="mt-4 flex items-center gap-4">
        <LineBadge id={line.id} kind={line.kind} size="lg" />
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
            {t.lines.line} {line.id}
          </h1>
          <p className="text-muted">{line.name ?? t.lines.circular}</p>
        </div>
      </div>
      {line.notes && (
        <p className="mt-5 rounded-card border border-sea-500/30 bg-sea-50 p-4 text-sm">{line.notes}</p>
      )}

      <div className="mt-8 space-y-10">
        {directions.map((d) => (
          <DirectionBlock key={d.direction} d={d} t={t} />
        ))}
      </div>

      {meta.importedAt && (
        <p className="mt-10 text-xs text-muted">
          {t.lines.source}: {meta.source ?? "Бургасбус"} · {t.lines.updated}{" "}
          {new Date(meta.importedAt).toLocaleDateString(lang === "bg" ? "bg-BG" : "en-GB")}. {t.lines.disclaimer}
        </p>
      )}
    </div>
  );
}

function DirectionBlock({ d, t }: { d: Direction; t: Dict }) {
  const days = [
    { key: "weekday" as const, title: t.lines.weekday },
    { key: "saturday" as const, title: t.lines.saturday },
    { key: "sunday" as const, title: t.lines.sunday },
  ].filter((x) => d[x.key].length);

  return (
    <section className="rounded-card border border-line bg-surface p-5 shadow-card">
      <h2 className="font-display text-lg font-bold">
        {d.stops.length > 2 && d.stops[0] === d.stops.at(-1) ? (
          `${t.lines.circular} · ${d.stops[0]}`
        ) : d.stops.length > 4 ? (
          <>
            {d.stops[0]} <span className="text-sea-600">→</span> {d.stops.at(-1)}
          </>
        ) : d.stops.length >= 2 ? (
          d.stops.map((s, i) => (
            <span key={i}>
              {i > 0 && <span className="text-sea-600"> → </span>}
              {s}
            </span>
          ))
        ) : d.headsign ? (
          `${t.lines.towards} ${d.headsign}`
        ) : (
          t.lines.departures
        )}
      </h2>

      {d.stops.length > 4 && (
      <details className="mt-3">
        <summary className="cursor-pointer text-sm font-semibold text-sea-600">
          {t.lines.route} ({d.stops.length} {t.lines.stops})
        </summary>
        <ol className="mt-3 border-l-2 border-sea-500/40 pl-4 text-sm">
          {d.stops.map((s, i) => (
            <li key={i} className="relative py-1 before:absolute before:-left-[1.36rem] before:top-2.5 before:size-2.5 before:rounded-full before:bg-sea-600">
              {s}
            </li>
          ))}
        </ol>
      </details>
      )}

      <div className="mt-5 grid gap-5 md:grid-cols-3">
        {days.map((x) => (
          <div key={x.key}>
            <h3 className="text-sm font-bold uppercase tracking-wide text-muted">{x.title}</h3>
            <Timetable times={d[x.key]} />
          </div>
        ))}
      </div>
    </section>
  );
}

/** Часовете, групирани по час: „05 │ 30 50“. */
function Timetable({ times }: { times: string[] }) {
  const byHour = new Map<string, string[]>();
  for (const tm of times) {
    const [h, m] = tm.split(":");
    byHour.set(h, [...(byHour.get(h) ?? []), m]);
  }
  return (
    <table className="mt-2 w-full text-sm">
      <tbody>
        {[...byHour.entries()].map(([h, mins]) => (
          <tr key={h} className="border-b border-line/60 last:border-0">
            <th className="num w-10 py-1 pr-2 text-left font-extrabold">{h}</th>
            <td className="num flex flex-wrap gap-x-3 py-1 text-ink/80">
              {mins.map((m, i) => (
                <span key={i}>{m}</span>
              ))}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
