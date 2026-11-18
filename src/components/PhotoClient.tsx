"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { claimPhotoAction, originalUrlAction } from "@/lib/photo-actions";

/** Плъзгане наляво/надясно и стрелки за предишна/следваща снимка. */
export function SwipeNav({ prev, next, children }: { prev: string | null; next: string | null; children: ReactNode }) {
  const router = useRouter();
  const start = useRef<number | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && prev) router.push(prev);
      if (e.key === "ArrowRight" && next) router.push(next);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prev, next, router]);
  return (
    <div
      onTouchStart={(e) => (start.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (start.current === null) return;
        const dx = e.changedTouches[0].clientX - start.current;
        start.current = null;
        if (dx > 60 && prev) router.push(prev);
        if (dx < -60 && next) router.push(next);
      }}
    >
      {children}
    </div>
  );
}

export function DownloadOriginal({ id, label }: { id: string; label: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const url = await originalUrlAction(id);
          if (url) window.location.href = url;
        })
      }
      className="rounded-xl border border-line px-4 py-2 text-sm font-semibold hover:border-sea-300 disabled:opacity-60"
    >
      ⬇ {label}
    </button>
  );
}

export function ClaimButton({ id, t }: { id: string; t: { claim: string; claimNote: string; claimSent: string; claimAlready: string } }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string>();
  const [pending, start] = useTransition();
  if (msg) return <p className="text-sm text-run">{msg}</p>;
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-sm text-muted underline hover:text-ink">
        {t.claim}
      </button>
    );
  return (
    <div className="space-y-2">
      <textarea
        value={note}
        maxLength={300}
        onChange={(e) => setNote(e.target.value)}
        placeholder={t.claimNote}
        className="block w-full rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-sea-400"
      />
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await claimPhotoAction(id, note);
            setMsg(r.ok ? t.claimSent : r.error === "already" ? t.claimAlready : "…");
          })
        }
        className="rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white"
      >
        {t.claim}
      </button>
    </div>
  );
}
