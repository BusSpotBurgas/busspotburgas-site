import type { Silhouette } from "@/lib/fleet";

type Props = { kind: Silhouette; color: string; className?: string };

/** Рисуван силует на всеки вид кола: 12 м, съчленен, 9 м, мини, тролейбус. */
export function BusSilhouette({ kind, color, className }: Props) {
  const spec = SHAPES[kind];
  return (
    <svg viewBox="0 0 220 80" className={className} role="img" aria-hidden="true">
      {kind === "trolley" && (
        <g stroke={color} strokeWidth="2.5" strokeLinecap="round">
          <line x1="70" y1="20" x2="150" y2="3" />
          <line x1="80" y1="20" x2="160" y2="7" />
        </g>
      )}
      {spec.bodies.map((b, i) => (
        <g key={i}>
          <rect x={b.x} y="20" width={b.w} height="42" rx="7" fill={color} />
          {/* прозорци */}
          <rect x={b.x + 5} y="26" width={b.w - 10} height="15" rx="3" fill="#fff" opacity="0.85" />
          {/* врати */}
          {b.doors.map((d) => (
            <rect key={d} x={b.x + d} y="28" width="9" height="32" rx="2" fill="#fff" opacity="0.35" />
          ))}
        </g>
      ))}
      {spec.joint && <rect x={spec.joint} y="22" width="6" height="38" rx="2" fill={color} opacity="0.55" />}
      {/* предно стъкло */}
      <path d={`M${spec.front - 8} 22 h6 a6 6 0 0 1 6 6 v22 h-12 z`} fill="#fff" opacity="0.6" />
      {spec.wheels.map((x) => (
        <g key={x}>
          <circle cx={x} cy="63" r="9" fill="#0F1B26" />
          <circle cx={x} cy="63" r="3.5" fill="#E3EAF0" />
        </g>
      ))}
    </svg>
  );
}

type Shape = {
  bodies: { x: number; w: number; doors: number[] }[];
  wheels: number[];
  joint?: number;
  front: number;
};

const SHAPES: Record<Silhouette, Shape> = {
  "12m": { bodies: [{ x: 30, w: 160, doors: [12, 70, 136] }], wheels: [60, 160], front: 190 },
  "18m": {
    bodies: [
      { x: 6, w: 100, doors: [10, 70] },
      { x: 112, w: 102, doors: [20, 78] },
    ],
    joint: 106,
    wheels: [30, 96, 186],
    front: 214,
  },
  "9m": { bodies: [{ x: 50, w: 122, doors: [10, 98] }], wheels: [74, 150], front: 172 },
  mini: { bodies: [{ x: 62, w: 96, doors: [74] }], wheels: [82, 138], front: 158 },
  trolley: { bodies: [{ x: 30, w: 160, doors: [12, 70, 136] }], wheels: [60, 160], front: 190 },
};
