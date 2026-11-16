"use server";

import type { AuthError } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { afterLoginPath, safeNext, siteOrigin } from "./auth";
import { createSessionClient } from "./supabase/server";

/** Резултат за формите: ключ на грешка (превежда се в браузъра) или успех. */
export type FormState = { error?: string; ok?: boolean } | undefined;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const lang = (f: FormData) => (f.get("lang") === "en" ? "en" : "bg");
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

function mapError(e: AuthError): string {
  const code = e.code ?? "";
  const msg = e.message ?? "";
  if (msg.includes("disposable_email")) return "disposableEmail";
  if (code === "invalid_credentials") return "invalidCredentials";
  if (code === "email_not_confirmed") return "emailNotConfirmed";
  if (code === "weak_password") return "weakPassword";
  if (code === "same_password") return "samePassword";
  if (code.includes("captcha") || msg.toLowerCase().includes("captcha")) return "captcha";
  if (code.includes("rate_limit") || e.status === 429) return "rateLimit";
  if (code === "email_address_invalid") return "invalidEmail";
  return "generic";
}

export async function signUpAction(_: FormState, f: FormData): Promise<FormState> {
  const l = lang(f);
  const email = str(f, "email").toLowerCase();
  const password = String(f.get("password") ?? "");
  if (!EMAIL_RE.test(email) || email.length > 254) return { error: "invalidEmail" };
  if (password.length < 8 || password.length > 72) return { error: "weakPassword" };
  if (f.get("age") !== "on") return { error: "ageRequired" };
  if (f.get("terms") !== "on") return { error: "termsRequired" };

  const db = await createSessionClient();
  const { error } = await db.auth.signUp({
    email,
    password,
    options: {
      captchaToken: str(f, "captcha") || undefined,
      emailRedirectTo: `${await siteOrigin()}/auth/confirm`,
      data: { age_confirmed: "true", terms_accepted: "true", locale: l },
    },
  });
  if (error) return { error: mapError(error) };
  // Supabase не казва дали имейлът вече е регистриран – така никой не може да проверява чужди имейли.
  redirect(`/${l}/register/check-email`);
}

export async function signInAction(_: FormState, f: FormData): Promise<FormState> {
  const l = lang(f);
  const email = str(f, "email").toLowerCase();
  const password = String(f.get("password") ?? "");
  if (!EMAIL_RE.test(email) || !password) return { error: "invalidCredentials" };

  const db = await createSessionClient();
  const { data, error } = await db.auth.signInWithPassword({
    email,
    password,
    options: { captchaToken: str(f, "captcha") || undefined },
  });
  if (error || !data.user) return { error: error ? mapError(error) : "generic" };

  const next = safeNext(str(f, "next"));
  const { data: aal } = await db.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
    redirect(`/${l}/mfa${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  }
  const { data: p } = await db.from("profiles").select("onboarding_step").eq("id", data.user.id).single();
  redirect(afterLoginPath(l, p?.onboarding_step ?? "consent", next));
}

export async function googleAction(f: FormData) {
  const l = lang(f);
  const next = safeNext(str(f, "next"));
  const db = await createSessionClient();
  const cb = new URL(`${await siteOrigin()}/auth/callback`);
  cb.searchParams.set("lang", l);
  if (next) cb.searchParams.set("next", next);
  const { data, error } = await db.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: cb.toString(), queryParams: { prompt: "select_account" } },
  });
  if (error || !data.url) redirect(`/${l}/login?error=oauth`);
  redirect(data.url);
}

export async function forgotPasswordAction(_: FormState, f: FormData): Promise<FormState> {
  const email = str(f, "email").toLowerCase();
  if (!EMAIL_RE.test(email)) return { error: "invalidEmail" };
  const db = await createSessionClient();
  const { error } = await db.auth.resetPasswordForEmail(email, {
    captchaToken: str(f, "captcha") || undefined,
    redirectTo: `${await siteOrigin()}/auth/confirm`,
  });
  // Не казваме дали имейлът съществува
  if (error && mapError(error) !== "generic") return { error: mapError(error) };
  return { ok: true };
}

export async function resetPasswordAction(_: FormState, f: FormData): Promise<FormState> {
  const l = lang(f);
  const password = String(f.get("password") ?? "");
  if (password.length < 8 || password.length > 72) return { error: "weakPassword" };
  if (password !== String(f.get("password2") ?? "")) return { error: "passwordMismatch" };
  const db = await createSessionClient();
  const { data } = await db.auth.getUser();
  if (!data.user) return { error: "linkExpired" };
  const { error } = await db.auth.updateUser({ password });
  if (error) return { error: mapError(error) };
  redirect(`/${l}/me`);
}

export async function signOutAction(f: FormData) {
  const db = await createSessionClient();
  await db.auth.signOut();
  redirect(`/${lang(f)}`);
}
