"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { Dictionary } from "@/lib/i18n";
import { deletePhotoAction, editPhotoAction } from "@/lib/photo-actions";
import { PHOTO_KINDS, publicPhotoUrl, type PhotoKind, type PhotoRow } from "@/lib/photo-shared";
import { FormError } from "./ui";

type T = Pick<Dictionary, "myPhotos" | "photoStatus" | "reasons" | "kinds" | "upload">;

const STATUS_CLS = {
  pending: "bg-stop/10 text-stop",
  approved: "bg-run/10 text-run",
  rejected: "bg-scrapped/10 text-scrapped",
};

const field = "block w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-sea-400";

export function MyPhotoItem({ p, t, lang }: { p: PhotoRow & { preview?: string }; t: T; lang: string }) {
  const router = useRouter();
  const [edit, setEdit] = useState(false);
  const [err, setErr] = useState<string>();
  const [pending, start] = useTransition();
  const [f, setF] = useState({
    fleet: p.vehicles?.fleet_number ?? "",
    kind: p.kind as PhotoKind,
    line: p.line,
    place: p.place,
    ad: p.ad ?? "",
    description: p.description ?? "",
  });
  const img = p.status === "approved" ? publicPhotoUrl(p.id, "thumb") : p.preview;

  return (
    <li className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
      <div className="flex gap-4 p-3">
        <Link href={p.status === "approved" ? `/${lang}/photo/${p.id}` : "#"} className="block aspect-video w-40 shrink-0 overflow-hidden rounded-lg bg-canvas sm:w-52">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {img && <img src={img} alt="" className="size-full object-cover" loading="lazy" />}
        </Link>
        <div className="min-w-0 flex-1 space-y-1 text-sm">
          <p className="flex flex-wrap items-center gap-2">
            <span className="num text-lg font-bold">{p.vehicles?.fleet_number}</span>
            <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${STATUS_CLS[p.status]}`}>{t.photoStatus[p.status]}</span>
          </p>
          <p className="text-muted">
            {t.kinds[p.kind]} · {p.line} · {p.place}
          </p>
          {p.edited_by_admin && <p className="text-xs text-sea-600">{t.myPhotos.editedByAdmin}</p>}
          {p.status === "rejected" && (
            <p className="text-scrapped">
              {t.myPhotos.reason}: {p.reject_reason ? t.reasons[p.reject_reason] : "—"}
              {p.reject_note ? ` – ${p.reject_note}` : ""}
            </p>
          )}
          <div className="flex flex-wrap gap-3 pt-1">
            {p.status !== "approved" && (
              <button type="button" onClick={() => setEdit(!edit)} className="font-semibold text-sea-600 hover:underline">
                {t.myPhotos.fix}
              </button>
            )}
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (!confirm(t.myPhotos.deleteConfirm)) return;
                start(async () => {
                  await deletePhotoAction(p.id);
                  router.refresh();
                });
              }}
              className="text-muted hover:text-scrapped"
            >
              {t.myPhotos.delete}
            </button>
          </div>
        </div>
      </div>

      {edit && (
        <form
          className="grid gap-3 border-t border-line bg-canvas p-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            setErr(undefined);
            start(async () => {
              const r = await editPhotoAction(p.id, f);
              if (r.ok) {
                setEdit(false);
                router.refresh();
              } else setErr(t.upload.errors[r.error as keyof typeof t.upload.errors] ?? t.upload.errors.generic);
            });
          }}
        >
          <label className="text-xs font-medium">
            {t.upload.vehicle}
            <input className={`${field} num mt-1`} value={f.fleet} onChange={(e) => setF({ ...f, fleet: e.target.value.replace(/\D/g, "").slice(0, 6) })} />
          </label>
          <label className="text-xs font-medium">
            {t.upload.kind}
            <select className={`${field} mt-1`} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as PhotoKind })}>
              {PHOTO_KINDS.map((k) => (
                <option key={k} value={k}>
                  {t.kinds[k]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium">
            {t.upload.line}
            <input className={`${field} mt-1`} value={f.line} maxLength={12} onChange={(e) => setF({ ...f, line: e.target.value })} />
          </label>
          <label className="text-xs font-medium">
            {t.upload.place}
            <input className={`${field} mt-1`} value={f.place} maxLength={80} onChange={(e) => setF({ ...f, place: e.target.value })} />
          </label>
          <label className="text-xs font-medium">
            {t.upload.ad}
            <input className={`${field} mt-1`} value={f.ad} maxLength={80} onChange={(e) => setF({ ...f, ad: e.target.value })} />
          </label>
          <label className="text-xs font-medium sm:col-span-2">
            {t.upload.description}
            <textarea className={`${field} mt-1`} value={f.description} maxLength={500} onChange={(e) => setF({ ...f, description: e.target.value })} />
          </label>
          <div className="sm:col-span-2">
            <FormError message={err} />
            <button disabled={pending} className="mt-2 rounded-lg bg-sea-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sea-600 disabled:opacity-60">
              {t.myPhotos.save}
            </button>
          </div>
        </form>
      )}
    </li>
  );
}
