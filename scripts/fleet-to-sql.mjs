// Превръща data/fleet.json в SQL за Supabase.
// Пускане: npm run db:sql   →  създава supabase/seed.sql и supabase/setup.sql
// setup.sql = схема + данни в един файл (за поставяне в SQL Editor на Supabase).
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const fleet = JSON.parse(readFileSync(join(root, "data/fleet.json"), "utf8"));
const meta = JSON.parse(readFileSync(join(root, "data/models-meta.json"), "utf8"));

const q = (v) => (v == null ? "null" : `'${String(v).replace(/'/g, "''")}'`);
const STATUSES = ["run", "new", "stop", "service", "off", "scrapped"];

const modelRows = [];
const vehicleRows = [];
const seen = new Set();

for (const m of fleet.models) {
  const x = meta[m.id];
  if (!x) throw new Error(`Няма описание в models-meta.json за модел "${m.id}"`);
  modelRows.push(
    `(${q(m.id)}, ${q(m.name)}, ${q(m.type)}, ${q(x.type_en)}, ${q(m.since)}, ${q(x.color)}, ${q(x.silhouette)}, ${x.sort})`
  );
  for (const status of STATUSES) {
    for (const num of m[status] ?? []) {
      if (seen.has(num)) throw new Error(`Номер ${num} се среща два пъти`);
      seen.add(num);
      vehicleRows.push(`(${q(num)}, ${q(m.id)}, '${status}')`);
    }
  }
}

const seed = `-- Автоматично от data/fleet.json (${fleet.source}). Не редактирай на ръка.
-- ${modelRows.length} модела, ${vehicleRows.length} коли.

insert into public.models (id, name, type_bg, type_en, since, color, silhouette, sort_order) values
${modelRows.join(",\n")}
on conflict (id) do update set
  name = excluded.name, type_bg = excluded.type_bg, type_en = excluded.type_en,
  since = excluded.since, color = excluded.color, silhouette = excluded.silhouette,
  sort_order = excluded.sort_order;

-- Нови коли се добавят; на съществуващите се обновяват само модел и статус.
insert into public.vehicles (fleet_number, model_id, status) values
${vehicleRows.join(",\n")}
on conflict (fleet_number) do update set
  model_id = excluded.model_id, status = excluded.status;
`;

writeFileSync(join(root, "supabase/seed.sql"), seed);
const migDir = join(root, "supabase/migrations");
const schema = readdirSync(migDir).filter((f) => f.endsWith(".sql")).sort()
  .map((f) => readFileSync(join(migDir, f), "utf8")).join("\n\n");
writeFileSync(join(root, "supabase/setup.sql"), `${schema}\n\n${seed}\nselect count(*) as "коли в базата" from public.vehicles;\n`);
console.log(`OK: ${modelRows.length} модела, ${vehicleRows.length} коли → supabase/setup.sql`);
