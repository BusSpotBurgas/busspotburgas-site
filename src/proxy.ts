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

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const has = LOCALES.some((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`));
  if (has) return;
  req.nextUrl.pathname = `/${pickLocale(req)}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(req.nextUrl);
}

export const config = {
  // Пропускаме вътрешните файлове на Next, файлове с разширение (икони, sw.js) и manifest
  matcher: ["/((?!_next|api|.*\\..*|manifest.webmanifest).*)"],
};
