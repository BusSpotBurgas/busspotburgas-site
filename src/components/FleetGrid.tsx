"use client";

import Link from "next/link";
import { useState } from "react";
import { publicPhotoUrl } from "@/lib/photo-shared";
import type { Model, Vehicle, VehicleStatus } from "@/lib/fleet";
import { BusSilhouette } from "./BusSilhouette";

type Labels = {
  all: string;
  beFirst: string;
  count: string;
  photos: string;
  status: Record<VehicleStatus, string>;
};

const STATUS_DOT: Record<VehicleStatus, string> = {
  run: "bg-run",
  new: "bg-new",
  stop: "bg-stop",
  off: "bg-off",
  scrapped: "bg-scrapped",
};

/** Карти на колите с филтър по модел. */
export function FleetGrid({
  models,
  vehicles,
  labels,
  lang,
}: {
  models: Model[];
  vehicles: Vehicle[];
  labels: Labels;
  lang: "bg" | "en";
}) {
  const [filter, setFilter] = useState<string>("all");
  const byId = Object.fromEntries(models.map((m) => [m.id, m]));
  const shown = filter === "all" ? vehicles : vehicles.filter((v) => v.model_id === filter);

  return (
    <div>
      <div className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        <Chip active={filter === "all"} onClick={() => setFilter("all")}>
          {labels.all} <span className="opacity-60">{vehicles.length}</span>
        </Chip>
        {models.map((m) => (
          <Chip key={m.id} active={filter === m.id} onClick={() => setFilter(m.id)} color={m.color}>
            {m.name.replace("Solaris Urbino III", "Urbino")}{" "}
            <span className="opacity-60">{vehicles.filter((v) => v.model_id === m.id).length}</span>
          </Chip>
        ))}
      </div>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {shown.map((v) => {
          const m = byId[v.model_id];
          return (
            <li key={v.fleet_number}>
              <Link
                href={`/${lang}/bus/${v.fleet_number}`}
                className="group block overflow-hidden rounded-card border border-line bg-surface shadow-card transition hover:-translate-y-0.5 hover:shadow-lift"
              >
              {v.cover ? (
                <div className="aspect-video bg-canvas">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={publicPhotoUrl(v.cover, "thumb")} alt="" loading="lazy" className="size-full object-cover" />
                </div>
              ) : (
              <div
                className="relative grid aspect-video place-items-center"
                style={{ background: `linear-gradient(160deg, ${m.color}14, ${m.color}29)` }}
              >
                <BusSilhouette kind={m.silhouette} color={m.color} className="w-3/4 opacity-90" />
                <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-surface/90 px-2 py-0.5 text-[10px] font-semibold text-sea-600 shadow-sm sm:text-[11px]">
                  {labels.beFirst}
                </span>
              </div>
              )}
              <div className="p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="num text-xl font-bold">{v.fleet_number}</span>
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: m.color }} title={m.name} />
                </div>
                <p className="truncate text-xs text-muted">{m.name}</p>
                <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-ink/80">
                  <span className={`size-2 rounded-full ${STATUS_DOT[v.status]}`} />
                  {labels.status[v.status]}
                  {v.photos > 0 && <span className="ml-auto text-muted">📷 {v.photos}</span>}
                </p>
                {v.owner && <p className="mt-1 truncate text-xs text-muted">👤 {v.owner}</p>}
              </div>
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-sm text-muted" lang={lang}>
        {shown.length} {labels.count}
      </p>
    </div>
  );
}

function Chip({
  active,
  onClick,
  color,
  children,
}: {
  active: boolean;
  onClick: () => void;
  color?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
        active ? "border-sea-500 bg-sea-500 text-white" : "border-line bg-surface text-ink hover:border-sea-300"
      }`}
    >
      {color && <span className="size-2.5 rounded-full ring-2 ring-white/70" style={{ background: color }} />}
      {children}
    </button>
  );
}
