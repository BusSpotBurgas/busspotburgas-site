"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { adminDecideElectionAction, adminReviewCommentAction, adminReviewDescriptionAction, resolveReportAction } from "@/lib/social-actions";

const btn = "rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-60";

function useAct() {
  const router = useRouter();
  const [busy, start] = useTransition();
  return { busy, run: (fn: () => Promise<unknown>) => start(async () => { await fn(); router.refresh(); }) };
}

export function CommentReview({ id, labels }: { id: number; labels: { approve: string; reject: string } }) {
  const { busy, run } = useAct();
  return (
    <span className="flex shrink-0 gap-2">
      <button disabled={busy} onClick={() => run(() => adminReviewCommentAction(id, true))} className={`${btn} bg-run text-white`}>✓ {labels.approve}</button>
      <button disabled={busy} onClick={() => run(() => adminReviewCommentAction(id, false))} className={`${btn} bg-scrapped/10 text-scrapped`}>✕ {labels.reject}</button>
    </span>
  );
}

export function DescriptionReview({ vehicleId, fleet, labels }: { vehicleId: number; fleet: string; labels: { approve: string; reject: string } }) {
  const { busy, run } = useAct();
  return (
    <span className="flex shrink-0 gap-2">
      <button disabled={busy} onClick={() => run(() => adminReviewDescriptionAction(vehicleId, true, fleet))} className={`${btn} bg-run text-white`}>✓ {labels.approve}</button>
      <button disabled={busy} onClick={() => run(() => adminReviewDescriptionAction(vehicleId, false, fleet))} className={`${btn} bg-scrapped/10 text-scrapped`}>✕ {labels.reject}</button>
    </span>
  );
}

export function ReportResolve({ id, label }: { id: number; label: string }) {
  const { busy, run } = useAct();
  return <button disabled={busy} onClick={() => run(() => resolveReportAction(id))} className={`${btn} border border-line`}>✓ {label}</button>;
}

export function ElectionDecide({ id, candidates, label }: { id: number; candidates: { id: string; name: string }[]; label: string }) {
  const { busy, run } = useAct();
  return (
    <span className="flex flex-wrap gap-2">
      {candidates.map((c) => (
        <button key={c.id} disabled={busy} onClick={() => run(() => adminDecideElectionAction(id, c.id))} className={`${btn} border border-line hover:border-sea-300`}>
          {label}: {c.name}
        </button>
      ))}
    </span>
  );
}
