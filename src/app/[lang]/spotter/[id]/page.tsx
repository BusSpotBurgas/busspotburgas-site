import { notFound } from "next/navigation";
import { Suspense } from "react";
import { HoldersList, ProfileHeader } from "@/components/ProfileCard";
import { getFleet } from "@/lib/fleet";
import { getDictionary, hasLocale, type Locale } from "@/lib/i18n";
import { createPublicClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Публичен профил на спотър. Имейлът никога не се показва (не е и в таблицата profiles).
export default async function SpotterPage({ params }: PageProps<"/[lang]/spotter/[id]">) {
  return (
    <Suspense fallback={<div className="mx-auto h-96 max-w-4xl animate-pulse px-4 py-8" />}>
      <Spotter params={params} />
    </Suspense>
  );
}

async function Spotter({ params }: { params: PageProps<"/[lang]/spotter/[id]">["params"] }) {
  const { lang, id } = await params;
  if (!hasLocale(lang) || !UUID.test(id)) notFound();
  const db = createPublicClient();
  const [t, fleet, profile, holders, none] = await Promise.all([
    getDictionary(lang as Locale),
    getFleet(),
    db.from("profiles").select("id,display_name,avatar_url,tiktok,role,onboarding_step").eq("id", id).maybeSingle(),
    db.from("vehicle_holders").select("vehicles(fleet_number,model_id)").eq("user_id", id),
    db.from("model_no_holder").select("model_id").eq("user_id", id),
  ]);
  const p = profile.data;
  if (!p || !p.display_name) notFound();
  const numbers = ((holders.data ?? []) as unknown as { vehicles: { fleet_number: string; model_id: string } | null }[])
    .map((h) => h.vehicles)
    .filter((v): v is { fleet_number: string; model_id: string } => Boolean(v));

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <ProfileHeader
        name={p.display_name}
        avatar={p.avatar_url}
        tiktok={p.tiktok}
        isAdmin={p.role === "admin"}
        rank={t.me.rank}
        points={0}
        pointsLabel={t.me.points}
      />
      <section>
        <h2 className="mb-3 font-display text-xl font-bold">{t.me.holders}</h2>
        <HoldersList
          models={fleet.models}
          numbers={numbers}
          noHolder={(none.data ?? []).map((r) => r.model_id)}
          emptyLabel={t.me.noHolders}
          noneLabel={t.me.noHolderModels}
        />
      </section>
    </div>
  );
}
