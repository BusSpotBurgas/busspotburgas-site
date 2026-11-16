import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { hasSupabase } from "./supabase/env";
import { createSessionClient } from "./supabase/server";

export type OnboardingStep = "consent" | "profile" | "holders" | "tour" | "done";

export type Profile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  tiktok: string | null;
  role: "spotter" | "admin";
  locale: "bg" | "en";
  age_confirmed: boolean;
  onboarding_step: OnboardingStep;
};

export type CurrentUser = {
  id: string;
  email: string;
  emailConfirmed: boolean;
  aal: "aal1" | "aal2";
  /** Има потвърден фактор за 2FA, но още не е въвел кода в тази сесия */
  needsMfa: boolean;
  profile: Profile;
};

const PROFILE_COLS = "id,display_name,avatar_url,tiktok,role,locale,age_confirmed,onboarding_step";

/** Влезлият спотър (проверен от Supabase) или null. Чете бисквитките – само в <Suspense>. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (!hasSupabase) return null;
  const db = await createSessionClient();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return null;

  const [{ data: profile }, { data: aal }] = await Promise.all([
    db.from("profiles").select(PROFILE_COLS).eq("id", auth.user.id).single(),
    db.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);
  if (!profile) return null;

  return {
    id: auth.user.id,
    email: auth.user.email ?? "",
    emailConfirmed: Boolean(auth.user.email_confirmed_at),
    aal: aal?.currentLevel === "aal2" ? "aal2" : "aal1",
    needsMfa: aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2",
    profile: profile as Profile,
  };
}

/** Изисква вход; иначе праща към страницата за вход. */
export async function requireUser(lang: string, next?: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/${lang}/login${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  if (user.needsMfa) redirect(`/${lang}/mfa${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  return user;
}

/** Къде да отиде спотърът след вход. */
export function afterLoginPath(lang: string, step: OnboardingStep, next?: string | null) {
  if (step !== "done") return `/${lang}/onboarding`;
  return safeNext(next) ?? `/${lang}/me`;
}

/** Пуска само вътрешни пътища (защита от пренасочване към чужд сайт). */
export function safeNext(next?: string | null): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return null;
  return next;
}

/** Адресът на сайта, от който идва заявката (за връзките в имейлите и Google). */
export async function siteOrigin(): Promise<string> {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : (process.env.URL ?? "https://busspotburgas.netlify.app");
}
