"use client";

import { useEffect, useRef, useState } from "react";

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
const SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SRC}"]`);
    const s = existing ?? Object.assign(document.createElement("script"), { src: SRC, async: true, defer: true });
    s.addEventListener("load", () => resolve());
    s.addEventListener("error", () => reject(new Error("turnstile")));
    if (!existing) document.head.appendChild(s);
  });
}

/**
 * Невидима проверка „не съм робот“ (Cloudflare Turnstile).
 * Слага жетона в скрито поле „captcha“; Supabase го проверява на сървъра.
 * `resetKey` – смени го след грешка, за да се вземе нов жетон (всеки е за еднократна употреба).
 */
export function Turnstile({ lang, resetKey, onReady }: { lang: string; resetKey?: unknown; onReady?: (ok: boolean) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [token, setToken] = useState("");

  useEffect(() => {
    if (!SITE_KEY || !box.current) {
      onReady?.(true);
      return;
    }
    let id: string | undefined;
    let cancelled = false;
    setToken("");
    onReady?.(false);
    loadScript()
      .then(() => {
        if (cancelled || !box.current || !window.turnstile) return;
        id = window.turnstile.render(box.current, {
          sitekey: SITE_KEY,
          language: lang,
          appearance: "interaction-only",
          callback: (t: string) => {
            setToken(t);
            onReady?.(true);
          },
          "expired-callback": () => {
            setToken("");
            onReady?.(false);
          },
        });
      })
      .catch(() => onReady?.(true)); // ако скриптът не зареди, Supabase ще върне грешка за проверката
    return () => {
      cancelled = true;
      if (id && window.turnstile) window.turnstile.remove(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, resetKey]);

  return (
    <>
      <input type="hidden" name="captcha" value={token} />
      <div ref={box} className="flex justify-center empty:hidden" />
    </>
  );
}
