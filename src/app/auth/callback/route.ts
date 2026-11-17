import { NextResponse, type NextRequest } from "next/server";
import { afterLoginPath, safeNext, publicOrigin } from "@/lib/auth";
import { createSessionClient } from "@/lib/supabase/server";

// Връщане от Google: разменяме кода за сесия.
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const lang = url.searchParams.get("lang") === "en" ? "en" : "bg";
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));

  if (code) {
    const db = await createSessionClient();
    const { data, error } = await db.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      const { data: p } = await db.from("profiles").select("onboarding_step").eq("id", data.user.id).single();
      return NextResponse.redirect(new URL(afterLoginPath(lang, p?.onboarding_step ?? "consent", next), publicOrigin(req)));
    }
  }
  return NextResponse.redirect(new URL(`/${lang}/login?error=oauth`, publicOrigin(req)));
}
