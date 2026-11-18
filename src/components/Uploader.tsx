"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import Cropper from "react-easy-crop";
import type { Dictionary } from "@/lib/i18n";
import {
  INPUT_TYPES,
  MAX_INPUT_BYTES,
  blurBoxes,
  cropThumb,
  detectFaces,
  dhash,
  encode,
  loadScaled,
  readTakenAt,
  resized,
  watermark,
  DISPLAY_EDGE,
  type Area,
  type Box,
} from "@/lib/image";
import { claimPhotoAction, findSimilarAction, submitPhotoAction } from "@/lib/photo-actions";
import { FILE_LIMITS, LINE_RE, PHOTO_KINDS, type PhotoKind } from "@/lib/photo-shared";
import { createClient } from "@/lib/supabase/client";
import { FormError, fmt } from "./ui";

type T = { upload: Dictionary["upload"]; kinds: Dictionary["kinds"] };
type VehicleOption = { fleet_number: string; model: string };
type Similar = { photo_id: string; author_name: string; fleet_number: string };

const input =
  "block w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[15px] outline-none transition placeholder:text-muted/60 focus:border-sea-400 focus:ring-4 focus:ring-sea-100";

function copyCanvas(src: HTMLCanvasElement) {
  const c = document.createElement("canvas");
  c.width = src.width;
  c.height = src.height;
  c.getContext("2d")!.drawImage(src, 0, 0);
  return c;
}

