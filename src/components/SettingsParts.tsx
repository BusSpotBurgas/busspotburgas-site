"use client";

import { useActionState, useState, useTransition } from "react";
import type { Model } from "@/lib/fleet";
import type { Dictionary } from "@/lib/i18n";
import { deleteAccountAction, exportDataAction, setEmailPrefAction } from "@/lib/profile-actions";
import { HolderPicker, type HolderVehicle } from "./HolderPicker";
import { Field, FormError, Submit } from "./ui";

/** Всички модели един под друг – за смяна на титулярите от настройките. */
export function HoldersEditor({
  models,
  vehicles: initial,
  noHolder,
  t,
}: {
  models: Model[];
  vehicles: HolderVehicle[];
  noHolder: string[];
  t: Pick<Dictionary, "onboarding" | "errors">;
}) {
  const [vehicles, setVehicles] = useState(initial);
  const [none, setNone] = useState(new Set(noHolder));
  return (
    <div className="space-y-4">
      {models.map((m) => (
        <section key={m.id} className="rounded-card border border-line bg-surface p-5 shadow-card">
          <HolderPicker
            model={m}
            vehicles={vehicles.filter((v) => v.model_id === m.id)}
            noHolder={none.has(m.id)}
            t={t}
            onChange={(updated, isNone) => {
              setVehicles((all) => all.map((v) => updated.find((u) => u.fleet_number === v.fleet_number) ?? v));
              setNone((s) => {
                const c = new Set(s);
                if (isNone) c.add(m.id);
                else c.delete(m.id);
                return c;
              });
            }}
          />
        </section>
      ))}
    </div>
  );
}

export function DownloadData({ label }: { label: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const json = await exportDataAction();
          const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
          const a = Object.assign(document.createElement("a"), { href: url, download: "busspotburgas-moite-danni.json" });
          a.click();
          URL.revokeObjectURL(url);
        })
      }
      className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold hover:border-sea-300 hover:bg-sea-50 disabled:opacity-60"
    >
      ⬇ {label}
    </button>
  );
}

export function DeleteAccount({ lang, t }: { lang: string; t: Pick<Dictionary, "settings" | "errors"> }) {
  const [state, action] = useActionState(deleteAccountAction, undefined);
  const [word, setWord] = useState("");
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="lang" value={lang} />
      <Field label={t.settings.deleteConfirmLabel} name="confirm" value={word} onChange={(e) => setWord(e.target.value)} autoComplete="off" />
      <FormError message={state?.error ? t.errors[state.error as keyof Dictionary["errors"]] : undefined} />
      <Submit variant="danger" disabled={word.trim() !== t.settings.deleteWord}>
        {t.settings.deleteButton}
      </Submit>
    </form>
  );
}

export function EmailPref({ name, label, initial }: { name: string; label: string; initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <label className="flex items-start gap-3 text-sm">
      <input
        type="checkbox"
        checked={on}
        disabled={pending}
        onChange={(e) => {
          const v = e.target.checked;
          setOn(v);
          start(async () => {
            const r = await setEmailPrefAction(name, v);
            if (!r.ok) setOn(!v);
          });
        }}
        className="mt-0.5 size-4.5 shrink-0 accent-sea-500"
      />
      <span>{label}</span>
    </label>
  );
}
