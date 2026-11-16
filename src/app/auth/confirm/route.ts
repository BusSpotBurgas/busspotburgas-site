import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { afterLoginPath } from "@/lib/auth";
import { createSessionClient } from "@/lib/supabase/server";

const TYPES: EmailOtpType[] = ["signup", "email", "recovery", "email_change", "invite", "magiclink"];

// Връзка от имейла: потвърждение на регистрация, нова парола или смяна на имейл.
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  if (tokenHash && type && TYPES.includes(type)) {
    const db = await createSessionClient();
    const { data, error } = await db.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error && data.user) {
      const { data: p } = await db
        .from("profiles")
        .select("onboarding_step,locale")
        .eq("id", data.user.id)
        .single();
      const lang = p?.locale === "en" ? "en" : "bg";
      const target =
        type === "recovery"
          ? `/${lang}/reset-password`
          : type === "email_change"
            ? `/${lang}/settings?email=changed`
            : afterLoginPath(lang, p?.onboarding_step ?? "consent");
      return NextResponse.redirect(new URL(target, url.origin));
    }
  }
  return NextResponse.redirect(new URL(`/bg/login?error=link`, url.origin));
}
