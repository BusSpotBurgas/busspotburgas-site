"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { Dictionary } from "@/lib/i18n";
import { adminEditPhotoAction, approvePhotoAction, rejectPhotoAction, resolveClaimAction } from "@/lib/photo-actions";
import { REJECT_REASONS, type PhotoRow, type RejectReason } from "@/lib/photo-shared";
import { FormError } from "./ui";

type T = Pick<Dictionary, "queue" | "reasons" | "kinds" | "upload">;

const field = "rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-sea-400";

export function QueueItem({ p, t, lang }: { p: PhotoRow & { preview?: string; taken_at: string | null }; t: T; lang: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [night, setNight] = useState(false);
  const [rain, setRain] = useState(false);
  const [mode, setMode] = useState<"none" | "reject" | "edit">("none");
  const [reason, setReason] = useState<RejectReason>("blurry");
  const [note, setNote] = useState("");
  const [fleet, setFleet] = useState(p.vehicles?.fleet_number ?? "");
  const [line, setLine] = useState(p.line);
  const [err, setErr] = useState<string>();
  const date = (s: string) => new Date(s).toLocaleString(lang === "bg" ? "bg-BG" : "en-GB", { dateStyle: "short", timeStyle: "short" });

  const run = (fn: () => Promise<{ ok?: boolean; error?: string }>) =>
    start(async () => {
      setErr(undefined);
      const r = await fn();
      if (r.ok) router.refresh();
      else setErr(t.upload.errors[r.error as keyof typeof t.upload.errors] ?? t.upload.errors.generic);
    });

  return (
    <li className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
      {p.preview && (
        <a href={p.preview} target="_blank" rel="noreferrer" className="block bg-ink">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.preview} alt="" className="mx-auto max-h-[60vh] w-auto" />
        </a>
      )}
      <div className="space-y-3 p-4 text-sm">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="num text-2xl font-bold">{p.vehicles?.fleet_number}</span>
          <span className="text-muted">
            {t.kinds[p.kind]} · {t.upload.line} {p.line} · {p.place}
          </span>
        </div>
        <p className="text-muted">
          <b className="text-ink">{p.author_name}</b> · {t.queue.uploaded} {date(p.created_at)}
          {p.taken_at && <> · {t.queue.taken} {date(p.taken_at)}</>}
        </p>
        {(p.ad || p.description) && (
          <p className="whitespace-pre-line rounded-lg bg-canvas p-2">
            {p.ad && <>📢 {p.ad}{"\n"}</>}
            {p.description}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={night} onChange={(e) => setNight(e.target.checked)} className="accent-sea-500" /> 🌙 {t.queue.night}</label>
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={rain} onChange={(e) => setRain(e.target.checked)} className="accent-sea-500" /> 🌧 {t.queue.rain}</label>
        </div>

        <div className="flex flex-wrap gap-2">
          <button disabled={pending} onClick={() => run(() => approvePhotoAction(p.id, { night, rain }))} className="rounded-xl bg-run px-5 py-2.5 font-semibold text-white disabled:opacity-60">
            ✓ {t.queue.approve}
          </button>
          <button disabled={pending} onClick={() => setMode(mode === "reject" ? "none" : "reject")} className="rounded-xl bg-scrapped/10 px-5 py-2.5 font-semibold text-scrapped">
            ✕ {t.queue.reject}
          </button>
          <button disabled={pending} onClick={() => setMode(mode === "edit" ? "none" : "edit")} className="rounded-xl border border-line px-4 py-2.5 font-semibold">
            ✎ {t.queue.edit}
          </button>
        </div>

        {mode === "reject" && (
          <div className="grid gap-2 rounded-xl bg-canvas p-3 sm:grid-cols-[auto_1fr_auto]">
            <select value={reason} onChange={(e) => setReason(e.target.value as RejectReason)} className={field} aria-label={t.queue.reason}>
              {REJECT_REASONS.map((r) => (
                <option key={r} value={r}>{t.reasons[r]}</option>
              ))}
            </select>
            <input value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder={t.queue.note} className={field} />
            <button disabled={pending} onClick={() => run(() => rejectPhotoAction(p.id, reason, note))} className="rounded-lg bg-scrapped px-4 py-2 font-semibold text-white">
              {t.queue.reject}
            </button>
          </div>
        )}

        {mode === "edit" && (
          <div className="grid gap-2 rounded-xl bg-canvas p-3 sm:grid-cols-[1fr_1fr_auto]">
            <input value={fleet} onChange={(e) => setFleet(e.target.value.replace(/\D/g, "").slice(0, 6))} className={`${field} num`} aria-label={t.upload.vehicle} />
            <input value={line} maxLength={12} onChange={(e) => setLine(e.target.value)} className={field} aria-label={t.upload.line} />
            <button disabled={pending} onClick={() => run(() => adminEditPhotoAction(p.id, fleet, line).then((r) => (r.ok && setMode("none"), r)))} className="rounded-lg bg-sea-500 px-4 py-2 font-semibold text-white">
              {t.queue.save}
            </button>
          </div>
        )}
        <FormError message={err} />
      </div>
    </li>
  );
}

export function ResolveClaim({ id, label }: { id: number; label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => start(async () => { await resolveClaimAction(id); router.refresh(); })}
      className="rounded-lg border border-line px-3 py-1 text-xs font-semibold hover:border-sea-300"
    >
      ✓ {label}
    </button>
  );
}
