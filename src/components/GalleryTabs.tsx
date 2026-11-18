"use client";

import { useState, type ReactNode } from "react";

/** Табове на галерията: Отвън / Отвътре / Кабина / Депо / Видео. */
export function GalleryTabs({ tabs }: { tabs: { id: string; label: string; count?: number; content: ReactNode }[] }) {
  const first = tabs.find((t) => (t.count ?? 0) > 0)?.id ?? tabs[0]?.id;
  const [active, setActive] = useState(first);
  const current = tabs.find((t) => t.id === active) ?? tabs[0];
  return (
    <div>
      <div role="tablist" className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={t.id === active}
            onClick={() => setActive(t.id)}
            className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
              t.id === active ? "border-sea-500 bg-sea-500 text-white" : "border-line bg-surface hover:border-sea-300"
            }`}
          >
            {t.label}
            {t.count !== undefined && <span className="ml-1.5 opacity-60">{t.count}</span>}
          </button>
        ))}
      </div>
      <div role="tabpanel">{current?.content}</div>
    </div>
  );
}
