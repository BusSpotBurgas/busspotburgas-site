import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const LOCALES = ["bg", "en"];
const DEFAULT = "bg";

function pickLocale(req: NextRequest): string {
  const saved = req.cookies.get("lang")?.value;
  if (saved && LOCALES.includes(saved)) return saved;
  const accept = req.headers.get("accept-language") ?? "";
  // Ако браузърът предпочита английски пред български → en, иначе bg
  for (const part of accept.split(",")) {
    const code = part.trim().slice(0, 2).toLowerCase();
    if (LOCALES.includes(code)) return code;
  }
  return DEFAULT;
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const has = LOCALES.some((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`));
  if (!has) {
    req.nextUrl.pathname = `/${pickLocale(req)}${pathname === "/" ? "" : pathname}`;
    return NextResponse.redirect(req.nextUrl);
  }

  // Обновяване на сесията на влезлия спотър (само ако има бисквитка от Supabase)
  let res = NextResponse.next({ request: req });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && key && req.cookies.getAll().some((c) => c.name.startsWith("sb-"))) {
    const db = createServerClient(url, key, {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next({ request: req });
          list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
        },
      },
    });
    await db.auth.getClaims();
  }
  return res;
}

export const config = {
  // Пропускаме вътрешните файлове, файлове с разширение (икони, sw.js), manifest и /auth (връзки от имейл/Google)
  matcher: ["/((?!_next|api|auth/|.*\\..*|manifest.webmanifest).*)"],
};
