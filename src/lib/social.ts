import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import type { PhotoRow } from "./photo-shared";
import { hasSupabase } from "./supabase/env";
import { createPublicClient, createSessionClient } from "./supabase/server";

export type RatingStats = { votes: number; look: number; comfort: number; sound: number; rarity: number; overall: number } | null;
export type AdPeriod = { ad: string; from: string; to: string; photo: string };
export type Comment = {
  id: number;
  parent_id: number | null;
  body: string;
  status: string;
  created_at: string;
  user_id: string | null;
  profiles: { display_name: string | null; avatar_url: string | null } | null;
};

/** Публичните социални данни за кола (кешират се; обновяват се при промяна). */
export async function getVehicleSocial(vehicleId: number, fleet: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag(`vehicle:${fleet}`);
  if (!hasSupabase) return { stats: null as RatingStats, description: null as string | null, election: null as { id: number; status: string; ends_at: string } | null };
  const db = createPublicClient();
  const [stats, desc, election] = await Promise.all([
    db.from("vehicle_rating_stats").select("votes,look,comfort,sound,rarity,overall").eq("vehicle_id", vehicleId).maybeSingle(),
    db.from("vehicle_descriptions").select("approved").eq("vehicle_id", vehicleId).maybeSingle(),
    db.from("owner_elections").select("id,status,ends_at").eq("vehicle_id", vehicleId).in("status", ["open", "admin"]).maybeSingle(),
  ]);
  return {
    stats: (stats.data as RatingStats) ?? null,
    description: (desc.data?.approved as string | null) ?? null,
    election: election.data as { id: number; status: string; ends_at: string } | null,
  };
}

/** Рекламите по време: групира одобрените снимки по реклама (най-новата горе). */
export function adsTimeline(photos: PhotoRow[]): AdPeriod[] {
  const map = new Map<string, AdPeriod>();
  for (const p of [...photos].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    if (!p.ad) continue;
    const key = p.ad.trim().toLowerCase();
    const cur = map.get(key);
    if (cur) {
      cur.to = p.created_at;
      cur.photo = p.id;
    } else map.set(key, { ad: p.ad.trim(), from: p.created_at, to: p.created_at, photo: p.id });
  }
  return [...map.values()].sort((a, b) => b.to.localeCompare(a.to));
}

/** Какво вижда влезлият спотър на страницата на колата. Само в <Suspense>. */
export async function getViewerVehicle(uid: string, vehicleId: number, fleet: string) {
  const db = await createSessionClient();
  const [rating, follow, invite, holder] = await Promise.all([
    db.from("vehicle_ratings").select("look,comfort,sound,rarity").eq("vehicle_id", vehicleId).eq("user_id", uid).maybeSingle(),
    db.from("follows").select("target_id").eq("user_id", uid).eq("target_type", "vehicle").eq("target_id", fleet).maybeSingle(),
    db.from("holder_invites").select("id").eq("vehicle_id", vehicleId).eq("requester_id", uid).eq("status", "pending").maybeSingle(),
    db.from("vehicle_holders").select("role").eq("vehicle_id", vehicleId).eq("user_id", uid).maybeSingle(),
  ]);
  return {
    rating: rating.data as { look: number; comfort: number; sound: number; rarity: number } | null,
    following: Boolean(follow.data),
    invitePending: Boolean(invite.data),
    role: (holder.data?.role as "owner" | "partner" | undefined) ?? null,
  };
}

/** Харесвания и одобрени коментари на снимка (кешират се). */
export async function getPhotoSocial(photoId: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag(`photo:${photoId}`);
  if (!hasSupabase) return { likes: 0, comments: [] as Comment[] };
  const db = createPublicClient();
  const [likes, comments] = await Promise.all([
    db.from("photo_likes").select("photo_id", { count: "exact", head: true }).eq("photo_id", photoId),
    db
      .from("photo_comments")
      .select("id,parent_id,body,status,created_at,user_id,profiles(display_name,avatar_url)")
      .eq("photo_id", photoId)
      .eq("status", "approved")
      .order("created_at"),
  ]);
  return { likes: likes.count ?? 0, comments: (comments.data ?? []) as unknown as Comment[] };
}

export async function getViewerPhoto(uid: string, photoId: string) {
  const db = await createSessionClient();
  const [liked, mine, follow] = await Promise.all([
    db.from("photo_likes").select("photo_id").eq("photo_id", photoId).eq("user_id", uid).maybeSingle(),
    db
      .from("photo_comments")
      .select("id,parent_id,body,status,created_at,user_id,profiles(display_name,avatar_url)")
      .eq("photo_id", photoId)
      .eq("user_id", uid)
      .neq("status", "approved")
      .order("created_at"),
    db.from("photos").select("user_id").eq("id", photoId).single(),
  ]);
  const authorId = follow.data?.user_id as string | null;
  const followsAuthor = authorId
    ? Boolean((await db.from("follows").select("target_id").eq("user_id", uid).eq("target_type", "spotter").eq("target_id", authorId).maybeSingle()).data)
    : false;
  return { liked: Boolean(liked.data), pending: (mine.data ?? []) as unknown as Comment[], followsAuthor };
}