export function Uploader({
  t,
  lang,
  uid,
  authorName,
  isAdmin,
  vehicles,
  initialFleet,
}: {
  t: T;
  lang: string;
  uid: string;
  authorName: string;
  isAdmin: boolean;
  vehicles: VehicleOption[];
  initialFleet?: string;
}) {
  const u = t.upload;
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [phase, setPhase] = useState<"pick" | "busy" | "faces" | "crop">("pick");
  const [busyText, setBusyText] = useState("");
  const [err, setErr] = useState<string>();

  const base = useRef<HTMLCanvasElement | null>(null);
  const [takenAt, setTakenAt] = useState<string | null>(null);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [preview, setPreview] = useState<string>();
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [similar, setSimilar] = useState<Similar[]>([]);
  const [claimed, setClaimed] = useState<string[]>([]);

  const [fleet, setFleet] = useState(initialFleet ?? "");
  const [search, setSearch] = useState(initialFleet ?? "");
  const [line, setLine] = useState("");
  const [place, setPlace] = useState("");
  const [kind, setKind] = useState<PhotoKind | "">("");
  const [ad, setAd] = useState("");
  const [description, setDescription] = useState("");
  const [rights, setRights] = useState(false);
  const [result, setResult] = useState<"pending" | "approved">();

  // Преглед със замазаните лица (обновява се при всяка промяна на замазванията)
  useEffect(() => {
    if (!base.current || (phase !== "faces" && phase !== "crop")) return;
    let url = "";
    let cancelled = false;
    const c = copyCanvas(base.current);
    blurBoxes(c, boxes);
    c.toBlob(
      (b) => {
        if (!b || cancelled) return;
        url = URL.createObjectURL(b);
        setPreview(url);
      },
      "image/jpeg",
      0.85
    );
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [boxes, phase]);

  async function pick(file?: File) {
    setErr(undefined);
    if (!file) return;
    if (!INPUT_TYPES.includes(file.type)) return setErr(u.errors.type);
    if (file.size > MAX_INPUT_BYTES) return setErr(u.errors.size);
    setPhase("busy");
    setBusyText(u.processing);
    try {
      const [c, taken] = await Promise.all([loadScaled(file), readTakenAt(file)]);
      if (Math.max(c.width, c.height) < 800) {
        setPhase("pick");
        return setErr(u.errors.small);
      }
      base.current = c;
      setTakenAt(taken);
      findSimilarAction(dhash(c)).then(setSimilar).catch(() => {});
      setBusyText(u.faces);
      let found: Box[] = [];
      try {
        found = await detectFaces(c);
      } catch (e) {
        console.warn("faces:", e); // ако моделът не зареди – ръчно замазване
      }
      setBoxes(found);
      setPhase("faces");
    } catch {
      setPhase("pick");
      setErr(u.errors.generic);
    }
  }

  function tapFace(e: MouseEvent<HTMLImageElement>) {
    const c = base.current;
    if (!c) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * c.width;
    const y = ((e.clientY - r.top) / r.height) * c.height;
    const hit = boxes.findIndex((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
    if (hit >= 0) return setBoxes(boxes.filter((_, i) => i !== hit));
    const s = Math.round(c.width * 0.07);
    setBoxes([...boxes, { x: Math.max(0, x - s / 2), y: Math.max(0, y - s / 2), w: s, h: s * 1.2 }]);
  }

  const matches = useMemo(() => {
    const q = search.trim();
    if (!q) return vehicles.slice(0, 24);
    return vehicles.filter((v) => v.fleet_number.includes(q)).slice(0, 24);
  }, [search, vehicles]);

  async function submit() {
    const c0 = base.current;
    if (!c0 || !area) return;
    setErr(undefined);
    if (!vehicles.some((v) => v.fleet_number === fleet)) return setErr(u.errors.vehicle);
    if (!LINE_RE.test(line.trim())) return setErr(u.errors.line);
    if (place.trim().length < 2) return setErr(u.errors.place);
    if (!kind) return setErr(u.errors.kind);

    setPhase("busy");
    setBusyText(u.uploading);
    const id = crypto.randomUUID();
    const db = createClient();
    const paths: string[] = [];
    try {
      const clean = copyCanvas(c0);
      blurBoxes(clean, boxes);
      const display = resized(clean, DISPLAY_EDGE);
      watermark(display, authorName);
      const [original, displayBlob, thumb] = await Promise.all([
        encode(clean, FILE_LIMITS.original, 0.86),
        encode(display, FILE_LIMITS.display, 0.84),
        encode(cropThumb(clean, area), FILE_LIMITS.thumb, 0.8),
      ]);
      for (const [name, blob] of [
        ["original", original],
        ["display", displayBlob],
        ["thumb", thumb],
      ] as const) {
        const path = `${uid}/${id}/${name}`;
        const { error } = await db.storage.from("photos-private").upload(path, blob, { contentType: blob.type, upsert: false });
        if (error) throw new Error("upload_missing");
        paths.push(path);
      }
      const r = await submitPhotoAction({
        id,
        fleet,
        kind,
        line: line.trim(),
        place: place.trim(),
        ad,
        description,
        rights,
        width: clean.width,
        height: clean.height,
        dhash: dhash(clean),
        takenAt,
      });
      if (!r.ok) throw new Error(r.error ?? "generic");
      setResult(r.status === "approved" ? "approved" : "pending");
      setStep(5);
    } catch (e) {
      if (paths.length) await db.storage.from("photos-private").remove(paths);
      const key = (e instanceof Error ? e.message : "generic") as keyof typeof u.errors;
      setErr(u.errors[key] ?? u.errors.generic);
      setPhase("crop");
    }
  }

  function reset() {
    base.current = null;
    setStep(1);
    setPhase("pick");
    setBoxes([]);
    setSimilar([]);
    setClaimed([]);
    setArea(null);
    setZoom(1);
    setCrop({ x: 0, y: 0 });
    setFleet(initialFleet ?? "");
    setSearch(initialFleet ?? "");
    setLine("");
    setPlace("");
    setKind("");
    setAd("");
    setDescription("");
    setRights(false);
    setResult(undefined);
    setErr(undefined);
  }

  const steps = [u.step1, u.step2, u.step3, u.step4];
  const busy = phase === "busy";

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="font-display text-3xl font-extrabold">{u.title}</h1>
      <p className="mt-2 text-muted">{u.lead}</p>

      {step < 5 && (
        <ol className="mt-6 grid grid-cols-4 gap-2">
          {steps.map((s, i) => (
            <li key={s} className="text-center">
              <div className={`h-1.5 rounded-full ${i + 1 <= step ? "bg-sea-500" : "bg-line"}`} />
              <span className={`mt-1.5 block text-xs font-medium ${i + 1 === step ? "text-sea-600" : "text-muted"}`}>{s}</span>
            </li>
          ))}
        </ol>
      )}

      <div className="mt-6 rounded-card border border-line bg-surface p-5 shadow-card sm:p-6">
        {busy && (
          <div className="flex flex-col items-center gap-3 py-12 text-muted">
            <span className="size-8 animate-spin rounded-full border-4 border-sea-100 border-t-sea-500" />
            {busyText}
          </div>
        )}

        {!busy && step === 1 && phase === "pick" && (
          <label className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-sea-200 bg-sea-50/50 px-4 py-14 text-center transition hover:border-sea-400">
            <span className="text-4xl" aria-hidden="true">📷</span>
            <span className="rounded-xl bg-sea-500 px-5 py-2.5 font-semibold text-white">{u.choose}</span>
            <span className="text-xs text-muted">{u.chooseHint}</span>
            <input type="file" accept={INPUT_TYPES.join(",")} className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
          </label>
        )}

        {!busy && step === 1 && phase === "faces" && preview && (
          <div className="space-y-4">
            <p className="text-sm text-muted">{boxes.length ? fmt(u.facesFound, { n: boxes.length }) : u.facesNone}</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt={u.faceTap} onClick={tapFace} className="w-full cursor-crosshair rounded-xl" />
            {similar.length > 0 && (
              <div className="rounded-xl border border-stop/30 bg-sand p-4 text-sm">
                <p className="font-semibold">{u.duplicateTitle}</p>
                <ul className="mt-2 space-y-2">
                  {similar.map((s) => (
                    <li key={s.photo_id} className="flex flex-wrap items-center justify-between gap-2">
                      <span>{fmt(u.duplicateBy, { n: s.fleet_number, author: s.author_name })}</span>
                      {claimed.includes(s.photo_id) ? (
                        <span className="text-xs text-run">{u.claimSent}</span>
                      ) : (
                        <button
                          type="button"
                          onClick={async () => {
                            const r = await claimPhotoAction(s.photo_id, "");
                            if (r.ok || r.error === "already") setClaimed((c) => [...c, s.photo_id]);
                          }}
                          className="rounded-lg border border-line bg-surface px-3 py-1 text-xs font-semibold hover:border-sea-300"
                        >
                          {u.claim}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex gap-3">
              <button type="button" onClick={reset} className="rounded-xl border border-line px-5 py-3 font-semibold hover:bg-canvas">
                {u.back}
              </button>
              <button type="button" onClick={() => setPhase("crop")} className="flex-1 rounded-xl bg-sea-500 px-5 py-3 font-semibold text-white hover:bg-sea-600">
                {similar.length ? u.duplicateContinue : u.next}
              </button>
            </div>
          </div>
        )}

        {!busy && step === 1 && phase === "crop" && preview && (
          <div className="space-y-4">
            <div>
              <p className="font-semibold">{u.cropTitle}</p>
              <p className="text-sm text-muted">{u.cropHint}</p>
            </div>
            <div className="relative aspect-video overflow-hidden rounded-xl bg-ink">
              <Cropper
                image={preview}
                crop={crop}
                zoom={zoom}
                aspect={16 / 9}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_, px) => setArea(px)}
              />
            </div>
            <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="w-full accent-sea-500" aria-label="zoom" />
            <div className="flex gap-3">
              <button type="button" onClick={() => setPhase("faces")} className="rounded-xl border border-line px-5 py-3 font-semibold hover:bg-canvas">
                {u.back}
              </button>
              <button type="button" disabled={!area} onClick={() => setStep(2)} className="flex-1 rounded-xl bg-sea-500 px-5 py-3 font-semibold text-white hover:bg-sea-600 disabled:opacity-50">
                {u.next}
              </button>
            </div>
          </div>
        )}

        {!busy && step === 2 && (
          <div className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">{u.vehicle}</span>
              <input
                className={`${input} num text-lg`}
                inputMode="numeric"
                value={search}
                placeholder={u.vehiclePlaceholder}
                onChange={(e) => {
                  setSearch(e.target.value.replace(/\D/g, "").slice(0, 6));
                  setFleet("");
                }}
              />
            </label>
            <ul className="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
              {matches.map((v) => (
                <li key={v.fleet_number}>
                  <button
                    type="button"
                    onClick={() => {
                      setFleet(v.fleet_number);
                      setSearch(v.fleet_number);
                    }}
                    aria-pressed={fleet === v.fleet_number}
                    className={`w-full rounded-xl border px-2 py-2 text-left transition ${
                      fleet === v.fleet_number ? "border-sea-500 bg-sea-500 text-white" : "border-line bg-surface hover:border-sea-300"
                    }`}
                  >
                    <span className="num block text-base font-bold">{v.fleet_number}</span>
                    <span className={`block truncate text-[11px] ${fleet === v.fleet_number ? "text-white/80" : "text-muted"}`}>{v.model}</span>
                  </button>
                </li>
              ))}
            </ul>
            <FormError message={err} />
            <Nav onBack={() => setStep(1)} onNext={() => (vehicles.some((v) => v.fleet_number === fleet) ? (setErr(undefined), setStep(3)) : setErr(u.errors.vehicle))} t={u} />
          </div>
        )}

        {!busy && step === 3 && (
          <div className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">{u.line}</span>
              <input className={input} value={line} maxLength={12} placeholder={u.linePlaceholder} onChange={(e) => setLine(e.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">{u.place}</span>
              <input className={input} value={place} maxLength={80} placeholder={u.placePlaceholder} onChange={(e) => setPlace(e.target.value)} />
            </label>
            <FormError message={err} />
            <Nav
              onBack={() => setStep(2)}
              onNext={() => {
                if (!LINE_RE.test(line.trim())) return setErr(u.errors.line);
                if (place.trim().length < 2) return setErr(u.errors.place);
                setErr(undefined);
                setStep(4);
              }}
              t={u}
            />
          </div>
        )}

        {!busy && step === 4 && (
          <div className="space-y-4">
            <fieldset>
              <legend className="mb-1.5 text-sm font-medium">{u.kind}</legend>
              <div className="grid grid-cols-2 gap-2">
                {PHOTO_KINDS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setKind(k)}
                    aria-pressed={kind === k}
                    className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${kind === k ? "border-sea-500 bg-sea-500 text-white" : "border-line hover:border-sea-300"}`}
                  >
                    {t.kinds[k]}
                  </button>
                ))}
              </div>
            </fieldset>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">{u.ad}</span>
              <input className={input} value={ad} maxLength={80} placeholder={u.adPlaceholder} onChange={(e) => setAd(e.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">{u.description}</span>
              <textarea className={`${input} min-h-24`} value={description} maxLength={500} onChange={(e) => setDescription(e.target.value)} />
            </label>
            <label className="flex items-start gap-2.5 text-sm">
              <input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} className="mt-0.5 size-4.5 shrink-0 accent-sea-500" />
              <span>{u.rights}</span>
            </label>
            <FormError message={err} />
            <div className="flex gap-3">
              <button type="button" onClick={() => setStep(3)} className="rounded-xl border border-line px-5 py-3 font-semibold hover:bg-canvas">
                {u.back}
              </button>
              <button type="button" onClick={submit} className="flex-1 rounded-xl bg-sea-500 px-5 py-3 font-semibold text-white hover:bg-sea-600">
                {isAdmin ? u.submitAdmin : u.submit}
              </button>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="py-6 text-center">
            <p className="font-display text-2xl font-extrabold">{u.doneTitle}</p>
            <p className="mt-2 text-muted">{result === "approved" ? u.doneApproved : u.donePending}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button type="button" onClick={reset} className="rounded-xl bg-sea-500 px-5 py-3 font-semibold text-white hover:bg-sea-600">
                {u.another}
              </button>
              <Link href={`/${lang}/me/photos`} className="rounded-xl border border-line px-5 py-3 font-semibold hover:bg-canvas">
                {u.myPhotos}
              </Link>
            </div>
          </div>
        )}

        {!busy && step === 1 && phase === "pick" && <div className="mt-3"><FormError message={err} /></div>}
      </div>
    </div>
  );
}

function Nav({ onBack, onNext, t }: { onBack: () => void; onNext: () => void; t: Dictionary["upload"] }) {
  return (
    <div className="flex gap-3">
      <button type="button" onClick={onBack} className="rounded-xl border border-line px-5 py-3 font-semibold hover:bg-canvas">
        {t.back}
      </button>
      <button type="button" onClick={onNext} className="flex-1 rounded-xl bg-sea-500 px-5 py-3 font-semibold text-white hover:bg-sea-600">
        {t.next}
      </button>
    </div>
  );
}
