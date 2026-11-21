import type { LineKind } from "@/lib/lines";

/** Табелка на линия: автобусни – сини, бързи Б – зелени, тролейбусни Т – оранжеви. */
const COLORS: Record<LineKind, string> = {
  bus: "bg-sea-600 text-white",
  express: "bg-[#16A34A] text-white",
  trolley: "bg-[#EA580C] text-white",
};

export function LineBadge({ id, kind, size = "md" }: { id: string; kind: LineKind; size?: "md" | "lg" }) {
  const s = size === "lg" ? "min-w-16 h-16 text-3xl rounded-2xl px-3" : "min-w-12 h-12 text-xl rounded-xl px-2";
  return <span className={`num inline-grid shrink-0 place-items-center font-extrabold shadow-card ${s} ${COLORS[kind]}`}>{id}</span>;
}
