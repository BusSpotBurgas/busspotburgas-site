import Link from "next/link";
import { publicPhotoUrl, type PhotoRow } from "@/lib/photo-shared";

/** Плочка 16:9 с номер и автор (за галерии и „последни снимки“). */
export function PhotoCard({ p, lang, showNumber = true, former }: { p: PhotoRow; lang: string; showNumber?: boolean; former: string }) {
  return (
    <Link
      href={`/${lang}/photo/${p.id}`}
      className="group block overflow-hidden rounded-card border border-line bg-surface shadow-card transition hover:-translate-y-0.5 hover:shadow-lift"
    >
      <div className="relative aspect-video bg-canvas">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={publicPhotoUrl(p.id, "thumb")} alt="" loading="lazy" className="size-full object-cover" />
        {showNumber && p.vehicles && (
          <span className="num absolute left-2 top-2 rounded-lg bg-surface/90 px-2 py-0.5 text-sm font-bold shadow-sm">
            {p.vehicles.fleet_number}
          </span>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-muted">
        <span className="truncate">{p.author_name ?? former}</span>
        <span className="shrink-0">
          {p.line}
          {" · "}
          {new Date(p.created_at).toLocaleDateString(lang === "bg" ? "bg-BG" : "en-GB")}
        </span>
      </div>
    </Link>
  );
}
