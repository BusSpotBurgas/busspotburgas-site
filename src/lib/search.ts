import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { PHOTO_COLS, type PhotoRow } from "./photo-shared";
import { hasSupabase } from "./supabase/env";
import { createPublicClient } from "./supabase/server";

export type SearchResult = {
  vehicles: { fleet_number: string; model_id: string; status: string }[];
  spotters: { id: string; display_name: string; avatar_url: string | null }[];
  lineGroups: { line: string; photos: PhotoRow[] }[];
  ads: PhotoRow[];
};

const EMPTY: SearchResult = { vehicles: [], spotters: [], lineGroups: [], ads: [] };

/** Изчиства търсенето: само букви, цифри, интервал и тире; до 40 знака. */
export function cleanQuery(q: string | string[] | undefined) {
  const s = (Array.isArray(q) ? q[0] : q) ?? "";
  return s.normalize("NFC").replace(/[^\p{L}\p{N} \-]/gu, "").replace(/\s+/g, " ").trim().slice(0, 40);
}

/** Б1 и B1, Т2 и T2 – и на кирилица, и на латиница, главни и малки. */
function lineVariants(line: string) {
  const cyr = line.replace(/B/g, "Б").replace(/T/g, "Т");
  const lat = line.replace(/Б/g, "B").replace(/Т/g, "T");
  return [...new Set([line, cyr, lat].flatMap((x) => [x, x.toLowerCase()]))];
}

/** Търси по номер на кола, линия, спотър и реклама. */
export async function search(q: string): Promise<SearchResult> {
  "use cache";
  cacheLife("minutes");
  cacheTag("photos", "fleet");
  if (!hasSupabase || q.length < 1) return EMPTY;
  const db = createPublicClient();
  const isNum = /^[0-9]+$/.test(q);
  const line = q.toUpperCase().replace(/\s/g, "");
  const [vehicles, spotters, lines, ads] = await Promise.all([
    isNum
      ? db.from("vehicles").select("fleet_number,model_id,status").like("fleet_number", `${q}%`).order("fleet_number").limit(24)
      : Promise.resolve({ data: [] }),
    q.length >= 2
      ? db.from("profiles").select("id,display_name,avatar_url").not("display_name", "is", null).ilike("display_name", `%${q}%`).limit(12)
      : Promise.resolve({ data: [] }),
    line.length <= 4
      ? db.from("photos").select(PHOTO_COLS).eq("status", "approved").in("line", lineVariants(line)).order("created_at", { ascending: false }).limit(12)
      : Promise.resolve({ data: [] }),
    q.length >= 3
      ? db.from("photos").select(PHOTO_COLS).eq("status", "approved").ilike("ad", `%${q}%`).order("created_at", { ascending: false }).limit(12)
      : Promise.resolve({ data: [] }),
  ]);
  const linePhotos = (lines.data ?? []) as unknown as PhotoRow[];
  return {
    vehicles: (vehicles.data ?? []) as SearchResult["vehicles"],
    spotters: (spotters.data ?? []) as SearchResult["spotters"],
    lineGroups: linePhotos.length ? [{ line, photos: linePhotos }] : [],
    ads: (ads.data ?? []) as unknown as PhotoRow[],
  };
}
