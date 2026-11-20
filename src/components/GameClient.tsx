"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import type { Dictionary } from "@/lib/i18n";
import { adminReviewVideoAction, submitVideoAction, votePotmAction } from "@/lib/game-actions";
import { FormError, FormOk } from "./ui";

/** Конфети при нова значка или ранг. */
export function Confetti({ fire }: { fire: boolean }) {
  useEffect(() => {
    if (!fire || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    import("canvas-confetti").then(({ default: confetti }) => {
      const colors = ["#0B6FA4", "#3B98D0", "#16A34A", "#D97706", "#ffffff"];
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.3 }, colors });
      setTimeout(() => confetti({ particleCount: 80, spread: 100, origin: { y: 0.4 }, colors }), 350);
    });
  }, [fire]);
  return null;
}

export function PotmVoteButton({ photoId, voted, own, t }: { photoId: string; voted: boolean; own: boolean; t: Dictionary["game"] }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  if (own) return <span className="text-xs text-muted">{t.potmOwn}</span>;
  if (voted) return <span className="text-xs font-semibold text-run">{t.potmVoted}</span>;
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => start(async () => { await votePotmAction(photoId); router.refresh(); })}
      className="rounded-lg bg-sea-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sea-600 disabled:opacity-60"
    >
      {t.potmVoteBtn}
    </button>
  );
}

export function VideoForm({ fleet, t }: { fleet: string; t: Dictionary["video"] }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [msg, setMsg] = useState<string>();
  const [err, setErr] = useState<string>();
  const [busy, start] = useTransition();
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold">{t.add}</p>
      <div className="flex gap-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={t.placeholder}
          inputMode="url"
          className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-sea-400"
        />
        <button
          type="button"
          disabled={busy || !url.trim()}
          onClick={() =>
            start(async () => {
              setErr(undefined);
              setMsg(undefined);
              const r = await submitVideoAction(fleet, url);
              if (r.ok) {
                setUrl("");
                setMsg(r.value === "approved" ? undefined : t.sent);
                router.refresh();
              } else setErr(r.error === "duplicate" ? t.duplicate : r.error === "invalid" ? t.invalid : "…");
            })
          }
          className="rounded-xl bg-sea-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sea-600 disabled:opacity-60"
        >
          {t.send}
        </button>
      </div>
      <FormError message={err} />
      <FormOk message={msg} />
    </div>
  );
}

export function VideoReview({ id, labels }: { id: number; labels: { approve: string; reject: string } }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const go = (ok: boolean) => start(async () => { await adminReviewVideoAction(id, ok); router.refresh(); });
  return (
    <span className="flex shrink-0 gap-2">
      <button disabled={busy} onClick={() => go(true)} className="rounded-lg bg-run px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">✓ {labels.approve}</button>
      <button disabled={busy} onClick={() => go(false)} className="rounded-lg bg-scrapped/10 px-3 py-1.5 text-xs font-semibold text-scrapped disabled:opacity-60">✕ {labels.reject}</button>
    </span>
  );
}
