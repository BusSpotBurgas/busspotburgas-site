"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState, useState } from "react";
import {
  forgotPasswordAction,
  googleAction,
  resetPasswordAction,
  signInAction,
  signUpAction,
  type FormState,
} from "@/lib/auth-actions";
import type { Dictionary } from "@/lib/i18n";
import { Turnstile } from "./Turnstile";
import { Check, Field, FormError, FormOk, Submit } from "./ui";

type T = Pick<Dictionary, "auth" | "errors">;
type ErrKey = keyof Dictionary["errors"];
const errText = (t: T, s: FormState) => (s?.error ? (t.errors[s.error as ErrKey] ?? t.errors.generic) : undefined);

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export function GoogleButton({ lang, label, next }: { lang: string; label: string; next?: string }) {
  return (
    <form action={googleAction}>
      <input type="hidden" name="lang" value={lang} />
      {next && <input type="hidden" name="next" value={next} />}
      <button
        type="submit"
        className="flex w-full items-center justify-center gap-3 rounded-xl border border-line bg-surface px-5 py-3 font-semibold text-ink transition hover:border-sea-300 hover:bg-sea-50"
      >
        <GoogleIcon /> {label}
      </button>
    </form>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wider text-muted">
      <span className="h-px flex-1 bg-line" /> {label} <span className="h-px flex-1 bg-line" />
    </div>
  );
}

export function LoginForm({ lang, t }: { lang: string; t: T }) {
  const params = useSearchParams();
  const next = params.get("next") ?? undefined;
  const initialError = ["oauth", "link"].includes(params.get("error") ?? "") ? params.get("error")! : undefined;
  const [state, action] = useActionState(signInAction, initialError ? { error: initialError } : undefined);
  const [ready, setReady] = useState(false);
  return (
    <>
      <GoogleButton lang={lang} label={t.auth.google} next={next} />
      <Divider label={t.auth.or} />
      <form action={action} className="space-y-4">
        <input type="hidden" name="lang" value={lang} />
        {next && <input type="hidden" name="next" value={next} />}
        <Field label={t.auth.email} name="email" type="email" autoComplete="email" required />
        <Field label={t.auth.password} name="password" type="password" autoComplete="current-password" required />
        <div className="text-right text-sm">
          <Link href={`/${lang}/forgot-password`} className="text-sea-600 hover:underline">
            {t.auth.forgot}
          </Link>
        </div>
        <Turnstile lang={lang} resetKey={state} onReady={setReady} failedText={t.errors.captchaRetry} />
        <FormError message={errText(t, state)} />
        <Submit disabled={!ready}>{t.auth.submitLogin}</Submit>
      </form>
    </>
  );
}

export function RegisterForm({ lang, t }: { lang: string; t: T }) {
  const [state, action] = useActionState(signUpAction, undefined);
  const [ready, setReady] = useState(false);
  return (
    <>
      <GoogleButton lang={lang} label={t.auth.google} />
      <Divider label={t.auth.or} />
      <form action={action} className="space-y-4">
        <input type="hidden" name="lang" value={lang} />
        <Field label={t.auth.email} name="email" type="email" autoComplete="email" required />
        <Field
          label={t.auth.password}
          hint={t.auth.passwordHint}
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          maxLength={72}
          required
        />
        <div className="space-y-2.5 pt-1">
          <Check name="age">{t.auth.age}</Check>
          <Check name="terms">
            {t.auth.termsPre}{" "}
            <Link href={`/${lang}/rules`} target="_blank" className="text-sea-600 underline">
              {t.auth.rules}
            </Link>{" "}
            {t.auth.and}{" "}
            <Link href={`/${lang}/privacy`} target="_blank" className="text-sea-600 underline">
              {t.auth.privacy}
            </Link>
          </Check>
        </div>
        <Turnstile lang={lang} resetKey={state} onReady={setReady} failedText={t.errors.captchaRetry} />
        <FormError message={errText(t, state)} />
        <Submit disabled={!ready}>{t.auth.submitRegister}</Submit>
      </form>
    </>
  );
}

export function ForgotForm({ lang, t }: { lang: string; t: T }) {
  const [state, action] = useActionState(forgotPasswordAction, undefined);
  const [ready, setReady] = useState(false);
  if (state?.ok) return <FormOk message={t.auth.forgotSent} />;
  return (
    <form action={action} className="space-y-4">
      <Field label={t.auth.email} name="email" type="email" autoComplete="email" required />
      <Turnstile lang={lang} resetKey={state} onReady={setReady} failedText={t.errors.captchaRetry} />
      <FormError message={errText(t, state)} />
      <Submit disabled={!ready}>{t.auth.sendLink}</Submit>
    </form>
  );
}

export function ResetForm({ lang, t }: { lang: string; t: T }) {
  const [state, action] = useActionState(resetPasswordAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="lang" value={lang} />
      <Field label={t.auth.newPassword} hint={t.auth.passwordHint} name="password" type="password" autoComplete="new-password" minLength={8} maxLength={72} required />
      <Field label={t.auth.repeatPassword} name="password2" type="password" autoComplete="new-password" required />
      <FormError message={errText(t, state)} />
      <Submit>{t.auth.savePassword}</Submit>
    </form>
  );
}
