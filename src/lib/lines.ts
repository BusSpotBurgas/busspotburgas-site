import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { hasSupabase } from "./supabase/env";
import { createPublicClient } from "./supabase/server";

export type LineKind = "bus" | "express" | "trolley";
export type TransitLine = { id: string; kind: LineKind; name: string | null; notes?: string | null };
export type Direction = {
  direction: number;
  headsign: string | null;
  stops: string[];
  weekday: string[];
  saturday: string[];
  sunday: string[];
};

/** Всички линии + кога са обновени разписанията. */
export async function getLines() {
  "use cache";
  cacheLife("minutes");
  cacheTag("lines");
  if (!hasSupabase) return { lines: [] as TransitLine[], importedAt: null as string | null };
  const db = createPublicClient();
  const [{ data }, { data: meta }] = await Promise.all([
    db.from("transit_lines").select("id,kind,name").order("sort_order"),
    db.from("transit_meta").select("key,value"),
  ]);
  const m = new Map((meta ?? []).map((r) => [r.key as string, r.value as string]));
  return { lines: (data ?? []) as TransitLine[], importedAt: m.get("imported_at") ?? null, source: m.get("source") ?? null };
}

/** Една линия с посоките ѝ. id идва от адреса – проверява се. */
export async function getLine(id: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag("lines");
  if (!hasSupabase || !/^[0-9A-Za-zА-Яа-я\-]{1,12}$/.test(id)) return null;
  const db = createPublicClient();
  const { data: line } = await db.from("transit_lines").select("id,kind,name,notes").eq("id", id).maybeSingle();
  if (!line) return null;
  const { data: dirs } = await db
    .from("transit_directions")
    .select("direction,headsign,stops,weekday,saturday,sunday")
    .eq("line_id", id)
    .order("direction");
  return { line: line as TransitLine, directions: (dirs ?? []) as Direction[] };
}
