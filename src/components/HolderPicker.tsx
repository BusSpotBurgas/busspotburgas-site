"use client";

import { useState, useTransition } from "react";
import type { Model } from "@/lib/fleet";
import type { Dictionary } from "@/lib/i18n";
import { claimVehicleAction, releaseVehicleAction, setNoHolderAction } from "@/lib/profile-actions";
import { BusSilhouette } from "./BusSilhouette";
import { FormError } from "./ui";

export type HolderVehicle = { fleet_number: string; model_id: string; owner: "me" | "other" | null };

type T = Pick<Dictionary, "onboarding" | "errors">;

/** Избор на титуляри за един модел: номера като плочки + „Нямам титуляр“. */
export function HolderPicker({
  model,
  vehicles,
  noHolder,
  t,
  onChange,
}: {
  model: Model;
  vehicles: HolderVehicle[];
  noHolder: boolean;
  t: T;
  onChange: (vehicles: HolderVehicle[], noHolder: boolean) => void;
}) {
  const [pending, start] = useTransition();
  const [busyNum, setBusyNum] = useState<string>();
  const [err, setErr] = useState<string>();

  function toggle(v: HolderVehicle) {
    if (v.owner === "other") return;
    setErr(undefined);
    setBusyNum(v.fleet_number);
    start(async () => {
      if (v.owner === "me") {
        const r = await releaseVehicleAction(v.fleet_number);
        if (r === "released") onChange(vehicles.map((x) => (x === v ? { ...x, owner: null } : x)), noHolder);
        else setErr(r === "has_partners" ? t.onboarding.hasPartners : t.errors.generic);
      } else {
        const r = await claimVehicleAction(v.fleet_number);
        if (r === "owner" || r === "already") onChange(vehicles.map((x) => (x === v ? { ...x, owner: "me" } : x)), false);
        else if (r === "taken") {
          onChange(vehicles.map((x) => (x === v ? { ...x, owner: "other" } : x)), noHolder);
          setErr(t.onboarding.takenHint);
        } else setErr(t.errors.generic);
      }
      setBusyNum(undefined);
    });
  }

  function toggleNone() {
    setErr(undefined);
    start(async () => {
      const r = await setNoHolderAction(model.id, !noHolder);
      if (r === "ok") onChange(vehicles, !noHolder);
      else setErr(t.errors.generic);
    });
  }

  const hasMine = vehicles.some((v) => v.owner === "me");

  return (
    <div>
      <div className="mb-5 flex items-center gap-4">
        <div className="grid h-16 w-28 shrink-0 place-items-center rounded-xl" style={{ background: `${model.color}1a` }}>
          <BusSilhouette kind={model.silhouette} color={model.color} className="w-24" />
        </div>
        <div>
          <p className="font-display text-lg font-bold leading-tight">{model.name}</p>
          <p className="text-sm text-muted">{vehicles.length}</p>
        </div>
      </div>

      <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6">
        {vehicles.map((v) => {
          const mine = v.owner === "me";
          const other = v.owner === "other";
          return (
            <li key={v.fleet_number}>
              <button
                type="button"
                onClick={() => toggle(v)}
                disabled={other || pending}
                aria-pressed={mine}
                title={other ? t.onboarding.taken : mine ? t.onboarding.yours : undefined}
                className={`num relative w-full rounded-xl border px-1 py-2.5 text-center text-[15px] font-bold transition ${
                  mine
                    ? "border-transparent text-white shadow-sm"
                    : other
                      ? "cursor-not-allowed border-line bg-canvas text-muted/50 line-through"
                      : "border-line bg-surface hover:border-sea-300 hover:bg-sea-50"
                } ${busyNum === v.fleet_number ? "animate-pulse" : ""}`}
                style={mine ? { background: model.color } : undefined}
              >
                {v.fleet_number}
              </button>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={toggleNone}
        disabled={pending || hasMine}
        aria-pressed={noHolder}
        className={`mt-4 w-full rounded-xl border px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50 ${
          noHolder ? "border-ink bg-ink text-white" : "border-line bg-surface hover:border-sea-300"
        }`}
      >
        {t.onboarding.noHolder}
      </button>
      <div className="mt-3">
        <FormError message={err} />
      </div>
    </div>
  );
}
