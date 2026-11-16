import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { afterLoginPath } from "@/lib/auth";
import { createSessionClient } from "@/lib/supabase/server";

const TYPES: EmailOtpType[] = ["signup", "email", "recovery", "email_change", "invite", "magiclink"];

// Връзка от имейла: потвърждение на регистрация, нова парола или смяна на имейл.
// Нашите шаблони пращат ?token_hash=…&type=…; стандартните на Supabase – ?code=… (+ наш ?flow=recovery).
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const tokenHash = url.searchParams.get("token_hash");
  const code = url.searchParams.get("code");
  let type = url.searchParams.get("type") as EmailOtpType | null;
  if (!type && url.searchParams.get("flow") === "recovery") type = "recovery";

  const db = await createSessionClient();
  let userId: string | undefined;

  if (tokenHash && type && TYPES.includes(type)) {
    const { data, error } = await db.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) userId = data.user?.id;
  } else if (code) {
    const { data, error } = await db.auth.exchangeCodeForSession(code);
    if (!error) userId = data.user?.id;
  }

  if (userId) {
    const { data: p } = await db.from("profiles").select("onboarding_step,locale").eq("id", userId).single();
    const lang = p?.locale === "en" ? "en" : "bg";
    const target =
      type === "recovery"
        ? `/${lang}/reset-password`
        : type === "email_change"
          ? `/${lang}/settings`
          : afterLoginPath(lang, p?.onboarding_step ?? "consent");
    return NextResponse.redirect(new URL(target, url.origin));
  }
  return NextResponse.redirect(new URL(`/bg/login?error=link`, url.origin));
}
