/** Подмяна на {n}, {total} и т.н. в преводите (ползва се и от сървъра, и от браузъра). */
export function fmt(s: string, vars: Record<string, string | number>) {
  return s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}
