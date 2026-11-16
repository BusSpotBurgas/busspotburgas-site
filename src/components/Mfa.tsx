"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import type { Dictionary } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { FormError } from "./ui";

type T = Pick<Dictionary, "auth" | "errors" | "admin">;

function CodeInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      <input
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={6}
        required
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
        className="num block w-full rounded-xl border border-line bg-surface px-3.5 py-3 text-center text-2xl tracking-[0.5em] outline-none focus:border-sea-400 focus:ring-4 focus:ring-sea-100"
      />
    </label>
  );
}

function VerifyButton({ busy, label }: { busy: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="w-full rounded-xl bg-sea-500 px-5 py-3 font-semibold text-white transition hover:bg-sea-600 disabled:opacity-60"
    >
      {label}
    </button>
  );
}

/** Въвеждане на кода при вход (за акаунти с включена 2FA). */
export function MfaVerify({ t, next }: { t: T; next: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(undefined);
    const db = createClient();
    const { data } = await db.auth.mfa.listFactors();
    const factor = data?.totp.find((f) => f.status === "verified");
    if (!factor) {
      setErr(t.errors.generic);
      setBusy(false);
      return;
    }
    const { error } = await db.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
    if (error) {
      setErr(t.errors.mfaInvalid);
      setCode("");
      setBusy(false);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <CodeInput value={code} onChange={setCode} label={t.auth.code} />
      <FormError message={err} />
      <VerifyButton busy={busy || code.length !== 6} label={t.auth.verify} />
    </form>
  );
}

/** Включване на 2FA: QR код за Google Authenticator + проверка на първия код. */
export function MfaEnroll({ t, friendlyName, onDone }: { t: T; friendlyName: string; onDone?: () => void }) {
  const router = useRouter();
  const [factor, setFactor] = useState<{ id: string; qr: string; secret: string }>();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();

  async function start() {
    setBusy(true);
    setErr(undefined);
    const db = createClient();
    // Махаме недовършени опити, иначе Supabase не дава нов
    const { data: list } = await db.auth.mfa.listFactors();
    for (const f of list?.all ?? []) {
      if (f.status !== "verified") await db.auth.mfa.unenroll({ factorId: f.id });
    }
    const { data, error } = await db.auth.mfa.enroll({
      factorType: "totp",
      issuer: "busspotburgas",
      friendlyName: `${friendlyName} ${new Date().toISOString().slice(0, 16).replace("T", " ")}`,
    });
    setBusy(false);
    if (error || !data) return setErr(t.errors.generic);
    setFactor({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    if (!factor) return;
    setBusy(true);
    const { error } = await createClient().auth.mfa.challengeAndVerify({ factorId: factor.id, code });
    setBusy(false);
    if (error) {
      setCode("");
      return setErr(t.errors.mfaInvalid);
    }
    onDone?.();
    router.refresh();
  }

  if (!factor) {
    return (
      <div className="space-y-3">
        <FormError message={err} />
        <button
          type="button"
          onClick={start}
          disabled={busy}
          className="rounded-xl bg-sea-500 px-5 py-3 font-semibold text-white hover:bg-sea-600 disabled:opacity-60"
        >
          {t.admin.start}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={verify} className="space-y-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={factor.qr} alt="QR" className="mx-auto size-52 rounded-xl border border-line bg-white p-2" />
      <p className="text-center text-xs text-muted">
        {t.admin.secretLabel}
        <br />
        <code className="mt-1 inline-block break-all rounded bg-canvas px-2 py-1 text-[13px] text-ink">{factor.secret}</code>
      </p>
      <CodeInput value={code} onChange={setCode} label={t.auth.code} />
      <FormError message={err} />
      <VerifyButton busy={busy || code.length !== 6} label={t.auth.verify} />
    </form>
  );
}

/** Списък с устройствата за код + махане (само при вход с код). */
export function MfaFactors({ t }: { t: T }) {
  const router = useRouter();
  const [factors, setFactors] = useState<{ id: string; name: string }[]>([]);
  const [adding, setAdding] = useState(false);

  const load = () =>
    createClient()
      .auth.mfa.listFactors()
      .then(({ data }) =>
        setFactors((data?.totp ?? []).filter((f) => f.status === "verified").map((f) => ({ id: f.id, name: f.friendly_name ?? "TOTP" })))
      );
  useEffect(() => {
    createClient()
      .auth.mfa.listFactors()
      .then(({ data }) =>
        setFactors((data?.totp ?? []).filter((f) => f.status === "verified").map((f) => ({ id: f.id, name: f.friendly_name ?? "TOTP" })))
      );
  }, []);

  async function remove(id: string) {
    if (factors.length <= 1) return; // последното устройство не се маха – админът остава защитен
    await createClient().auth.mfa.unenroll({ factorId: id });
    await load();
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <ul className="divide-y divide-line rounded-xl border border-line">
        {factors.map((f) => (
          <li key={f.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
            <span>🔐 {f.name}</span>
            {factors.length > 1 && (
              <button type="button" onClick={() => remove(f.id)} className="text-scrapped hover:underline">
                {t.admin.remove}
              </button>
            )}
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted">{t.admin.backupNote}</p>
      {adding ? (
        <MfaEnroll t={t} friendlyName="backup" onDone={() => { setAdding(false); load(); }} />
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="text-sm font-semibold text-sea-600 hover:underline">
          + {t.admin.addBackup}
        </button>
      )}
    </div>
  );
}
