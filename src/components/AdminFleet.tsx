"use client";

import { useMemo, useState, useTransition } from "react";
import { adminSetStatusAction } from "@/lib/fleet-actions";

type Row = { fleet_number: string; model_id: string; status: string };
type ModelRow = { id: string; name: string; color: string };

const ORDER = ["run", "new", "stop", "service", "off", "scrapped"];

/** Списък с всички коли и падащо меню за статус. */
export function AdminFleet({ vehicles, models, labels, searchLabel, scrapConfirm }: { vehicles: Row[]; models: ModelRow[]; labels: Record<string, string>; searchLabel: string; scrapConfirm: string }) {
  const [rows, setRows] = useState(vehicles);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string>();
  const [, start] = useTransition();
  const shown = useMemo(() => rows.filter((r) => r.fleet_number.includes(q.trim())), [rows, q]);

  function change(r: Row, status: string) {
    if (status === "scrapped" && !confirm(`${r.fleet_number}: ${scrapConfirm}`)) return;
    setBusy(r.fleet_number);
    start(async () => {
      const res = await adminSetStatusAction(r.fleet_number, status);
      if (res.ok) setRows((all) => all.map((x) => (x === r ? { ...x, status } : x)));
      setBusy(undefined);
    });
  }

  return (
    <div className="space-y-4">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value.replace(/\D/g, ""))}
        placeholder={searchLabel}
        inputMode="numeric"
        className="num w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-lg outline-none focus:border-sea-400"
      />
      {models.map((m) => {
        const list = shown.filter((r) => r.model_id === m.id);
        if (!list.length) return null;
        return (
          <section key={m.id} className="rounded-card border border-line bg-surface p-4 shadow-card">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-bold">
              <span className="size-2.5 rounded-full" style={{ background: m.color }} />
              {m.name} <span className="font-normal text-muted">· {list.length}</span>
            </h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {list.map((r) => (
                <li key={r.fleet_number} className={`flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-1.5 ${busy === r.fleet_number ? "animate-pulse" : ""}`}>
                  <span className="num font-bold">{r.fleet_number}</span>
                  <select
                    value={r.status}
                    disabled={busy === r.fleet_number}
                    onChange={(e) => change(r, e.target.value)}
                    className="rounded-lg border border-line bg-surface px-2 py-1 text-sm"
                  >
                    {ORDER.map((s) => (
                      <option key={s} value={s}>{labels[s] ?? s}</option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
