"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { Dictionary } from "@/lib/i18n";
import type { Comment } from "@/lib/social";
import {
  addCommentAction,
  adminRemovePartnerAction,
  answerInviteAction,
  cancelInviteAction,
  deleteCommentAction,
  leaveVehicleAction,
  rateVehicleAction,
  reportAction,
  requestPartnerAction,
  submitDescriptionAction,
  toggleFollowAction,
  toggleLikeAction,
  voteOwnerAction,
} from "@/lib/social-actions";
import { Avatar } from "./ProfileForm";
import { FormError, FormOk } from "./ui";

type S = Dictionary["social"];
const btn = "rounded-xl px-4 py-2 text-sm font-semibold transition disabled:opacity-60";
const field = "block w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-sea-400 focus:ring-4 focus:ring-sea-100";

// ── Звезди ───────────────────────────────────────────────────────────────

function Stars({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm">{label}</span>
      <span className="flex" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n}`}
            onClick={() => onChange(n)}
            className={`px-0.5 text-2xl leading-none transition ${n <= value ? "text-stop" : "text-line hover:text-stop/50"}`}
          >
            ★
          </button>
        ))}
      </span>
    </div>
  );
}

export function RateForm({ fleet, initial, t }: { fleet: string; initial: { look: number; comfort: number; sound: number; rarity: number } | null; t: S }) {
  const router = useRouter();
  const [r, setR] = useState(initial ?? { look: 0, comfort: 0, sound: 0, rarity: 0 });
  const [msg, setMsg] = useState<string>();
  const [pending, start] = useTransition();
  const ready = r.look && r.comfort && r.sound && r.rarity;
  return (
    <div className="space-y-2">
      <p className="font-semibold">{t.rateTitle}</p>
      {(["look", "comfort", "sound", "rarity"] as const).map((k) => (
        <Stars key={k} label={t[k]} value={r[k]} onChange={(v) => setR({ ...r, [k]: v })} />
      ))}
      <button
        type="button"
        disabled={!ready || pending}
        onClick={() =>
          start(async () => {
            const res = await rateVehicleAction(fleet, r);
            if (res.ok) {
              setMsg(t.ratingSaved);
              router.refresh();
            }
          })
        }
        className={`${btn} mt-1 w-full bg-sea-500 text-white hover:bg-sea-600`}
      >
        {t.saveRating}
      </button>
      <FormOk message={msg} />
    </div>
  );
}

// ── Харесване ────────────────────────────────────────────────────────────

export function LikeButton({ photoId, liked: initialLiked, count: initialCount, t, canLike }: { photoId: string; liked: boolean; count: number; t: S; canLike: boolean }) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={!canLike || pending}
      title={canLike ? t.like : t.loginToComment}
      aria-pressed={liked}
      onClick={() =>
        start(async () => {
          setLiked(!liked);
          setCount(count + (liked ? -1 : 1));
          const r = await toggleLikeAction(photoId);
          if (!r.ok) {
            setLiked(liked);
            setCount(count);
          }
        })
      }
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 font-semibold transition ${
        liked ? "border-scrapped/30 bg-scrapped/10 text-scrapped" : "border-line bg-surface hover:border-scrapped/40"
      }`}
    >
      <span className="text-lg" aria-hidden="true">{liked ? "♥" : "♡"}</span>
      {count} <span className="sr-only">{t.likes}</span>
    </button>
  );
}

// ── Следване ─────────────────────────────────────────────────────────────

export function FollowButton({ type, id, following: initial, t }: { type: "spotter" | "vehicle" | "line"; id: string; following: boolean; t: S }) {
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      aria-pressed={on}
      onClick={() =>
        start(async () => {
          const r = await toggleFollowAction(type, id);
          if (r.ok) setOn(Boolean(r.value));
        })
      }
      className={`${btn} border ${on ? "border-sea-500 bg-sea-50 text-sea-600" : "border-line bg-surface hover:border-sea-300"}`}
    >
      {on ? `✓ ${t.following}` : `+ ${t.follow}`}
    </button>
  );
}

// ── Коментари ────────────────────────────────────────────────────────────

