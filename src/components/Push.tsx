"use client";

import { useEffect, useState, useTransition } from "react";
import type { Dictionary } from "@/lib/i18n";
import { VAPID_PUBLIC_KEY } from "@/lib/push-public";
import { markAllReadAction, removePushAction, savePushAction } from "@/lib/social-actions";

function b64ToUint8(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

type State = "loading" | "unsupported" | "ios" | "denied" | "off" | "on";

/** Включване/изключване на push известия за това устройство. */
export function PushToggle({ t }: { t: Dictionary["notif"] }) {
  const [state, setState] = useState<State>("loading");
  const [busy, start] = useTransition();

  useEffect(() => {
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone;
    const check = async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        return setState(ios && !standalone ? "ios" : "unsupported");
      }
      if (Notification.permission === "denied") return setState("denied");
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    };
    check();
  }, []);

  const enable = () =>
    start(async () => {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return setState("denied");
      const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js"));
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(VAPID_PUBLIC_KEY) });
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      const r = await savePushAction(json);
      setState(r.ok ? "on" : "off");
    });

  const disable = () =>
    start(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await removePushAction(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
    });

  return (
    <div className="space-y-2 text-sm">
      <p className="text-muted">{t.pushLead}</p>
      {state === "ios" && <p className="rounded-lg bg-sand p-3">{t.pushIos}</p>}
      {state === "unsupported" && <p className="text-muted">{t.pushUnsupported}</p>}
      {state === "denied" && <p className="text-scrapped">{t.pushDenied}</p>}
      {state === "on" && (
        <div className="flex items-center gap-3">
          <span className="font-semibold text-run">{t.pushEnabled}</span>
          <button type="button" disabled={busy} onClick={disable} className="text-muted underline">{t.pushOff}</button>
        </div>
      )}
      {state === "off" && (
        <button type="button" disabled={busy} onClick={enable} className="rounded-xl bg-sea-500 px-4 py-2 font-semibold text-white hover:bg-sea-600 disabled:opacity-60">
          🔔 {t.pushOn}
        </button>
      )}
    </div>
  );
}

/** Маркира всички известия като прочетени при отваряне на страницата. */
export function MarkRead() {
  useEffect(() => {
    markAllReadAction();
  }, []);
  return null;
}
