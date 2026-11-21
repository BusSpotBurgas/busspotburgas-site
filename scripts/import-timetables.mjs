// Качва разписанията от data/timetables.mjs в Supabase (заменя всички линии).
// Употреба:  npm run lines:manual  [-- --dry]
// Ключовете се четат от .env.local (никога не влизат в git).
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { LINES, SOURCE } from "../data/timetables.mjs";

const dry = process.argv.includes("--dry");
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const parse = (s, where) => {
  const list = s.trim().split(/\s+/).filter(Boolean);
  for (const t of list) if (!TIME.test(t)) throw new Error(`Грешен час „${t}“ в ${where}`);
  return [...new Set(list)].sort();
};

const order = { bus: 0, express: 1, trolley: 2 };
const num = (id) => parseInt(id.replace(/\D/g, ""), 10) || 0;
const sorted = [...LINES].sort((a, b) => order[a.kind] - order[b.kind] || num(a.id) - num(b.id) || a.id.localeCompare(b.id));

const lines = [];
const directions = [];
sorted.forEach((l, i) => {
  lines.push({ id: l.id, kind: l.kind, name: l.name, notes: l.notes ?? null, sort_order: i, updated_at: new Date().toISOString() });
  l.directions.forEach((d, dir) => {
    const where = `линия ${l.id}, посока ${dir}`;
    const weekday = parse(d.weekday, where + " делник");
    const saturday = d.saturday === "same" ? weekday : parse(d.saturday, where + " събота");
    const sunday = d.sunday === "same" ? weekday : d.sunday === "same-saturday" ? saturday : parse(d.sunday, where + " неделя");
    directions.push({
      line_id: l.id,
      direction: dir,
      headsign: d.to,
      stops: d.from && d.to ? [d.from, ...(d.via ? [d.via] : []), d.to] : [],
      weekday,
      saturday,
      sunday,
    });
    console.log(`${l.id.padEnd(4)} ${(d.from ?? "кръгова").padEnd(14)} делник ${String(weekday.length).padStart(3)}  събота ${String(saturday.length).padStart(3)}  неделя ${String(sunday.length).padStart(3)}`);
  });
});

if (dry) process.exit(0);

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const must = ({ error }, what) => {
  if (error) {
    console.error(what, error.message);
    process.exit(1);
  }
};
must(await db.from("transit_lines").delete().neq("id", ""), "delete");
must(await db.from("transit_lines").insert(lines), "lines");
must(await db.from("transit_directions").insert(directions), "directions");
must(
  await db.from("transit_meta").upsert([
    { key: "imported_at", value: new Date().toISOString() },
    { key: "source", value: SOURCE },
  ]),
  "meta"
);
console.log(`Готово ✔ ${lines.length} линии, ${directions.length} посоки`);
