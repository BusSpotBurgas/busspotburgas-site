"use client";

import type { InputHTMLAttributes, ReactNode } from "react";
import { useFormStatus } from "react-dom";

/** Поле с етикет и подсказка. */
export function Field({
  label,
  hint,
  ...props
}: { label: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      <input
        {...props}
        className="block w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[15px] text-ink outline-none transition placeholder:text-muted/60 focus:border-sea-400 focus:ring-4 focus:ring-sea-100 disabled:bg-canvas"
      />
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function Check({ name, children, defaultChecked }: { name: string; children: ReactNode; defaultChecked?: boolean }) {
  return (
    <label className="flex items-start gap-2.5 text-sm text-ink">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-0.5 size-4.5 shrink-0 rounded accent-sea-500"
      />
      <span>{children}</span>
    </label>
  );
}

/** Основен бутон; докато формата се изпраща – изчакване. */
export function Submit({ children, disabled, variant = "primary" }: { children: ReactNode; disabled?: boolean; variant?: "primary" | "danger" }) {
  const { pending } = useFormStatus();
  const color = variant === "danger" ? "bg-scrapped hover:bg-scrapped/90" : "bg-sea-500 hover:bg-sea-600";
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${color}`}
    >
      {pending && <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
      {children}
    </button>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-xl border border-scrapped/20 bg-scrapped/5 px-3.5 py-2.5 text-sm text-scrapped">
      {message}
    </p>
  );
}

export function FormOk({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="status" className="rounded-xl border border-run/20 bg-run/5 px-3.5 py-2.5 text-sm text-run">
      {message}
    </p>
  );
}

export { fmt } from "@/lib/fmt";
