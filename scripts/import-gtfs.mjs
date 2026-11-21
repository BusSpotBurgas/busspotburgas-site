// Зарежда линиите и разписанията от официалния GTFS на Бургасбус в Supabase.
// Употреба:  node scripts/import-gtfs.mjs <папка с разархивирания GTFS> [--dry]
// Ключовете се четат от .env.local (никога не влизат в git).
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const dir = process.argv[2];
const dry = process.argv.includes("--dry");
if (!dir || !existsSync(join(dir, "routes.txt"))) {
  console.error("Дай папката с GTFS файловете (routes.txt, trips.txt, stop_times.txt, stops.txt, calendar.txt).");
  process.exit(1);
}

// ── CSV ──────────────────────────────────────────────────────
function parseCsv(text) {
  text = text.replace(/^﻿/, "");
  const rows = [];
  let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
}
const read = (f) => (existsSync(join(dir, f)) ? parseCsv(readFileSync(join(dir, f), "utf8")) : []);

const routes = read("routes.txt");
const trips = read("trips.txt");
const stops = new Map(read("stops.txt").map((s) => [s.stop_id, s.stop_name]));
const calendar = read("calendar.txt");
const calDates = read("calendar_dates.txt");
console.log(`routes ${routes.length}, trips ${trips.length}, stops ${stops.size}`);

// ── Кои услуги важат днес и за кои дни ───────────────────────
const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
const dayTypes = new Map(); // service_id → Set("weekday"|"saturday"|"sunday")
for (const c of calendar) {
  if (c.end_date && c.end_date < today) continue;
  const set = new Set();
  if (["monday", "tuesday", "wednesday", "thursday", "friday"].some((d) => c[d] === "1")) set.add("weekday");
  if (c.saturday === "1") set.add("saturday");
  if (c.sunday === "1") set.add("sunday");
  dayTypes.set(c.service_id, set);
}
// Ако няма calendar.txt – по calendar_dates.txt (днес напред)
if (!calendar.length) {
  for (const d of calDates) {
    if (d.exception_type !== "1" || d.date < today) continue;
    const dt = new Date(`${d.date.slice(0, 4)}-${d.date.slice(4, 6)}-${d.date.slice(6)}T12:00:00Z`).getUTCDay();
    const set = dayTypes.get(d.service_id) ?? new Set();
    set.add(dt === 0 ? "sunday" : dt === 6 ? "saturday" : "weekday");
    dayTypes.set(d.service_id, set);
  }
}

// ── Спирките на всеки курс (stop_times е голям – четем го веднъж) ─
const tripStops = new Map(); // trip_id → [{seq, stop, time}]
for (const st of read("stop_times.txt")) {
  const arr = tripStops.get(st.trip_id) ?? [];
  arr.push({ seq: Number(st.stop_sequence), stop: st.stop_id, time: st.departure_time || st.arrival_time });
  tripStops.set(st.trip_id, arr);
}

const hhmm = (t) => {
  const [h, m] = t.split(":").map(Number);
  return `${String(h % 24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

function kindOf(r, short) {
  if (r.route_type === "11" || /^[TТ]/i.test(short)) return "trolley";
  if (/^[BБ]/i.test(short)) return "express";
  return "bus";
}
const cyr = (s) => s.toUpperCase().replace(/^B/, "Б").replace(/^T/, "Т");

const lines = [];
const directions = [];
for (const r of routes) {
  const id = cyr(r.route_short_name || r.route_id);
  const kind = kindOf(r, id);
  const rTrips = trips.filter((t) => t.route_id === r.route_id && dayTypes.has(t.service_id));
  if (!rTrips.length) continue;
  lines.push({ id, kind, name: r.route_long_name || null, sort_order: 0 });

  for (const dirId of [0, 1]) {
    const dTrips = rTrips.filter((t) => Number(t.direction_id || 0) === dirId);
    if (!dTrips.length) continue;
    // Най-честият маршрут (поредица от спирки) е „основният“
    const patterns = new Map();
    const times = { weekday: new Set(), saturday: new Set(), sunday: new Set() };
    let headsign = null;
    for (const t of dTrips) {
      const st = (tripStops.get(t.trip_id) ?? []).sort((a, b) => a.seq - b.seq);
      if (!st.length) continue;
      const key = st.map((s) => s.stop).join(">");
      patterns.set(key, (patterns.get(key) ?? 0) + 1);
      for (const d of dayTypes.get(t.service_id)) times[d].add(st[0].time.padStart(8, "0"));
      headsign ??= t.trip_headsign || null;
    }
    const main = [...patterns.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (!main) continue;
    const stopNames = main.split(">").map((s) => stops.get(s) ?? s);
    // След полунощ (25:10) остава накрая
    const sorted = (s) => [...new Set([...s].sort().map(hhmm))];
    directions.push({
      line_id: id,
      direction: dirId,
      headsign: headsign || stopNames.at(-1),
      stops: stopNames,
      weekday: sorted(times.weekday),
      saturday: sorted(times.saturday),
      sunday: sorted(times.sunday),
    });
  }
}

// Ред: автобусни по номер, после Б, после Т
const order = { bus: 0, express: 1, trolley: 2 };
lines.sort((a, b) => order[a.kind] - order[b.kind] || (parseInt(a.id.replace(/\D/g, "")) || 0) - (parseInt(b.id.replace(/\D/g, "")) || 0) || a.id.localeCompare(b.id));
lines.forEach((l, i) => (l.sort_order = i));

console.log(`Линии: ${lines.length} (${lines.map((l) => l.id).join(", ")})`);
console.log(`Посоки: ${directions.length}`);
if (dry) {
  console.log(JSON.stringify(directions[0], null, 2));
  process.exit(0);
}

// ── Запис в Supabase ─────────────────────────────────────────
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
must(await db.from("transit_lines").delete().neq("id", ""), "delete lines");
must(await db.from("transit_lines").insert(lines.map((l) => ({ ...l, updated_at: new Date().toISOString() }))), "insert lines");
must(await db.from("transit_directions").insert(directions), "insert directions");
must(
  await db.from("transit_meta").upsert([
    { key: "imported_at", value: new Date().toISOString() },
    { key: "source", value: "Бургасбус ЕООД – отворени данни GTFS / Burgasbus open data (GTFS)" },
  ]),
  "meta"
);
console.log("Готово ✔");
