// Тегли линиите и разписанията на Бургасбус от livetransport.eu и ги записва в Supabase.
// Само Бургасбус – линиите на Айтос Автотранспорт се пропускат.
// Употреба:  npm run lines:live  [-- --dry]
// Ключовете се четат от .env.local (никога не влизат в git).
import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const API = "https://next.livetransport.eu/burgas";
const dry = process.argv.includes("--dry");

// Ръчни бележки към някои линии (показват се над часовете)
const NOTES = {
  "15": "Към Сарафово минава през Летището, към Бургас – не.",
  "15А": "Към Бургас минава през Летището, към Сарафово – не.",
  "Н": "Нощна линия.",
};

const get = async (path) => {
  const r = await fetch(`${API}/${path}`, { headers: { "User-Agent": "busspot-timetable-import" } });
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
  return r.json();
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hm = (s) => {
  s = ((s % 86400) + 86400) % 86400;
  return `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}`;
};
const dow = (d) => new Date(`${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}T12:00:00Z`).getUTCDay();

const { routes } = await get("data");
const own = routes.filter((r) => r[2] === "default"); // „aytos“ = Айтос Автотранспорт
console.log(`Линии на Бургасбус: ${own.length} (пропуснати ${routes.length - own.length} на други превозвачи)`);

// Кои дати да вземем: един делник (пон–чет), събота и неделя от следващите 7 дни
const first = await get(`timetable/route/${encodeURIComponent(own[0][0])}`);
const pick = (test) => first.dates.find((d) => test(dow(d)));
const DAYS = { weekday: pick((x) => x >= 1 && x <= 4), saturday: pick((x) => x === 6), sunday: pick((x) => x === 0) };
console.log("Дати:", DAYS);

const kindOf = (r) => (r[3] === 11 ? "trolley" : /^Б\d/.test(r[5]) ? "express" : "bus");
const lines = [];
const directions = [];

for (const r of own) {
  const id = r[5];
  const dirs = new Map();
  for (const [day, date] of Object.entries(DAYS)) {
    const t = await get(`timetable/route/${encodeURIComponent(r[0])}?date=${date}`);
    await sleep(150); // не товарим чуждия сървър
    for (const d of t.directions ?? []) {
      const stops = d.stops.map((s) => s[0][3].bg);
      const key = `${t.headsigns[d.headsign]?.bg ?? ""}|${stops[0]}`;
      if (!dirs.has(key)) dirs.set(key, { headsign: t.headsigns[d.headsign]?.bg ?? null, stops, weekday: new Set(), saturday: new Set(), sunday: new Set() });
      const dir = dirs.get(key);
      if (stops.length > dir.stops.length) dir.stops = stops;
      for (const trip of d.trips) {
        const s = trip[2].find((x) => x != null);
        if (s != null) dir[day].add(hm(s));
      }
    }
  }
  lines.push({ id, kind: kindOf(r), name: r[6].bg.replace(/ — /g, " – "), notes: NOTES[id] ?? null });
  [...dirs.values()].slice(0, 2).forEach((d, i) => {
    // След полунощ (нощна линия) – подреждаме от 04:00 нататък
    const sort = (set) => [...set].sort((a, b) => ((a < "04:00" ? "1" : "0") + a).localeCompare((b < "04:00" ? "1" : "0") + b));
    directions.push({ line_id: id, direction: i, headsign: d.headsign, stops: d.stops, weekday: sort(d.weekday), saturday: sort(d.saturday), sunday: sort(d.sunday) });
    console.log(`${id.padEnd(4)} ${d.stops[0].slice(0, 22).padEnd(22)} → ${(d.headsign ?? "").slice(0, 22).padEnd(22)} ${d.weekday.size}/${d.saturday.size}/${d.sunday.size}`);
  });
  if (dirs.size > 2) console.warn(`  ! ${id}: ${dirs.size} посоки, взети са първите 2`);
}

const order = { bus: 0, express: 1, trolley: 2 };
const num = (id) => parseInt(id.replace(/^\D+/, ""), 10) || 999;
lines.sort((a, b) => order[a.kind] - order[b.kind] || num(a.id) - num(b.id) || a.id.localeCompare(b.id));
lines.forEach((l, i) => Object.assign(l, { sort_order: i, updated_at: new Date().toISOString() }));

if (dry) process.exit(0);

// На компютъра – от .env.local; в GitHub Actions – от тайните (secrets) на хранилището
const env = existsSync(".env.local") ? Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
) : process.env;
if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SECRET_KEY) {
  console.error("Липсват NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY");
  process.exit(1);
}
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
    { key: "source", value: "Бургасбус, чрез livetransport.eu" },
  ]),
  "meta"
);
console.log(`Готово ✔ ${lines.length} линии, ${directions.length} посоки`);
