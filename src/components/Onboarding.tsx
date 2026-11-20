"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import type { OnboardingStep } from "@/lib/auth";
import type { Model } from "@/lib/fleet";
import type { Dictionary } from "@/lib/i18n";
import { consentAction, setStepAction } from "@/lib/profile-actions";
import { HolderPicker, type HolderVehicle } from "./HolderPicker";
import { ProfileForm } from "./ProfileForm";
import { Check, FormError, Submit, fmt } from "./ui";

type T = Pick<Dictionary, "onboarding" | "errors" | "settings" | "auth"> & { social?: Dictionary["social"] };
type ErrKey = keyof Dictionary["errors"];

const TOUR_ICONS = ["📸", "🤝", "🏆", "📍"];

export function Onboarding({
  lang,
  uid,
  t,
  step: initialStep,
  profile,
  models,
  vehicles: initialVehicles,
  noHolder: initialNone,
}: {
  lang: string;
  uid: string;
  t: T;
  step: OnboardingStep;
  profile: { display_name: string | null; tiktok: string | null; avatar_url: string | null };
  models: Model[];
  vehicles: HolderVehicle[];
  noHolder: string[];
}) {
  const [rawStep, setStep] = useState<OnboardingStep>(initialStep);
  const [modelIdx, setModelIdx] = useState(0);
  const [tourIdx, setTourIdx] = useState(0);
  const [vehicles, setVehicles] = useState(initialVehicles);
  const [none, setNone] = useState(new Set(initialNone));
  const [pending, start] = useTransition();
  const [consentState, consent] = useActionState(consentAction, undefined);

  const step: OnboardingStep = rawStep === "consent" && consentState?.ok ? "profile" : rawStep;

  // Номер на стъпката за лентата горе: съгласие? + профил + модели + тур
  const total = 1 + models.length + 1 + (initialStep === "consent" ? 1 : 0);
  const offset = initialStep === "consent" ? 1 : 0;
  const n =
    step === "consent" ? 1 : step === "profile" ? offset + 1 : step === "holders" ? offset + 2 + modelIdx : total;

  const model = models[modelIdx];
  const modelVehicles = model ? vehicles.filter((v) => v.model_id === model.id) : [];
  const modelDone = modelVehicles.some((v) => v.owner === "me") || (model && none.has(model.id));

  function nextModel() {
    if (modelIdx < models.length - 1) setModelIdx(modelIdx + 1);
    else start(async () => {
      await setStepAction("tour", lang);
      setStep("tour");
    });
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">{fmt(t.onboarding.stepOf, { n, total })}</p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
          <div className="h-full rounded-full bg-sea-500 transition-all duration-500" style={{ width: `${(n / total) * 100}%` }} />
        </div>
      </div>

      <div className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-7">
        {step === "consent" && (
          <>
            <h1 className="font-display text-2xl font-extrabold">{t.onboarding.consentTitle}</h1>
            <p className="mt-2 text-muted">{t.onboarding.consentLead}</p>
            <form action={consent} className="mt-6 space-y-4">
              <Check name="age">{t.auth.age}</Check>
              <Check name="terms">
                {t.auth.termsPre}{" "}
                <Link href={`/${lang}/rules`} target="_blank" className="text-sea-600 underline">{t.auth.rules}</Link>{" "}
                {t.auth.and}{" "}
                <Link href={`/${lang}/privacy`} target="_blank" className="text-sea-600 underline">{t.auth.privacy}</Link>
              </Check>
              <FormError message={consentState?.error ? t.errors[consentState.error as ErrKey] : undefined} />
              <Submit>{t.onboarding.next}</Submit>
            </form>
          </>
        )}

        {step === "profile" && (
          <>
            <h1 className="font-display text-2xl font-extrabold">{t.onboarding.profileTitle}</h1>
            <p className="mt-2 mb-6 text-muted">{t.onboarding.profileLead}</p>
            <ProfileForm uid={uid} t={t} initial={profile} submitLabel={t.onboarding.next} advance onSaved={() => setStep("holders")} />
          </>
        )}

        {step === "holders" && model && (
          <>
            <p className="text-xs font-semibold uppercase tracking-wider text-sea-500">
              {fmt(t.onboarding.modelOf, { n: modelIdx + 1, total: models.length })}
            </p>
            <h1 className="mt-1 font-display text-2xl font-extrabold">{t.onboarding.holdersTitle}</h1>
            <p className="mt-2 mb-6 text-sm text-muted">{t.onboarding.holdersLead}</p>
            <HolderPicker
              key={model.id}
              model={model}
              vehicles={modelVehicles}
              noHolder={none.has(model.id)}
              t={t}
              onChange={(updated, isNone) => {
                setVehicles((all) => all.map((v) => updated.find((u) => u.fleet_number === v.fleet_number) ?? v));
                setNone((s) => {
                  const c = new Set(s);
                  if (isNone) c.add(model.id);
                  else c.delete(model.id);
                  return c;
                });
              }}
            />
            <div className="mt-6 flex gap-3">
              {modelIdx > 0 && (
                <button type="button" onClick={() => setModelIdx(modelIdx - 1)} className="rounded-xl border border-line px-5 py-3 font-semibold hover:bg-canvas">
                  {t.onboarding.back}
                </button>
              )}
              <button
                type="button"
                onClick={nextModel}
                disabled={!modelDone || pending}
                className="flex-1 rounded-xl bg-sea-500 px-5 py-3 font-semibold text-white transition hover:bg-sea-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t.onboarding.next}
              </button>
            </div>
          </>
        )}

        {step === "tour" && (
          <div className="text-center">
            <div className="mx-auto grid size-20 place-items-center rounded-3xl bg-sea-50 text-4xl" aria-hidden="true">
              {TOUR_ICONS[tourIdx]}
            </div>
            <h1 className="mt-5 font-display text-2xl font-extrabold">{t.onboarding.tour[tourIdx].title}</h1>
            <p className="mx-auto mt-3 max-w-sm text-muted">{t.onboarding.tour[tourIdx].text}</p>
            <div className="mt-6 flex justify-center gap-1.5" aria-hidden="true">
              {t.onboarding.tour.map((_, i) => (
                <span key={i} className={`h-1.5 rounded-full transition-all ${i === tourIdx ? "w-6 bg-sea-500" : "w-1.5 bg-line"}`} />
              ))}
            </div>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                tourIdx < t.onboarding.tour.length - 1
                  ? setTourIdx(tourIdx + 1)
                  : start(() => setStepAction("done", lang))
              }
              className="mt-7 w-full rounded-xl bg-sea-500 px-5 py-3 font-semibold text-white hover:bg-sea-600 disabled:opacity-60"
            >
              {tourIdx < t.onboarding.tour.length - 1 ? t.onboarding.next : t.onboarding.finish}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
