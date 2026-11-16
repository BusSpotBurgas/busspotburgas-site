"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { FormState } from "@/lib/auth-actions";
import type { Dictionary } from "@/lib/i18n";
import { saveProfileAction } from "@/lib/profile-actions";
import { createClient } from "@/lib/supabase/client";
import { Field, FormError, FormOk, Submit } from "./ui";

type T = Pick<Dictionary, "onboarding" | "errors" | "settings">;
type ErrKey = keyof Dictionary["errors"];

const TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IN = 10 * 1024 * 1024;

/** Изрязва квадрат от средата и смалява до 512 px WebP (махат се и данните за GPS). */
async function toSquareWebp(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  canvas.getContext("2d")!.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, 512, 512);
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("blob"))), "image/webp", 0.86));
}

export function Avatar({ url, name, size = "size-20" }: { url?: string | null; name?: string | null; size?: string }) {
  const initial = (name ?? "?").trim().charAt(0).toUpperCase() || "?";
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" className={`${size} shrink-0 rounded-full object-cover ring-2 ring-white`} />
  ) : (
    <span className={`${size} grid shrink-0 place-items-center rounded-full bg-sea-100 font-display text-2xl font-bold text-sea-600 ring-2 ring-white`}>
      {initial}
    </span>
  );
}

export function ProfileForm({
  uid,
  t,
  initial,
  submitLabel,
  advance,
  onSaved,
}: {
  uid: string;
  t: T;
  initial: { display_name: string | null; tiktok: string | null; avatar_url: string | null };
  submitLabel: string;
  advance?: boolean;
  onSaved?: () => void;
}) {
  const [state, action] = useActionState(saveProfileAction, undefined as FormState);
  const [avatar, setAvatar] = useState(initial.avatar_url ?? "");
  const [name, setName] = useState(initial.display_name ?? "");
  const [uploading, setUploading] = useState(false);
  const [avatarErr, setAvatarErr] = useState<string>();
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state?.ok) onSaved?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  async function pick(file?: File) {
    setAvatarErr(undefined);
    if (!file) return;
    if (!TYPES.includes(file.type)) return setAvatarErr(t.errors.avatarType);
    if (file.size > MAX_IN) return setAvatarErr(t.errors.avatarTooBig);
    setUploading(true);
    try {
      const blob = await toSquareWebp(file);
      const db = createClient();
      const path = `${uid}/${Date.now()}.webp`;
      const { error } = await db.storage.from("avatars").upload(path, blob, { contentType: "image/webp", upsert: false });
      if (error) throw error;
      // Махаме старите снимки от папката
      const { data: old } = await db.storage.from("avatars").list(uid);
      const stale = (old ?? []).map((o) => `${uid}/${o.name}`).filter((p) => p !== path);
      if (stale.length) await db.storage.from("avatars").remove(stale);
      setAvatar(db.storage.from("avatars").getPublicUrl(path).data.publicUrl);
    } catch {
      setAvatarErr(t.errors.generic);
    } finally {
      setUploading(false);
    }
  }

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="avatar_url" value={avatar} />
      {advance && <input type="hidden" name="advance" value="1" />}

      <div className="flex items-center gap-4">
        <Avatar url={avatar} name={name} />
        <div>
          <p className="text-sm font-medium">{t.onboarding.avatar}</p>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="mt-1.5 rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:border-sea-300 hover:bg-sea-50 disabled:opacity-60"
          >
            {uploading ? "…" : avatar ? t.onboarding.changeAvatar : t.onboarding.chooseAvatar}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept={TYPES.join(",")}
            className="hidden"
            onChange={(e) => pick(e.target.files?.[0])}
          />
        </div>
      </div>
      <FormError message={avatarErr} />

      <Field
        label={t.onboarding.displayName}
        name="display_name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        minLength={2}
        maxLength={32}
        required
        autoComplete="nickname"
      />
      <Field
        label={t.onboarding.tiktok}
        hint={t.onboarding.tiktokHint}
        name="tiktok"
        defaultValue={initial.tiktok ?? ""}
        maxLength={25}
        pattern="@?[A-Za-z0-9._]{2,24}"
        autoCapitalize="none"
      />
      <FormError message={state?.error ? (t.errors[state.error as ErrKey] ?? t.errors.generic) : undefined} />
      {!advance && <FormOk message={state?.ok ? t.settings.saved : undefined} />}
      <Submit disabled={uploading}>{submitLabel}</Submit>
    </form>
  );
}