/** Покани и гласувания за „Моят профил“. */
export async function getHoldersActivity(uid: string) {
  const db = await createSessionClient();
  const [forMe, mine, myPartnerships] = await Promise.all([
    db
      .from("holder_invites")
      .select("id,message,created_at,vehicles(fleet_number),profiles:requester_id(display_name)")
      .eq("owner_id", uid)
      .eq("status", "pending")
      .order("created_at"),
    db.from("holder_invites").select("id,status,created_at,vehicles(fleet_number)").eq("requester_id", uid).eq("status", "pending"),
    db.from("vehicle_holders").select("vehicle_id").eq("user_id", uid).eq("role", "partner"),
  ]);
  const vehicleIds = (myPartnerships.data ?? []).map((r) => r.vehicle_id as number);
  let elections: { id: number; ends_at: string; fleet: string; candidates: { id: string; name: string }[]; myVote: string | null }[] = [];
  if (vehicleIds.length) {
    const { data: els } = await db.from("owner_elections").select("id,ends_at,vehicle_id,vehicles(fleet_number)").eq("status", "open").in("vehicle_id", vehicleIds);
    elections = await Promise.all(
      (els ?? []).map(async (e) => {
        const [{ data: cands }, { data: vote }] = await Promise.all([
          db.from("vehicle_holders").select("user_id,profiles(display_name)").eq("vehicle_id", e.vehicle_id).eq("role", "partner"),
          db.from("owner_votes").select("candidate_id").eq("election_id", e.id).eq("voter_id", uid).maybeSingle(),
        ]);
        return {
          id: e.id as number,
          ends_at: e.ends_at as string,
          fleet: (e.vehicles as unknown as { fleet_number: string } | null)?.fleet_number ?? "",
          candidates: ((cands ?? []) as unknown as { user_id: string; profiles: { display_name: string | null } | null }[]).map((c) => ({
            id: c.user_id,
            name: c.profiles?.display_name ?? "?",
          })),
          myVote: (vote?.candidate_id as string | undefined) ?? null,
        };
      })
    );
  }
  return {
    forMe: (forMe.data ?? []) as unknown as { id: number; message: string | null; created_at: string; vehicles: { fleet_number: string } | null; profiles: { display_name: string | null } | null }[],
    mine: (mine.data ?? []) as unknown as { id: number; status: string; created_at: string; vehicles: { fleet_number: string } | null }[],
    elections,
  };
}

export async function getUnreadCount(uid: string) {
  const db = await createSessionClient();
  const { count } = await db.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", uid).is("read_at", null);
  return count ?? 0;
}

export async function getNotifications(uid: string) {
  const db = await createSessionClient();
  const { data } = await db.from("notifications").select("id,type,data,read_at,created_at").eq("user_id", uid).order("created_at", { ascending: false }).limit(100);
  return (data ?? []) as { id: number; type: string; data: Record<string, unknown>; read_at: string | null; created_at: string }[];
}

/** Всичко за админ опашката от Етап 4. */
export async function getAdminSocialQueue() {
  const db = await createSessionClient();
  const [comments, descriptions, reports, elections] = await Promise.all([
    db
      .from("photo_comments")
      .select("id,photo_id,body,created_at,profiles(display_name),photos(vehicles(fleet_number))")
      .eq("status", "pending")
      .order("created_at")
      .limit(100),
    db.rpc("admin_pending_descriptions"),
    db.from("reports").select("id,target_type,target_id,reason,created_at,profiles(display_name)").eq("resolved", false).order("created_at"),
    db.from("owner_elections").select("id,vehicle_id,status,ends_at,vehicles(fleet_number)").eq("status", "admin"),
  ]);
  const els = await Promise.all(
    (elections.data ?? []).map(async (e) => {
      const { data: c } = await db.from("vehicle_holders").select("user_id,profiles(display_name)").eq("vehicle_id", e.vehicle_id);
      return {
        id: e.id as number,
        fleet: (e.vehicles as unknown as { fleet_number: string } | null)?.fleet_number ?? "",
        candidates: ((c ?? []) as unknown as { user_id: string; profiles: { display_name: string | null } | null }[]).map((x) => ({ id: x.user_id, name: x.profiles?.display_name ?? "?" })),
      };
    })
  );
  return {
    comments: (comments.data ?? []) as unknown as {
      id: number;
      photo_id: string;
      body: string;
      created_at: string;
      profiles: { display_name: string | null } | null;
      photos: { vehicles: { fleet_number: string } | null } | null;
    }[],
    descriptions: (descriptions.data ?? []) as { vehicle_id: number; fleet_number: string; pending: string | null; approved: string | null; author: string | null }[],
    reports: (reports.data ?? []) as unknown as { id: number; target_type: string; target_id: string; reason: string | null; created_at: string; profiles: { display_name: string | null } | null }[],
    elections: els,
  };
}
