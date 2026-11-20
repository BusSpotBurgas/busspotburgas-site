import { notFound } from "next/navigation";
import { Suspense } from "react";
import { HoldersList, ProfileHeader } from "@/components/ProfileCard";
import { BadgeList, RankProgress, StickerAlbum } from "@/components/Game";
import { getSpotterGame } from "@/lib/game";
import { getFleet } from "@/lib/fleet";
import { FollowButton } from "@/components/Social";
import { getCurrentUser } from "@/lib/auth";
import { createSessionClient } from "@/lib/supabase/server";
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
  const game = await getSpotterGame(id);
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
        rank={t.ranks[game.rank]}
        points={game.total}
        pointsLabel={t.me.points}
      />
      <Suspense>
        <FollowSpotter id={id} label={t.social} />
      </Suspense>

      <section className="grid gap-4 sm:grid-cols-[1fr_1.3fr]">
        <div className="rounded-card border border-line bg-surface p-5 shadow-card">
          <RankProgress total={game.total} rank={game.rank} t={t.game} ranks={t.ranks} />
        </div>
        <div className="rounded-card border border-line bg-surface p-5 shadow-card">
          <h2 className="mb-3 font-display text-lg font-bold">🎫 {t.game.badges}</h2>
          <BadgeList badges={game.badges} t={t.game} models={fleet.models} />
        </div>
      </section>

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

      <section className="rounded-card border border-line bg-surface p-5 shadow-card">
        <h2 className="mb-3 font-display text-lg font-bold">📒 {t.game.album}</h2>
        <StickerAlbum models={fleet.models} numbers={fleet.vehicles} collected={game.collected} lang={lang} t={t.game} />
      </section>

    </div>
  );
}

async function FollowSpotter({ id, label }: { id: string; label: Awaited<ReturnType<typeof getDictionary>>["social"] }) {
  const user = await getCurrentUser();
  if (!user || user.id === id) return null;
  const db = await createSessionClient();
  const { data } = await db.from("follows").select("target_id").eq("user_id", user.id).eq("target_type", "spotter").eq("target_id", id).maybeSingle();
  return <FollowButton type="spotter" id={id} following={Boolean(data)} t={label} />;
}