function CommentItem({ c, lang, t, uid, onReply, photoId }: { c: Comment; lang: string; t: S; uid: string | null; onReply?: () => void; photoId: string }) {
  const router = useRouter();
  const [reported, setReported] = useState(false);
  const [pending, start] = useTransition();
  return (
    <div className="flex gap-3">
      <Avatar url={c.profiles?.avatar_url} name={c.profiles?.display_name} size="size-8 text-sm" />
      <div className="min-w-0 flex-1">
        <p className="text-sm">
          {c.user_id ? (
            <Link href={`/${lang}/spotter/${c.user_id}`} className="font-semibold hover:underline">{c.profiles?.display_name}</Link>
          ) : (
            <span className="font-semibold text-muted">—</span>
          )}
          <span className="ml-2 text-xs text-muted">{new Date(c.created_at).toLocaleDateString(lang === "bg" ? "bg-BG" : "en-GB")}</span>
          {c.status !== "approved" && <span className="ml-2 rounded bg-stop/10 px-1.5 text-xs text-stop">{t.pendingBadge}</span>}
        </p>
        {/* Само обикновен текст – без HTML */}
        <p className="whitespace-pre-line break-words text-sm">{c.body}</p>
        <div className="mt-1 flex gap-3 text-xs text-muted">
          {onReply && uid && <button type="button" onClick={onReply} className="hover:text-ink">{t.reply}</button>}
          {uid && uid !== c.user_id && (
            reported ? <span>{t.reported}</span> : (
              <button type="button" onClick={() => start(async () => { await reportAction("comment", String(c.id)); setReported(true); })} className="hover:text-ink">
                {t.report}
              </button>
            )
          )}
          {uid && uid === c.user_id && (
            <button type="button" disabled={pending} onClick={() => start(async () => { await deleteCommentAction(c.id, photoId); router.refresh(); })} className="hover:text-scrapped">
              {t.delete}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function Comments({ photoId, comments, pending, uid, lang, t }: { photoId: string; comments: Comment[]; pending: Comment[]; uid: string | null; lang: string; t: S }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [msg, setMsg] = useState<string>();
  const [err, setErr] = useState<string>();
  const [busy, start] = useTransition();
  const all = [...comments, ...pending];
  const roots = all.filter((c) => !c.parent_id);

  const send = () =>
    start(async () => {
      setErr(undefined);
      const r = await addCommentAction(photoId, text, replyTo ?? undefined);
      if (r.ok) {
        setText("");
        setReplyTo(null);
        setMsg(r.value === "pending" ? t.commentPending : undefined);
        router.refresh();
      } else setErr(r.error === "rate_limit" ? t.rateLimit : r.error === "empty" ? undefined : "…");
    });

  return (
    <section className="space-y-4">
      <h2 className="font-display text-lg font-bold">{t.comments} <span className="text-muted">· {comments.length}</span></h2>
      {roots.length === 0 && <p className="text-sm text-muted">{t.noComments}</p>}
      <ul className="space-y-4">
        {roots.map((c) => (
          <li key={c.id} className="space-y-3">
            <CommentItem c={c} lang={lang} t={t} uid={uid} photoId={photoId} onReply={() => setReplyTo(c.id)} />
            <ul className="ml-11 space-y-3 border-l border-line pl-4">
              {all.filter((r) => r.parent_id === c.id).map((r) => (
                <li key={r.id}><CommentItem c={r} lang={lang} t={t} uid={uid} photoId={photoId} /></li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      {uid ? (
        <div className="space-y-2">
          {replyTo && (
            <p className="text-xs text-muted">
              ↳ {t.reply}: {all.find((c) => c.id === replyTo)?.profiles?.display_name}{" "}
              <button type="button" className="underline" onClick={() => setReplyTo(null)}>✕</button>
            </p>
          )}
          <textarea value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} placeholder={t.writeComment} className={`${field} min-h-20`} />
          <FormError message={err} />
          <FormOk message={msg} />
          <button type="button" disabled={busy || !text.trim()} onClick={send} className={`${btn} bg-sea-500 text-white hover:bg-sea-600`}>{t.send}</button>
        </div>
      ) : (
        <p className="text-sm text-muted">
          <Link href={`/${lang}/login`} className="font-semibold text-sea-600 hover:underline">{t.loginToComment}</Link>
        </p>
      )}
    </section>
  );
}

// ── Титуляри на страницата на колата ──────────────────────────────────────

export function RequestPartner({ fleet, pending: initialPending, t }: { fleet: string; pending: boolean; t: S }) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [done, setDone] = useState(initialPending ? t.requestPending : "");
  const [busy, start] = useTransition();
  if (done) return <FormOk message={done} />;
  if (!open) return <button type="button" onClick={() => setOpen(true)} className={`${btn} w-full border border-sea-300 text-sea-600 hover:bg-sea-50`}>🤝 {t.requestPartner}</button>;
  return (
    <div className="space-y-2">
      <textarea value={msg} maxLength={300} onChange={(e) => setMsg(e.target.value)} placeholder={t.requestMessage} className={`${field} min-h-16`} />
      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(false)} className={`${btn} border border-line`}>{t.cancel}</button>
        <button
          type="button"
          disabled={busy}
          onClick={() => start(async () => {
            const r = await requestPartnerAction(fleet, msg);
            setDone(r.ok ? t.requestSent : r.error === "pending" ? t.requestPending : "…");
          })}
          className={`${btn} flex-1 bg-sea-500 text-white hover:bg-sea-600`}
        >
          {t.send}
        </button>
      </div>
    </div>
  );
}

export function LeaveVehicle({ fleet, t }: { fleet: string; t: S }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        if (!confirm(t.leaveConfirm)) return;
        start(async () => { await leaveVehicleAction(fleet); router.refresh(); });
      }}
      className="text-xs text-muted hover:text-scrapped"
    >
      {t.leave}
    </button>
  );
}

export function RemovePartner({ fleet, userId, t }: { fleet: string; userId: string; t: S }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => start(async () => { await adminRemovePartnerAction(fleet, userId); router.refresh(); })}
      className="text-xs text-scrapped hover:underline"
    >
      {t.removePartner}
    </button>
  );
}

export function DescriptionEditor({ fleet, current, t, isAdmin }: { fleet: string; current: string | null; t: S; isAdmin: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(current ?? "");
  const [msg, setMsg] = useState<string>();
  const [busy, start] = useTransition();
  if (!open)
    return (
      <>
        <FormOk message={msg} />
        <button type="button" onClick={() => setOpen(true)} className="mt-2 text-sm font-semibold text-sea-600 hover:underline">✎ {t.editDescription}</button>
      </>
    );
  return (
    <div className="mt-2 space-y-2">
      <textarea value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} className={`${field} min-h-28`} />
      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(false)} className={`${btn} border border-line`}>{t.cancel}</button>
        <button
          type="button"
          disabled={busy}
          onClick={() => start(async () => {
            const r = await submitDescriptionAction(fleet, text);
            if (r.ok) {
              setOpen(false);
              setMsg(isAdmin ? undefined : t.descriptionPending);
              router.refresh();
            }
          })}
          className={`${btn} bg-sea-500 text-white hover:bg-sea-600`}
        >
          {t.save}
        </button>
      </div>
    </div>
  );
}

// ── „Моят профил“: покани и гласувания ───────────────────────────────────

export function InviteAnswer({ id, t }: { id: number; t: S }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const go = (accept: boolean) => start(async () => { await answerInviteAction(id, accept); router.refresh(); });
  return (
    <span className="flex gap-2">
      <button type="button" disabled={busy} onClick={() => go(true)} className={`${btn} bg-run text-white`}>{t.accept}</button>
      <button type="button" disabled={busy} onClick={() => go(false)} className={`${btn} border border-line`}>{t.decline}</button>
    </span>
  );
}

export function CancelInvite({ id, t }: { id: number; t: S }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  return (
    <button type="button" disabled={busy} onClick={() => start(async () => { await cancelInviteAction(id); router.refresh(); })} className="text-xs text-muted hover:text-scrapped">
      {t.cancelRequest}
    </button>
  );
}

export function VoteOwner({ election, candidates, myVote }: { election: number; candidates: { id: string; name: string }[]; myVote: string | null; t?: S }) {
  const router = useRouter();
  const [vote, setVote] = useState(myVote);
  const [busy, start] = useTransition();
  return (
    <div className="flex flex-wrap gap-2">
      {candidates.map((c) => (
        <button
          key={c.id}
          type="button"
          disabled={busy}
          aria-pressed={vote === c.id}
          onClick={() => start(async () => { const r = await voteOwnerAction(election, c.id); if (r.ok) { setVote(c.id); router.refresh(); } })}
          className={`${btn} border ${vote === c.id ? "border-sea-500 bg-sea-500 text-white" : "border-line hover:border-sea-300"}`}
        >
          {vote === c.id ? "✓ " : ""}{c.name}
        </button>
      ))}
    </div>
  );
}
